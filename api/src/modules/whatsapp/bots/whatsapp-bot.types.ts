/**
 * A WhatsApp bot is a graph of blocks drawn in the visual builder (React Flow).
 * Nodes and edges keep React Flow's shape so the builder can save them as-is.
 */

export type BotNodeType =
  | 'start'
  | 'message'
  | 'buttons'
  | 'menu'
  | 'ask'
  | 'condition'
  | 'ai_agent'
  | 'save_lead'
  | 'handoff'
  | 'goto'
  | 'switch_bot'
  | 'end';

export type BotOption = { id: string; title: string; description?: string };

export type AskValidation = 'text' | 'email' | 'phone' | 'number';

export type ConditionRule = {
  /** A collected variable name, or "message" for the customer's last message. */
  source: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'is_set' | 'matches';
  value?: string;
};

/** A call the AI agent can make into the business's own system. */
export type AgentCustomAction = {
  name: string;
  description: string;
  url: string;
  /** Fields the agent must collect before calling, e.g. ["order_number"]. */
  parameters: string[];
  /** Optional secret sent as `Authorization: Bearer <secret>`. Only ever sent in, never returned. */
  secret?: string;
  /** The saved secret, encrypted (server only). */
  secretEnc?: string;
  /** Returned to the builder instead of the secret: one is saved. */
  hasSecret?: boolean;
};

export type BotNodeData = {
  label?: string;
  /** message, buttons, menu, ask, handoff, end */
  text?: string;
  /** message: optional image */
  imageUrl?: string;
  /** buttons (max 3) / menu (max 10) */
  options?: BotOption[];
  /** menu: label of the button that opens the list */
  buttonLabel?: string;
  /** ask */
  variable?: string;
  validation?: AskValidation;
  retryText?: string;
  /** condition: all rules must match for the "true" branch */
  rules?: ConditionRule[];
  /** ai_agent */
  instructions?: string;
  useKnowledge?: boolean;
  exitKeywords?: string[];
  builtInActions?: Array<'save_lead' | 'handoff' | 'end_conversation'>;
  customActions?: AgentCustomAction[];
  /** goto */
  targetNodeId?: string;
  /** switch_bot: continue the conversation in another bot of the same workspace */
  targetBotId?: string;
  /** switch_bot: shown on the canvas; the id is what counts */
  targetBotName?: string;
  /** switch_bot: carry collected answers into the next bot (default true) */
  keepAnswers?: boolean;
};

export type BotNode = {
  id: string;
  type: BotNodeType;
  position: { x: number; y: number };
  data: BotNodeData;
};

export type BotEdge = {
  id: string;
  source: string;
  target: string;
  /**
   * Which exit of the source block: an option id for buttons/menu, "true"/"false" for a
   * condition, "exit"/"handoff" for an AI agent, "invalid" for ask, otherwise "next".
   */
  sourceHandle?: string | null;
};

export type BotGraph = { nodes: BotNode[]; edges: BotEdge[] };

/** WhatsApp's own limits, enforced by the validator and the builder. */
export const WHATSAPP_LIMITS = {
  buttons: 3,
  buttonTitle: 20,
  menuRows: 10,
  menuRowTitle: 24,
  menuRowDescription: 72,
  menuButtonLabel: 20,
  body: 1024,
};

export type GraphProblem = { nodeId?: string; message: string };

const VARIABLE = /^[a-z][a-z0-9_]{0,39}$/;

/** Problems that would stop a bot from working. A bot can only go live with none. */
export function validateBotGraph(graph: BotGraph): GraphProblem[] {
  const problems: GraphProblem[] = [];
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  const ids = new Set(nodes.map((n) => n.id));

  const starts = nodes.filter((n) => n.type === 'start');
  if (starts.length !== 1) problems.push({ message: 'A bot needs exactly one Start block.' });

  const outgoing = (id: string, handle?: string) =>
    edges.filter((e) => e.source === id && (handle === undefined || (e.sourceHandle ?? 'next') === handle));

  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) problems.push({ message: 'A connection points to a block that no longer exists.' });
  }

  for (const n of nodes) {
    const d = n.data ?? {};
    const name = d.label || n.type;
    const textTooLong = (d.text ?? '').length > WHATSAPP_LIMITS.body;
    if (textTooLong) problems.push({ nodeId: n.id, message: `${name}: message is over ${WHATSAPP_LIMITS.body} characters.` });

    switch (n.type) {
      case 'start':
      case 'message':
      case 'save_lead':
        if (n.type === 'message' && !d.text?.trim()) problems.push({ nodeId: n.id, message: `${name}: add the message text.` });
        if (n.type === 'start' && !outgoing(n.id).length) problems.push({ nodeId: n.id, message: 'Connect the Start block to the first step.' });
        break;
      case 'buttons':
      case 'menu': {
        const opts = d.options ?? [];
        const max = n.type === 'buttons' ? WHATSAPP_LIMITS.buttons : WHATSAPP_LIMITS.menuRows;
        const titleMax = n.type === 'buttons' ? WHATSAPP_LIMITS.buttonTitle : WHATSAPP_LIMITS.menuRowTitle;
        if (!d.text?.trim()) problems.push({ nodeId: n.id, message: `${name}: add the question text.` });
        if (!opts.length) problems.push({ nodeId: n.id, message: `${name}: add at least one option.` });
        if (opts.length > max) problems.push({ nodeId: n.id, message: `${name}: WhatsApp allows at most ${max} options here.` });
        for (const o of opts) {
          if (!o.title?.trim()) problems.push({ nodeId: n.id, message: `${name}: every option needs a title.` });
          else if (o.title.length > titleMax) problems.push({ nodeId: n.id, message: `${name}: "${o.title}" is over ${titleMax} characters.` });
          if (!outgoing(n.id, o.id).length) problems.push({ nodeId: n.id, message: `${name}: connect "${o.title || 'option'}" to a next step.` });
        }
        if (new Set(opts.map((o) => o.title.trim().toLowerCase())).size !== opts.length) {
          problems.push({ nodeId: n.id, message: `${name}: option titles must be different.` });
        }
        if (n.type === 'menu' && (d.buttonLabel ?? '').length > WHATSAPP_LIMITS.menuButtonLabel) {
          problems.push({ nodeId: n.id, message: `${name}: menu button label is over ${WHATSAPP_LIMITS.menuButtonLabel} characters.` });
        }
        break;
      }
      case 'ask':
        if (!d.text?.trim()) problems.push({ nodeId: n.id, message: `${name}: add the question.` });
        if (!d.variable || !VARIABLE.test(d.variable)) {
          problems.push({ nodeId: n.id, message: `${name}: name where the answer is saved, using lowercase letters, numbers and _ (e.g. full_name).` });
        }
        if (!outgoing(n.id, 'next').length) problems.push({ nodeId: n.id, message: `${name}: connect it to a next step.` });
        break;
      case 'condition':
        if (!(d.rules ?? []).length) problems.push({ nodeId: n.id, message: `${name}: add at least one rule.` });
        if (!outgoing(n.id, 'true').length || !outgoing(n.id, 'false').length) {
          problems.push({ nodeId: n.id, message: `${name}: connect both the Yes and No exits.` });
        }
        for (const r of d.rules ?? []) {
          if (r.operator === 'matches') {
            try {
              new RegExp(r.value ?? '');
            } catch {
              problems.push({ nodeId: n.id, message: `${name}: "${r.value}" is not a valid pattern.` });
            }
          }
        }
        break;
      case 'ai_agent':
        if (!d.instructions?.trim()) problems.push({ nodeId: n.id, message: `${name}: tell the agent what it should do.` });
        for (const a of d.customActions ?? []) {
          if (!/^[a-z][a-z0-9_]{1,39}$/.test(a.name)) problems.push({ nodeId: n.id, message: `${name}: action "${a.name}" needs a name like check_order.` });
          if (!/^https:\/\//.test(a.url)) problems.push({ nodeId: n.id, message: `${name}: action "${a.name}" must use an https:// URL.` });
        }
        break;
      case 'goto':
        if (!d.targetNodeId || !ids.has(d.targetNodeId)) problems.push({ nodeId: n.id, message: `${name}: choose which block to go to.` });
        break;
      case 'switch_bot':
        if (!d.targetBotId) problems.push({ nodeId: n.id, message: `${name}: choose which bot to go to.` });
        break;
      default:
        break;
    }
  }
  return problems;
}

/** Fills {{variable}} placeholders from collected answers; unknown ones become blank. */
export function fillVariables(text: string, vars: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([a-z][a-z0-9_.]*)\s*\}\}/gi, (_, key: string) => {
    const value = vars[key.toLowerCase()];
    return value === undefined || value === null ? '' : String(value);
  });
}
