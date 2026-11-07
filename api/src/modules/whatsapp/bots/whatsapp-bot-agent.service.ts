import { Injectable, Logger } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { AiProviderRouter } from '../../ai/services/ai-provider-router.service';
import { AiUsageTrackerService } from '../../ai/services/ai-usage-tracker.service';
import { BrandProfilesService } from '../../brand_profiles/brand_profiles.service';
import { VectorStoreService } from '../../chatbot/services/vector-store.service';
import { KnowledgeEmbeddingService } from '../../chatbot/services/knowledge-embedding.service';
import type { AgentCustomAction, BotNodeData } from './whatsapp-bot.types';
import { actionSecret } from './whatsapp-bot-secrets';

export type AgentTurn = { role: 'customer' | 'agent' | 'action'; content: string };

export type AgentResult = {
  reply: string;
  /** Hand the conversation to a person. */
  handoff?: boolean;
  /** Close the conversation. */
  end?: boolean;
  /** Lead fields the agent collected (built-in save_lead action). */
  lead?: { name?: string; email?: string; notes?: string };
  /** What happened, for the test simulator and logs. */
  actions: Array<{ name: string; ok: boolean; detail: string }>;
};

type AgentDecision = {
  reply?: string;
  action?: { name?: string; args?: Record<string, unknown> } | null;
};

const MAX_ACTION_STEPS = 3;
const MAX_REPLY = 1000;

/** Private, loopback and link-local ranges a custom action must never reach. */
function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    return v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:127.') || v === '::';
  }
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 || a === 127 || a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/;
const NAME = /\b(?:my name is|my name's|i am|i'm|this is)\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)?)/i;

/**
 * Name and email the customer typed in their last message. A safety net for when the model
 * answers without calling save_lead, so details a customer gives are never lost.
 */
export function detailsShared(history: AgentTurn[]): AgentResult['lead'] | undefined {
  const last = [...history].reverse().find((t) => t.role === 'customer')?.content ?? '';
  const email = EMAIL.exec(last)?.[0];
  if (!email) return undefined;
  const name = NAME.exec(last)?.[1];
  return { email: email.slice(0, 200), ...(name ? { name: name.slice(0, 120) } : {}) };
}

/** WhatsApp formatting: *bold*, _italic_; markdown **bold** and headings would show as symbols. */
export function toWhatsappText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/__(.+?)__/g, '_$1_')
    .replace(/^#{1,6}\s+/gm, '')
    .trim();
}

/**
 * The AI agent block. Works with any chat provider: the model answers in JSON with a
 * reply and at most one action per step, rather than relying on one vendor's tool calls.
 */
@Injectable()
export class WhatsappBotAgentService {
  private readonly logger = new Logger(WhatsappBotAgentService.name);

  constructor(
    private readonly ai: AiProviderRouter,
    private readonly brands: BrandProfilesService,
    private readonly vectorStore: VectorStoreService,
    private readonly embeddings: KnowledgeEmbeddingService,
    private readonly usage: AiUsageTrackerService,
  ) {}

  async respond(params: {
    tenantId: string;
    workspaceId?: string;
    ownerId: string;
    phone: string;
    node: BotNodeData;
    history: AgentTurn[];
    vars: Record<string, unknown>;
    /** Simulator: describe custom actions instead of calling them, and save nothing. */
    dryRun?: boolean;
  }): Promise<AgentResult> {
    const actions: AgentResult['actions'] = [];
    const system = await this.buildSystemPrompt(params);
    const transcript = params.history.slice(-14).map((t) => ({
      role: (t.role === 'customer' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: t.role === 'action' ? `[action result] ${t.content}` : t.content,
    }));

    const customActions = params.node.customActions ?? [];
    const builtIns = new Set(params.node.builtInActions ?? []);

    // Agent replies use the workspace's AI allowance like every other AI feature.
    try {
      await this.usage.assertWithinLimit(params.tenantId, params.ownerId);
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err);
      this.logger.warn(`WhatsApp agent paused for tenant ${params.tenantId}: ${why}`);
      actions.push({ name: 'ai_limit', ok: false, detail: `AI not available: ${why}` });
      return { reply: 'Thanks for your message! Someone from our team will reply to you here shortly.', handoff: true, actions };
    }

    for (let step = 0; step < MAX_ACTION_STEPS; step++) {
      let data: AgentDecision;
      try {
        const out = await this.ai.completeJson<AgentDecision>(
          [{ role: 'system', content: system }, ...transcript],
          { tenantId: params.tenantId, temperature: 0.2 },
        );
        data = out.data;
        await this.usage
          .record({ tenantId: params.tenantId, userId: params.ownerId, functionName: 'whatsapp-agent', tokensUsed: out.tokensUsed })
          .catch(() => undefined);
      } catch (err) {
        // The AI provider failed: hand over to the team rather than leave the customer unanswered.
        const why = err instanceof Error ? err.message : String(err);
        this.logger.error(`WhatsApp agent AI call failed for tenant ${params.tenantId}: ${why}`);
        actions.push({ name: 'ai_error', ok: false, detail: why.slice(0, 300) });
        return { reply: "Sorry, I'm having trouble answering right now. I've asked the team to reply to you here.", handoff: true, actions };
      }
      const reply = toWhatsappText(String(data?.reply ?? '')).slice(0, MAX_REPLY);
      const name = data?.action?.name ? String(data.action.name) : '';
      const args = (data?.action?.args && typeof data.action.args === 'object' ? data.action.args : {}) as Record<string, unknown>;

      if (!name) {
        const lead = builtIns.has('save_lead') ? detailsShared(params.history) : undefined;
        if (lead) actions.push({ name: 'save_lead', ok: true, detail: params.dryRun ? `Would save lead: ${JSON.stringify(lead)}` : 'Lead saved (details from the message)' });
        return { reply: reply || 'Sorry, could you say that another way?', ...(lead ? { lead } : {}), actions };
      }

      if (name === 'handoff' && builtIns.has('handoff')) {
        actions.push({ name, ok: true, detail: 'Handed to a person' });
        return { reply: reply || 'Let me get someone from the team to help you.', handoff: true, actions };
      }
      if (name === 'end_conversation' && builtIns.has('end_conversation')) {
        actions.push({ name, ok: true, detail: 'Conversation ended' });
        return { reply: reply || 'Thanks for chatting with us!', end: true, actions };
      }
      if (name === 'save_lead' && builtIns.has('save_lead')) {
        const lead = {
          name: args.name ? String(args.name).slice(0, 120) : undefined,
          email: args.email ? String(args.email).slice(0, 200) : undefined,
          notes: args.notes ? String(args.notes).slice(0, 1000) : undefined,
        };
        if (!lead.name && !lead.email) {
          // Nothing to save yet; let the model answer without it.
          transcript.push({ role: 'assistant', content: '[action result] save_lead: skipped, the customer has not shared a name or email yet' });
          if (reply) return { reply, actions };
          continue;
        }
        actions.push({ name, ok: true, detail: params.dryRun ? `Would save lead: ${JSON.stringify(lead)}` : 'Lead saved' });
        transcript.push({ role: 'assistant', content: `[action result] save_lead: saved ${JSON.stringify(lead)}` });
        if (reply) return { reply, lead, actions };
        continue;
      }

      const custom = customActions.find((a) => a.name === name);
      if (!custom) {
        // The model asked for something it doesn't have; answer without it.
        return { reply: reply || 'Sorry, I can’t do that here.', actions };
      }
      const outcome = params.dryRun
        ? { ok: true, body: `(test) ${custom.name} would be called with ${JSON.stringify(args)}` }
        : await this.callCustomAction(custom, args, params);
      actions.push({ name, ok: outcome.ok, detail: outcome.body.slice(0, 300) });
      transcript.push({ role: 'assistant', content: `[action result] ${name}: ${outcome.body.slice(0, 2000)}` });
      transcript.push({ role: 'user', content: '(Use the action result above to answer the customer now.)' });
    }
    return { reply: 'Sorry, that took too long. Could you try again?', actions };
  }

  private async buildSystemPrompt(params: {
    tenantId: string;
    workspaceId?: string;
    ownerId: string;
    node: BotNodeData;
    history: AgentTurn[];
    vars: Record<string, unknown>;
  }): Promise<string> {
    const brand = await this.brands
      .resolveForContext({ tenantId: params.tenantId, userId: params.ownerId, workspaceId: params.workspaceId })
      .catch(() => null);

    let knowledge = '';
    const lastQuestion = [...params.history].reverse().find((t) => t.role === 'customer')?.content;
    if (params.node.useKnowledge !== false && lastQuestion) {
      try {
        const vector = await this.embeddings.embed(lastQuestion);
        const chunks = await this.vectorStore.search({ tenantId: params.tenantId, embedding: vector, topK: 4, minScore: 0.3 });
        knowledge = chunks.map((c, i) => `<source ${i + 1} "${c.title}">\n${c.content}\n</source>`).join('\n');
      } catch (err) {
        this.logger.warn(`Agent knowledge search failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    const builtIns = params.node.builtInActions ?? [];
    const actionLines = [
      builtIns.includes('handoff') && '- handoff {}: IMMEDIATELY when the customer asks for a person, human, agent or staff, is upset, or you cannot help. Do not ask for details first.',
      builtIns.includes('save_lead') && '- save_lead {name, email, notes}: only after the customer has shared their name or email, or asks to be contacted.',
      builtIns.includes('end_conversation') && '- end_conversation {}: when the customer is done.',
      ...(params.node.customActions ?? []).map(
        (a) => `- ${a.name} {${a.parameters.join(', ')}}: ${a.description}`,
      ),
    ].filter(Boolean);

    const vars = Object.entries(params.vars).filter(([k]) => !k.startsWith('_'));

    return [
      `You are a WhatsApp assistant for ${brand?.companyName || 'this business'}.`,
      brand?.description ? `About the business: ${brand.description}` : '',
      brand?.toneOfVoice ? `Tone of voice: ${brand.toneOfVoice}` : '',
      `Your job: ${params.node.instructions ?? ''}`,
      knowledge
        ? `Answer from these documents when relevant. If they don't cover it, say so rather than guessing.\n${knowledge}`
        : 'You have no product, price, stock or delivery documents for this question. Do not name or describe any specific products, blends, flavours, prices, delivery areas or opening hours unless they appear in the business details above.',
      vars.length ? `Known about this customer: ${vars.map(([k, v]) => `${k}=${String(v)}`).join(', ')}` : '',
      actionLines.length
        ? `Actions you can take (at most one per reply, only when needed; collect required details first):\n${actionLines.join('\n')}`
        : 'You cannot take actions; just answer.',
      [
        'Rules:',
        '- Only state facts found in the business details or documents above. Never invent products, prices, stock, order details, opening hours or policies.',
        "- If you don't know, say so and offer to check with the team (handoff, when available).",
        "- You are already talking to the customer on WhatsApp. Never tell them to email or call a contact detail they gave you, and don't invent the business's phone, email or address.",
        '- Write short, friendly WhatsApp messages (under 500 characters). For emphasis use *single asterisks*, not markdown headings or **double**.',
      ].join('\n'),
      'Respond ONLY with JSON: {"reply": "message to send the customer", "action": null} or {"reply": "...", "action": {"name": "...", "args": {...}}}.',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  /** POSTs to the business's own URL. Only public https endpoints, with a short timeout. */
  private async callCustomAction(
    action: AgentCustomAction,
    args: Record<string, unknown>,
    ctx: { tenantId: string; workspaceId?: string; phone: string },
  ): Promise<{ ok: boolean; body: string }> {
    try {
      const url = new URL(action.url);
      if (url.protocol !== 'https:') return { ok: false, body: 'Action URL must use https.' };
      const host = url.hostname;
      const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
      if (addresses.some((a) => isPrivateAddress(a.address))) {
        return { ok: false, body: 'Action URL points to a private network address.' };
      }
      const secret = actionSecret(action);
      const res = await fetch(url, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mako-WhatsApp-Agent/1.0',
          ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
        },
        body: JSON.stringify({ action: action.name, args, customer: { phone: ctx.phone }, workspaceId: ctx.workspaceId ?? null }),
        signal: AbortSignal.timeout(8_000),
      });
      const text = (await res.text()).slice(0, 4000);
      return res.ok ? { ok: true, body: text || 'OK' } : { ok: false, body: `The system replied ${res.status}: ${text.slice(0, 300)}` };
    } catch (err) {
      return { ok: false, body: `Could not reach the system: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}
