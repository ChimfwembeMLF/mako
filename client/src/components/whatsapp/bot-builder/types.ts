/** Mirrors api/src/modules/whatsapp/bots/whatsapp-bot.types.ts. */
export type BotNodeType =
  | 'start' | 'message' | 'buttons' | 'menu' | 'ask' | 'condition'
  | 'ai_agent' | 'save_lead' | 'handoff' | 'goto' | 'switch_bot' | 'end';

export type BotOption = { id: string; title: string; description?: string };
export type ConditionRule = { source: string; operator: 'equals' | 'contains' | 'starts_with' | 'is_set' | 'matches'; value?: string };
export type AgentCustomAction = { name: string; description: string; url: string; parameters: string[]; secret?: string; /** A secret is saved on the server (it is never sent back). */ hasSecret?: boolean };

export type BotNodeData = {
  label?: string;
  text?: string;
  imageUrl?: string;
  options?: BotOption[];
  buttonLabel?: string;
  variable?: string;
  validation?: 'text' | 'email' | 'phone' | 'number';
  retryText?: string;
  rules?: ConditionRule[];
  instructions?: string;
  useKnowledge?: boolean;
  exitKeywords?: string[];
  builtInActions?: Array<'save_lead' | 'handoff' | 'end_conversation'>;
  customActions?: AgentCustomAction[];
  targetNodeId?: string;
  targetBotId?: string;
  targetBotName?: string;
  keepAnswers?: boolean;
  /** Builder-only: problems reported by the server for this block. */
  problems?: string[];
};

export type BotGraphNode = { id: string; type: BotNodeType; position: { x: number; y: number }; data: BotNodeData };
export type BotGraphEdge = { id: string; source: string; target: string; sourceHandle?: string | null };
export type BotGraph = { nodes: BotGraphNode[]; edges: BotGraphEdge[] };
export type GraphProblem = { nodeId?: string; message: string };

export type WhatsappBot = {
  id: string;
  tenantId: string;
  workspaceId?: string | null;
  name: string;
  description?: string | null;
  status: 'draft' | 'live';
  isDefault: boolean;
  triggers: string[];
  graph: BotGraph;
  publishedAt?: string | null;
  updated_at: string;
};

export type OutboundMessage =
  | { kind: 'text'; body: string }
  | { kind: 'buttons'; body: string; buttons: Array<{ id: string; title: string }> }
  | { kind: 'list'; body: string; buttonLabel: string; sections: Array<{ title?: string; rows: Array<{ id: string; title: string; description?: string }> }> };

export type BotSessionState = {
  mode: 'bot';
  botId: string;
  nodeId: string | null;
  vars: Record<string, unknown>;
  agentHistory: Array<{ role: string; content: string }>;
  handoffUntil?: string;
};

export type SimulateResult = {
  messages: OutboundMessage[];
  state: BotSessionState;
  ended: boolean;
  handoff: boolean;
  lead?: { name?: string; email?: string; notes?: string };
  trace: string[];
  agentActions: Array<{ name: string; ok: boolean; detail: string }>;
  problems: GraphProblem[];
};

export const WHATSAPP_LIMITS = { buttons: 3, buttonTitle: 20, menuRows: 10, menuRowTitle: 24, menuRowDescription: 72, menuButtonLabel: 20, body: 1024 };
