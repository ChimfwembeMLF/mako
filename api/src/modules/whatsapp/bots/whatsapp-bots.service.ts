import { BadRequestException, Inject, Injectable, Logger, NotFoundException, Optional, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { WhatsappBot } from './whatsapp-bot.entity';
import { validateBotGraph, type BotGraph, type GraphProblem } from './whatsapp-bot.types';
import { WhatsappBotRunner, type BotSessionState, type BotTurnResult } from './whatsapp-bot-runner';
import { WhatsappBotAgentService } from './whatsapp-bot-agent.service';
import { menuGraph, templateGraph, type BotTemplate } from './whatsapp-bot.templates';
import { sealActionSecrets } from './whatsapp-bot-secrets';
import { WhatsappFlowSessionService } from '../whatsapp-flow-session.service';
import { WhatsappCredentials, WhatsappMessagingService } from '../whatsapp-messaging.service';
import { WhatsappMessages } from '../entities/whatsapp_messages.entity';
import { Tenants } from '../../tenants/entities/tenants.entity';
import { LeadsService } from '../../leads/leads.service';
import { BrandProfilesService } from '../../brand_profiles/brand_profiles.service';
import type { FlowOutboundMessage } from '../whatsapp-flow.types';
import { NotificationsService } from '../../notifications/notifications.service';

export type BotUpdate = Partial<Pick<WhatsappBot, 'name' | 'description' | 'triggers' | 'isDefault' | 'graph'>>;

const normalizeTrigger = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40);

/** How many bots one customer message can be passed through, so linked bots can't loop. */
const MAX_BOT_HOPS = 3;

@Injectable()
export class WhatsappBotsService {
  private readonly logger = new Logger(WhatsappBotsService.name);

  constructor(
    @InjectRepository(WhatsappBot) private readonly bots: Repository<WhatsappBot>,
    @InjectRepository(WhatsappMessages) private readonly messagesRepo: Repository<WhatsappMessages>,
    @InjectRepository(Tenants) private readonly tenants: Repository<Tenants>,
    private readonly sessions: WhatsappFlowSessionService,
    private readonly messaging: WhatsappMessagingService,
    private readonly agent: WhatsappBotAgentService,
    private readonly leads: LeadsService,
    private readonly brands: BrandProfilesService,
    @Optional() @Inject(forwardRef(() => NotificationsService))
    private readonly notifications?: NotificationsService,
  ) {}

  // ── Managing bots ────────────────────────────────────────────────────────

  list(tenantId: string, workspaceId?: string): Promise<WhatsappBot[]> {
    return this.bots.find({
      where: { tenantId, workspaceId: workspaceId ?? IsNull() },
      order: { status: 'DESC', updated_at: 'DESC' },
    });
  }

  /** Any live visual bot in the workspace. While there is one, the classic menu bot stays off. */
  async hasLiveBot(tenantId: string, workspaceId?: string): Promise<boolean> {
    const count = await this.bots.count({ where: { tenantId, workspaceId: workspaceId ?? IsNull(), status: 'live' } });
    return count > 0;
  }

  async get(id: string): Promise<WhatsappBot> {
    const bot = await this.bots.findOne({ where: { id } });
    if (!bot) throw new NotFoundException('Bot not found');
    return bot;
  }

  async create(params: { tenantId: string; workspaceId?: string; userId: string; name: string; template?: BotTemplate | 'from_menu_bot' }): Promise<WhatsappBot> {
    const brand = await this.brands
      .resolveForContext({ tenantId: params.tenantId, userId: params.userId, workspaceId: params.workspaceId })
      .catch(() => null);
    const business = brand?.companyName || 'our business';

    let graph: BotGraph;
    if (params.template === 'from_menu_bot') {
      const config = await this.sessions.getConfig(params.tenantId, params.workspaceId);
      if (!config.menuItems.length) throw new BadRequestException('The menu bot has no options to convert yet.');
      graph = menuGraph(config.menuItems, config.welcomeMessage?.trim() || `Welcome to ${config.serviceName || business}! How can we help?`);
    } else {
      graph = templateGraph(params.template ?? 'blank', business);
    }

    const existing = await this.list(params.tenantId, params.workspaceId);
    return this.bots.save(
      this.bots.create({
        tenantId: params.tenantId,
        workspaceId: params.workspaceId ?? null,
        name: params.name.trim().slice(0, 80) || 'New bot',
        status: 'draft',
        // The first bot becomes the default, so it answers everything once it's live.
        isDefault: existing.length === 0,
        triggers: params.template === 'from_menu_bot' ? ['hi', 'hello', 'menu', 'start'] : [],
        graph,
      }),
    );
  }

  async update(id: string, patch: BotUpdate): Promise<{ bot: WhatsappBot; problems: GraphProblem[] }> {
    const bot = await this.get(id);
    if (patch.name !== undefined) bot.name = patch.name.trim().slice(0, 80) || bot.name;
    if (patch.description !== undefined) bot.description = patch.description?.slice(0, 300) ?? null;
    if (patch.triggers !== undefined) {
      bot.triggers = Array.from(new Set(patch.triggers.map(normalizeTrigger).filter(Boolean))).slice(0, 20);
    }
    if (patch.graph !== undefined) bot.graph = sealActionSecrets(this.cleanGraph(patch.graph), bot.graph);
    if (patch.isDefault === true) await this.makeOnlyDefault(bot);
    else if (patch.isDefault === false) bot.isDefault = false;

    const problems = [...validateBotGraph(bot.graph), ...(await this.linkProblems(bot))];
    // A live bot that's been broken by an edit stops answering rather than misbehaving.
    if (bot.status === 'live' && problems.length) bot.status = 'draft';
    if (bot.status === 'live') await this.assertTriggersFree(bot);
    return { bot: await this.bots.save(bot), problems };
  }

  async publish(id: string): Promise<WhatsappBot> {
    const bot = await this.get(id);
    const problems = [...validateBotGraph(bot.graph), ...(await this.linkProblems(bot))];
    if (problems.length) {
      throw new BadRequestException({ message: 'Fix these before going live', problems });
    }
    if (!bot.isDefault && !bot.triggers.length) {
      throw new BadRequestException('Add trigger keywords, or make this the default bot, so customers can reach it.');
    }
    await this.assertTriggersFree(bot);
    bot.status = 'live';
    bot.publishedAt = new Date();
    return this.bots.save(bot);
  }

  async unpublish(id: string): Promise<WhatsappBot> {
    const bot = await this.get(id);
    bot.status = 'draft';
    return this.bots.save(bot);
  }

  async remove(id: string): Promise<void> {
    await this.bots.delete({ id });
  }

  /** "Go to another bot" blocks must point at another existing bot in the same workspace. */
  private async linkProblems(bot: WhatsappBot): Promise<GraphProblem[]> {
    const problems: GraphProblem[] = [];
    for (const n of bot.graph.nodes.filter((x) => x.type === 'switch_bot' && x.data?.targetBotId)) {
      const name = n.data.label || 'Go to another bot';
      if (n.data.targetBotId === bot.id) {
        problems.push({ nodeId: n.id, message: `${name}: a bot can't go to itself. Use a Go to block instead.` });
        continue;
      }
      const target = await this.bots.findOne({ where: { id: n.data.targetBotId, tenantId: bot.tenantId } });
      if (!target || (target.workspaceId ?? null) !== (bot.workspaceId ?? null)) {
        problems.push({ nodeId: n.id, message: `${name}: the bot it points to no longer exists. Choose another.` });
      }
    }
    return problems;
  }

  /**
   * Follows "Go to another bot" blocks: starts each linked bot with the same message and
   * the answers carried over, collecting everything the customer should receive.
   */
  private async followLinks(
    first: BotTurnResult,
    params: { tenantId: string; workspaceId?: string; text: string },
    runnerFor: (bot: WhatsappBot) => WhatsappBotRunner,
  ): Promise<BotTurnResult> {
    const result: BotTurnResult = { ...first, messages: [...first.messages], trace: [...first.trace], agentActions: [...first.agentActions] };
    for (let hop = 0; result.switchTo && hop < MAX_BOT_HOPS; hop++) {
      const target = await this.bots.findOne({ where: { id: result.switchTo.botId, tenantId: params.tenantId } });
      if (!target || (target.workspaceId ?? null) !== (params.workspaceId ?? null)) {
        result.trace.push('Linked bot not found; conversation ended');
        result.switchTo = undefined;
        break;
      }
      result.trace.push(`→ ${target.name}`);
      const next = await runnerFor(target).start(target.id, params.text, result.switchTo.vars);
      result.messages.push(...next.messages);
      result.trace.push(...next.trace);
      result.agentActions.push(...next.agentActions);
      if (next.lead) result.lead = { ...result.lead, ...next.lead };
      result.state = next.state;
      result.ended = next.ended;
      result.handoff = result.handoff || next.handoff;
      result.switchTo = next.switchTo;
    }
    if (result.switchTo) {
      result.trace.push(`Stopped after ${MAX_BOT_HOPS} linked bots (check for bots linking to each other)`);
      result.switchTo = undefined;
      result.ended = true;
    }
    return result;
  }

  private async makeOnlyDefault(bot: WhatsappBot) {
    await this.bots.update(
      { tenantId: bot.tenantId, workspaceId: bot.workspaceId ?? IsNull(), isDefault: true },
      { isDefault: false },
    );
    bot.isDefault = true;
  }

  /** Two live bots can't share a keyword, or customers would get an unpredictable one. */
  private async assertTriggersFree(bot: WhatsappBot) {
    const live = (await this.list(bot.tenantId, bot.workspaceId ?? undefined)).filter((b) => b.status === 'live' && b.id !== bot.id);
    for (const t of bot.triggers) {
      const clash = live.find((b) => b.triggers.includes(t));
      if (clash) throw new BadRequestException(`"${t}" already starts the live bot "${clash.name}". Use a different keyword.`);
    }
  }

  /** Keeps only the fields the builder saves, so arbitrary JSON can't ride along. */
  private cleanGraph(graph: BotGraph): BotGraph {
    const nodes = (Array.isArray(graph?.nodes) ? graph.nodes : []).slice(0, 200).map((n) => ({
      id: String(n.id).slice(0, 64),
      type: n.type,
      position: { x: Number(n.position?.x) || 0, y: Number(n.position?.y) || 0 },
      data: n.data && typeof n.data === 'object' ? n.data : {},
    }));
    const ids = new Set(nodes.map((n) => n.id));
    const edges = (Array.isArray(graph?.edges) ? graph.edges : [])
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .slice(0, 400)
      .map((e) => ({
        id: String(e.id).slice(0, 160),
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ? String(e.sourceHandle).slice(0, 64) : 'next',
      }));
    return { nodes, edges };
  }

  // ── Running bots ─────────────────────────────────────────────────────────

  /** Live bot whose keyword the message starts with (longest keyword wins). */
  matchTrigger(bots: WhatsappBot[], text: string): WhatsappBot | null {
    const clean = normalizeTrigger(text);
    let best: { bot: WhatsappBot; len: number } | null = null;
    for (const bot of bots) {
      for (const t of bot.triggers) {
        if ((clean === t || clean.startsWith(`${t} `)) && (!best || t.length > best.len)) best = { bot, len: t.length };
      }
    }
    return best?.bot ?? null;
  }

  private makeRunner(bot: Pick<WhatsappBot, 'graph'>, ctx: { tenantId: string; workspaceId?: string; ownerId: string; phone: string; dryRun?: boolean }) {
    return new WhatsappBotRunner(bot.graph, (node, history, vars) =>
      this.agent.respond({ ...ctx, node, history, vars }),
    );
  }

  /**
   * Answers an inbound WhatsApp message with a live bot. Returns false when no live bot
   * applies, so the older menu bot and auto-replies can still run.
   */
  async tryHandleInbound(params: {
    tenantId: string;
    workspaceId?: string;
    phone: string;
    text: string;
    interactiveId?: string;
    creds: WhatsappCredentials;
    contactId?: string;
    leadId?: string;
  }): Promise<boolean> {
    const live = (await this.list(params.tenantId, params.workspaceId)).filter((b) => b.status === 'live');
    if (!live.length) return false;

    const tenant = await this.tenants.findOne({ where: { id: params.tenantId } });
    const ownerId = tenant?.ownerId ?? '';
    const session = await this.sessions.getSession(params.tenantId, params.phone);
    const state = session?.context?.mode === 'bot' ? (session.context as unknown as BotSessionState) : null;
    const triggered = this.matchTrigger(live, params.text);
    const ctx = { tenantId: params.tenantId, workspaceId: params.workspaceId, ownerId, phone: params.phone };

    // After a handoff the team is talking; stay quiet unless the customer restarts a bot.
    if (state?.handoffUntil && new Date(state.handoffUntil).getTime() > Date.now() && !triggered) return true;

    let result: BotTurnResult;
    // The conversation may be inside a draft bot reached through a "Go to another bot" link.
    const current = state?.nodeId
      ? live.find((b) => b.id === state.botId) ??
        (await this.bots.findOne({ where: { id: state.botId, tenantId: params.tenantId } })) ??
        undefined
      : undefined;
    try {
      if (triggered) {
        result = await this.makeRunner(triggered, ctx).start(triggered.id, params.text);
      } else if (current && state) {
        result = await this.makeRunner(current, ctx).resume(state, params.text, params.interactiveId);
      } else {
        const fallback = live.find((b) => b.isDefault);
        if (!fallback) return false;
        result = await this.makeRunner(fallback, ctx).start(fallback.id, params.text);
      }
      result = await this.followLinks(result, params, (b) => this.makeRunner(b, ctx));
    } catch (err) {
      this.logger.error(`WhatsApp bot failed for ${params.phone}`, err);
      return false;
    }

    if (result.ended && !result.handoff) {
      await this.sessions.clearSession(params.tenantId, params.phone);
    } else {
      await this.sessions.saveSession(params.tenantId, params.phone, 'BOT', result.state as unknown as Record<string, unknown>);
    }

    if (result.lead && params.leadId) {
      const patch: Record<string, string> = {};
      if (result.lead.name) patch.name = result.lead.name;
      if (result.lead.email) patch.email = result.lead.email;
      if (result.lead.notes) patch.message = result.lead.notes;
      if (result.handoff) patch.status = 'contacted';
      if (Object.keys(patch).length) await this.leads.update(params.leadId, patch as never).catch(() => undefined);
    }

    for (const msg of result.messages) {
      const sent = await this.dispatch(params.creds, params.phone, msg).catch((err: unknown) => ({
        success: false,
        waMessageId: undefined,
        error: err instanceof Error ? err.message : String(err),
      }));
      // Failed sends are kept too, so the team sees in the Inbox that the customer got nothing.
      await this.messagesRepo.save(
        this.messagesRepo.create({
          tenantId: params.tenantId,
          workspaceId: params.workspaceId,
          contactId: params.contactId,
          leadId: params.leadId,
          phone: params.phone,
          direction: 'outbound',
          body: this.describe(msg),
          waMessageId: sent.waMessageId,
          status: sent.success ? 'flow_reply' : 'failed',
          errorMessage: sent.success ? undefined : (sent.error ?? 'WhatsApp did not accept the bot reply').slice(0, 500),
        }),
      );
      if (!sent.success) {
        this.logger.warn(`Bot reply to ${params.phone} failed: ${sent.error ?? 'unknown error'}`);
        break; // Later messages would arrive out of context.
      }
    }

    // Starting a handoff: tell the team someone is waiting (once, not on every quiet message).
    if (result.handoff && !(state?.handoffUntil && new Date(state.handoffUntil).getTime() > Date.now())) {
      await this.alertHandoff(params.tenantId, params.phone, result).catch((err) =>
        this.logger.warn(`Handoff alert failed: ${err instanceof Error ? err.message : err}`),
      );
    }
    return true;
  }

  private async alertHandoff(tenantId: string, phone: string, result: BotTurnResult) {
    if (!this.notifications) return;
    const who = result.lead?.name || `+${phone.replace(/\D/g, '')}`;
    await this.notifications.notifyTenantAdmins(tenantId, {
      type: 'whatsapp_handoff',
      title: `${who} is waiting for a reply on WhatsApp`,
      body: 'The bot handed this conversation to your team. Reply from the Inbox; bots stay quiet for 24 hours.',
      link: '/replies?tab=messages',
      metadata: { phone },
      email: true,
      emailCategory: 'emailHotLeads',
    });
  }

  /**
   * The builder's test chat: runs the (possibly unsaved) graph without sending anything
   * to WhatsApp, saving leads, or calling custom actions.
   */
  async simulate(params: {
    bot: WhatsappBot;
    graph?: BotGraph;
    state?: BotSessionState | null;
    text: string;
    interactiveId?: string;
    userId: string;
  }): Promise<BotTurnResult & { problems: GraphProblem[] }> {
    const graph = params.graph ? this.cleanGraph(params.graph) : params.bot.graph;
    const runner = this.makeRunner({ graph }, {
      tenantId: params.bot.tenantId,
      workspaceId: params.bot.workspaceId ?? undefined,
      ownerId: params.userId,
      phone: '+260000000000',
      dryRun: true,
    });
    const ctx = { tenantId: params.bot.tenantId, workspaceId: params.bot.workspaceId ?? undefined, ownerId: params.userId, phone: '+260000000000', dryRun: true };
    // Mid-conversation inside a linked bot, continue that bot (with its saved flow).
    const inOtherBot = params.state?.nodeId && params.state.botId !== params.bot.id
      ? await this.bots.findOne({ where: { id: params.state.botId, tenantId: params.bot.tenantId } })
      : null;
    const first = inOtherBot
      ? await this.makeRunner(inOtherBot, ctx).resume(params.state!, params.text, params.interactiveId)
      : params.state?.nodeId
        ? await runner.resume(params.state, params.text, params.interactiveId)
        : await runner.start(params.bot.id, params.text);
    const result = await this.followLinks(first, { tenantId: ctx.tenantId, workspaceId: ctx.workspaceId, text: params.text }, (b) => this.makeRunner(b, ctx));
    return { ...result, problems: [...validateBotGraph(graph), ...(await this.linkProblems({ ...params.bot, graph } as WhatsappBot))] };
  }

  private dispatch(creds: WhatsappCredentials, phone: string, msg: FlowOutboundMessage) {
    if (msg.kind === 'buttons') return this.messaging.sendInteractiveButtons(creds, phone, msg.body, msg.buttons);
    if (msg.kind === 'list') return this.messaging.sendInteractiveList(creds, phone, msg.body, msg.buttonLabel, msg.sections);
    return this.messaging.sendSessionText(creds, phone, msg.body);
  }

  private describe(msg: FlowOutboundMessage): string {
    if (msg.kind === 'text') return msg.body;
    if (msg.kind === 'buttons') return `${msg.body}\n[${msg.buttons.map((b) => b.title).join(' | ')}]`;
    return `${msg.body}\n[${msg.sections.flatMap((s) => s.rows.map((r) => r.title)).join(', ')}]`;
  }
}
