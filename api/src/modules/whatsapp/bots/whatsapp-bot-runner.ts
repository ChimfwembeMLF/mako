import type { FlowOutboundMessage } from '../whatsapp-flow.types';
import type { AgentResult, AgentTurn } from './whatsapp-bot-agent.service';
import { fillVariables, type BotGraph, type BotNode, type BotNodeData, type ConditionRule, WHATSAPP_LIMITS } from './whatsapp-bot.types';

/** Where a customer is in a bot, stored on their WhatsApp session. */

/** Greetings and bare keywords get the agent's welcome; anything else is answered straight away. */
const GREETING = /^(hi+|hello|hey|hiya|howzit|good (morning|afternoon|evening)|start|menu|help)[\s!.?]*$/i;
export function isRealQuestion(text: string): boolean {
  const t = text.trim();
  if (!t || GREETING.test(t)) return false;
  return t.includes('?') || t.split(/\s+/).length >= 3;
}

export type BotSessionState = {
  mode: 'bot';
  botId: string;
  /** The block waiting for the customer's reply, or null when the bot has finished. */
  nodeId: string | null;
  vars: Record<string, unknown>;
  agentHistory: AgentTurn[];
  /** ISO time until which the bot stays quiet after handing off to a person. */
  handoffUntil?: string;
  invalidCount?: number;
};

export type BotTurnResult = {
  messages: FlowOutboundMessage[];
  state: BotSessionState;
  /** Session should be cleared (bot finished). */
  ended: boolean;
  handoff: boolean;
  lead?: { name?: string; email?: string; notes?: string };
  /** Readable log of the blocks visited, for the simulator. */
  trace: string[];
  /** The conversation continues in another bot (a "Go to another bot" block). */
  switchTo?: { botId: string; vars: Record<string, unknown> };
  agentActions: AgentResult['actions'];
};

export type AgentCaller = (node: BotNodeData, history: AgentTurn[], vars: Record<string, unknown>) => Promise<AgentResult>;

const MAX_STEPS = 30;
const HANDOFF_QUIET_MS = 24 * 60 * 60 * 1000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Runs a bot graph one customer message at a time. Pure apart from the agent callback. */
export class WhatsappBotRunner {
  private readonly byId: Map<string, BotNode>;

  constructor(private readonly graph: BotGraph, private readonly callAgent: AgentCaller) {
    this.byId = new Map(graph.nodes.map((n) => [n.id, n]));
  }

  private next(nodeId: string, handle = 'next'): BotNode | null {
    const edge = this.graph.edges.find((e) => e.source === nodeId && (e.sourceHandle ?? 'next') === handle);
    return edge ? this.byId.get(edge.target) ?? null : null;
  }

  /** Begins the bot from its Start block. */
  async start(botId: string, text: string, vars: Record<string, unknown> = {}): Promise<BotTurnResult> {
    const state: BotSessionState = { mode: 'bot', botId, nodeId: null, vars: { ...vars, message: text }, agentHistory: [] };
    const start = this.graph.nodes.find((n) => n.type === 'start');
    const result = this.emptyResult(state);
    if (!start) {
      result.ended = true;
      return result;
    }
    result.trace.push(`Start (${start.data.label ?? 'Start'})`);
    await this.walk(this.next(start.id), result);

    // Went straight to an AI agent with a real question ("Do you deliver to Kitwe?"):
    // answer it instead of greeting and making the customer ask again.
    const waiting = result.state.nodeId ? this.byId.get(result.state.nodeId) : undefined;
    if (waiting?.type === 'ai_agent' && isRealQuestion(text)) {
      result.messages.pop(); // the agent's greeting
      result.trace.push(`${waiting.data?.label ?? 'AI agent'}: answering the opening message`);
      await this.agentTurn(waiting, text, result);
    }
    return result;
  }

  /** Continues from the block waiting for this reply. */
  async resume(state: BotSessionState, text: string, interactiveId?: string): Promise<BotTurnResult> {
    const result = this.emptyResult({ ...state, vars: { ...state.vars, message: text } });
    const node = state.nodeId ? this.byId.get(state.nodeId) : undefined;
    if (!node) {
      result.ended = true;
      return result;
    }
    const d = node.data ?? {};

    if (node.type === 'buttons' || node.type === 'menu') {
      const options = d.options ?? [];
      const clean = text.trim().toLowerCase();
      const fromId = interactiveId?.startsWith(`${node.id}::`) ? interactiveId.slice(node.id.length + 2) : undefined;
      const byIndex = /^\d+$/.test(clean) ? options[Number(clean) - 1] : undefined;
      const choice = options.find((o) => o.id === fromId) ?? options.find((o) => o.title.trim().toLowerCase() === clean) ?? byIndex;
      if (!choice) {
        result.trace.push(`${d.label ?? node.type}: reply didn't match an option`);
        result.messages.push({ kind: 'text', body: 'Please choose one of the options below.' });
        this.emitQuestion(node, result);
        result.state.nodeId = node.id;
        return result;
      }
      result.state.vars.last_choice = choice.title;
      result.trace.push(`${d.label ?? node.type}: chose "${choice.title}"`);
      await this.walk(this.next(node.id, choice.id), result);
      return result;
    }

    if (node.type === 'ask') {
      const value = text.trim();
      if (!this.valid(value, d.validation)) {
        result.state.invalidCount = (state.invalidCount ?? 0) + 1;
        result.trace.push(`${d.label ?? 'Ask'}: answer not valid (${d.validation})`);
        result.messages.push({ kind: 'text', body: d.retryText?.trim() || this.retryMessage(d.validation) });
        result.state.nodeId = node.id;
        return result;
      }
      result.state.invalidCount = 0;
      if (d.variable) result.state.vars[d.variable] = value;
      result.trace.push(`${d.label ?? 'Ask'}: saved ${d.variable} = "${truncate(value, 40)}"`);
      await this.walk(this.next(node.id), result);
      return result;
    }

    if (node.type === 'ai_agent') {
      await this.agentTurn(node, text, result);
      return result;
    }

    // Any other block shouldn't be waiting; carry on from it.
    await this.walk(this.next(node.id), result);
    return result;
  }

  private async agentTurn(node: BotNode, text: string, result: BotTurnResult) {
    const d = node.data ?? {};
    const clean = text.trim().toLowerCase();
    if ((d.exitKeywords ?? []).some((k) => k.trim().toLowerCase() === clean)) {
      result.trace.push(`${d.label ?? 'AI agent'}: customer left with "${text.trim()}"`);
      await this.walk(this.next(node.id, 'exit'), result);
      return;
    }

    const history: AgentTurn[] = [...result.state.agentHistory, { role: 'customer', content: text }];
    const reply = await this.callAgent(d, history, result.state.vars);
    result.agentActions.push(...reply.actions);
    for (const a of reply.actions) result.trace.push(`${d.label ?? 'AI agent'}: action ${a.name} ${a.ok ? 'done' : 'failed'} (${truncate(a.detail, 80)})`);
    if (reply.reply) result.messages.push({ kind: 'text', body: reply.reply });
    history.push({ role: 'agent', content: reply.reply });
    result.state.agentHistory = history.slice(-20);
    if (reply.lead) result.lead = { ...result.lead, ...reply.lead };

    if (reply.handoff) {
      const target = this.next(node.id, 'handoff');
      // The agent has already told the customer a person is coming; don't say it twice.
      if (target?.type === 'handoff' && reply.reply) this.handOff(result, null, { silent: true });
      else if (target) await this.walk(target, result);
      else this.handOff(result, null, { silent: Boolean(reply.reply) });
      return;
    }
    if (reply.end) {
      await this.walk(this.next(node.id, 'exit'), result);
      return;
    }
    result.state.nodeId = node.id;
  }

  /** Follows blocks until one needs the customer's reply or the bot ends. */
  private async walk(start: BotNode | null, result: BotTurnResult): Promise<void> {
    let node = start;
    for (let step = 0; node && step < MAX_STEPS; step++) {
      const d = node.data ?? {};
      const vars = result.state.vars;
      switch (node.type) {
        case 'start':
          node = this.next(node.id);
          continue;
        case 'message':
          result.trace.push(`${d.label ?? 'Message'}`);
          if (d.text?.trim()) result.messages.push({ kind: 'text', body: fillVariables(d.text, vars) });
          if (d.imageUrl?.trim()) result.messages.push({ kind: 'text', body: d.imageUrl.trim() });
          node = this.next(node.id);
          continue;
        case 'buttons':
        case 'menu':
        case 'ask':
          result.trace.push(`${d.label ?? node.type}: waiting for reply`);
          this.emitQuestion(node, result);
          result.state.nodeId = node.id;
          return;
        case 'condition': {
          const ok = (d.rules ?? []).every((r) => this.ruleMatches(r, vars));
          result.trace.push(`${d.label ?? 'Condition'}: ${ok ? 'yes' : 'no'}`);
          node = this.next(node.id, ok ? 'true' : 'false');
          continue;
        }
        case 'ai_agent':
          result.trace.push(`${d.label ?? 'AI agent'}: started`);
          result.messages.push({ kind: 'text', body: fillVariables(d.text?.trim() || 'How can I help you today?', vars) });
          result.state.agentHistory = [];
          result.state.nodeId = node.id;
          return;
        case 'save_lead':
          result.trace.push(`${d.label ?? 'Save lead'}`);
          result.lead = {
            ...result.lead,
            name: String(vars.full_name ?? vars.name ?? '') || undefined,
            email: String(vars.email ?? '') || undefined,
            notes: Object.entries(vars)
              .filter(([k]) => !['message', 'last_choice'].includes(k))
              .map(([k, v]) => `${k}: ${String(v)}`)
              .join('\n') || undefined,
          };
          node = this.next(node.id);
          continue;
        case 'handoff':
          this.handOff(result, d.text ? fillVariables(d.text, vars) : null);
          return;
        case 'goto':
          result.trace.push(`${d.label ?? 'Go to'}`);
          node = d.targetNodeId ? this.byId.get(d.targetNodeId) ?? null : null;
          continue;
        case 'switch_bot':
          result.trace.push(`${d.label ?? 'Go to another bot'}: ${d.targetBotName ?? d.targetBotId ?? '?'}`);
          if (d.targetBotId) {
            const { message: _last, ...answers } = vars;
            result.switchTo = { botId: d.targetBotId, vars: d.keepAnswers === false ? {} : answers };
          }
          this.finish(result);
          return;
        case 'end':
          result.trace.push(`${d.label ?? 'End'}`);
          if (d.text?.trim()) result.messages.push({ kind: 'text', body: fillVariables(d.text, vars) });
          this.finish(result);
          return;
        default:
          node = null;
      }
    }
    if (node) result.trace.push('Stopped: too many steps in one go (check for a loop)');
    this.finish(result);
  }

  private handOff(result: BotTurnResult, text: string | null, opts: { silent?: boolean } = {}) {
    result.trace.push('Handed to a person');
    if (!opts.silent) {
      result.messages.push({ kind: 'text', body: text || 'Thanks! Someone from our team will reply to you here shortly.' });
    }
    result.handoff = true;
    result.state.nodeId = null;
    result.state.handoffUntil = new Date(Date.now() + HANDOFF_QUIET_MS).toISOString();
  }

  private finish(result: BotTurnResult) {
    result.state.nodeId = null;
    result.ended = true;
  }

  private emitQuestion(node: BotNode, result: BotTurnResult) {
    const d = node.data ?? {};
    const vars = result.state.vars;
    const body = truncate(fillVariables(d.text ?? '', vars) || 'Please choose:', WHATSAPP_LIMITS.body);
    if (node.type === 'buttons') {
      result.messages.push({
        kind: 'buttons',
        body,
        buttons: (d.options ?? []).slice(0, WHATSAPP_LIMITS.buttons).map((o) => ({
          id: `${node.id}::${o.id}`,
          title: truncate(o.title, WHATSAPP_LIMITS.buttonTitle),
        })),
      });
    } else if (node.type === 'menu') {
      result.messages.push({
        kind: 'list',
        body,
        buttonLabel: truncate(d.buttonLabel?.trim() || 'Options', WHATSAPP_LIMITS.menuButtonLabel),
        sections: [{
          rows: (d.options ?? []).slice(0, WHATSAPP_LIMITS.menuRows).map((o) => ({
            id: `${node.id}::${o.id}`,
            title: truncate(o.title, WHATSAPP_LIMITS.menuRowTitle),
            ...(o.description ? { description: truncate(o.description, WHATSAPP_LIMITS.menuRowDescription) } : {}),
          })),
        }],
      });
    } else {
      result.messages.push({ kind: 'text', body: fillVariables(d.text ?? '', vars) });
    }
  }

  private ruleMatches(rule: ConditionRule, vars: Record<string, unknown>): boolean {
    const raw = vars[rule.source === 'message' ? 'message' : rule.source];
    const value = raw === undefined || raw === null ? '' : String(raw).trim().toLowerCase();
    const target = (rule.value ?? '').trim().toLowerCase();
    switch (rule.operator) {
      case 'is_set':
        return value.length > 0;
      case 'equals':
        return value === target;
      case 'contains':
        return target.length > 0 && value.includes(target);
      case 'starts_with':
        return target.length > 0 && value.startsWith(target);
      case 'matches':
        try {
          return new RegExp(rule.value ?? '', 'i').test(String(raw ?? ''));
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  private valid(value: string, kind?: string): boolean {
    if (!value) return false;
    if (kind === 'email') return EMAIL.test(value);
    if (kind === 'phone') return PHONE.test(value);
    if (kind === 'number') return /^-?\d+(\.\d+)?$/.test(value.replace(/,/g, ''));
    return true;
  }

  private retryMessage(kind?: string): string {
    if (kind === 'email') return 'That doesn’t look like an email address. Please try again (e.g. name@example.com).';
    if (kind === 'phone') return 'Please send a valid phone number, including the country code.';
    if (kind === 'number') return 'Please reply with a number.';
    return 'Please type your answer.';
  }

  private emptyResult(state: BotSessionState): BotTurnResult {
    return { messages: [], state: { ...state }, ended: false, handoff: false, trace: [], agentActions: [] };
  }
}
