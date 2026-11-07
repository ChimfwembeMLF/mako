import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import {
  Play, MessageSquare, MousePointerClick, List, HelpCircle, GitBranch, Bot, UserPlus,
  Headset, CornerDownRight, CircleStop, AlertTriangle, Waypoints,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BotNodeData, BotNodeType } from './types';

export type BotFlowNode = Node<BotNodeData, BotNodeType>;

export const NODE_META: Record<BotNodeType, {
  title: string;
  hint: string;
  icon: typeof Play;
  /** Accent colour for the block's icon tile. */
  accent: string;
}> = {
  start: { title: 'Start', hint: 'Where every conversation begins', icon: Play, accent: 'bg-emerald-600' },
  message: { title: 'Message', hint: 'Send text or an image link', icon: MessageSquare, accent: 'bg-sky-600' },
  buttons: { title: 'Buttons', hint: 'Up to 3 quick-reply buttons', icon: MousePointerClick, accent: 'bg-violet-600' },
  menu: { title: 'Menu', hint: 'A list of up to 10 options', icon: List, accent: 'bg-violet-600' },
  ask: { title: 'Ask a question', hint: 'Save the answer for later', icon: HelpCircle, accent: 'bg-amber-600' },
  condition: { title: 'Condition', hint: 'Branch on an answer', icon: GitBranch, accent: 'bg-orange-600' },
  ai_agent: { title: 'AI agent', hint: 'Chats, answers and takes actions', icon: Bot, accent: 'bg-fuchsia-600' },
  save_lead: { title: 'Save lead', hint: 'Store answers on the lead', icon: UserPlus, accent: 'bg-teal-600' },
  handoff: { title: 'Hand to a person', hint: 'Stop the bot; your team replies', icon: Headset, accent: 'bg-rose-600' },
  goto: { title: 'Go to', hint: 'Jump to another block', icon: CornerDownRight, accent: 'bg-slate-600' },
  switch_bot: { title: 'Go to another bot', hint: 'Continue in a different bot', icon: Waypoints, accent: 'bg-indigo-600' },
  end: { title: 'End', hint: 'Finish the conversation', icon: CircleStop, accent: 'bg-slate-600' },
};

const handleClass = '!h-3 !w-3 !border-2 !border-card !bg-muted-foreground';

/** One exit of a block (an option, a Yes/No branch…) with its own connection point. */
function OutRow({ id, label, tone = 'default' }: { id: string; label: string; tone?: 'default' | 'yes' | 'no' }) {
  return (
    <div className="relative flex items-center justify-end gap-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs">
      <span className={cn('truncate', tone === 'yes' && 'text-green-700 dark:text-green-400', tone === 'no' && 'text-red-700 dark:text-red-400')}>{label}</span>
      <Handle type="source" position={Position.Right} id={id} className={cn(handleClass, '!-right-[19px]')} />
    </div>
  );
}

function BotNodeView({ data, type, selected }: NodeProps<BotFlowNode>) {
  const meta = NODE_META[type];
  const Icon = meta.icon;
  const problems = data.problems ?? [];
  const preview =
    type === 'ai_agent' ? data.instructions :
    type === 'ask' ? `${data.text ?? ''}${data.variable ? `  → {{${data.variable}}}` : ''}` :
    type === 'condition' ? (data.rules ?? []).map((r) => `${r.source} ${r.operator.replace('_', ' ')} ${r.value ?? ''}`).join(' and ') :
    type === 'goto' ? (data.targetNodeId ? 'Jumps to another block' : 'Choose a block') :
    type === 'switch_bot' ? (data.targetBotId ? `Continues in “${data.targetBotName ?? 'another bot'}”` : 'Choose a bot') :
    data.text;

  return (
    <div
      className={cn(
        'w-64 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow',
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-border',
        problems.length > 0 && !selected && 'border-destructive ring-2 ring-destructive/20',
      )}
    >
      {type !== 'start' && <Handle type="target" position={Position.Top} className={handleClass} />}
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <span className={cn('flex h-6 w-6 items-center justify-center rounded-md text-white', meta.accent)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{meta.title}</span>
          <span className="block truncate text-sm font-semibold">{data.label || meta.title}</span>
        </span>
        {problems.length > 0 && <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-label={`${problems.length} problem(s)`} />}
      </div>

      {(preview || type === 'start') && (
        <div className="px-3 py-2">
          <p className="line-clamp-3 text-xs text-muted-foreground">
            {type === 'start' ? 'Runs when this bot is triggered' : preview}
          </p>
        </div>
      )}

      {(type === 'buttons' || type === 'menu') && (
        <div className="space-y-1 px-3 pb-3">
          {(data.options ?? []).length === 0 && <p className="text-xs text-muted-foreground">Add options in the panel →</p>}
          {(data.options ?? []).map((o) => <OutRow key={o.id} id={o.id} label={o.title || 'Untitled option'} />)}
        </div>
      )}
      {type === 'condition' && (
        <div className="space-y-1 px-3 pb-3">
          <OutRow id="true" label="Yes" tone="yes" />
          <OutRow id="false" label="No" tone="no" />
        </div>
      )}
      {type === 'ai_agent' && (
        <div className="space-y-1 px-3 pb-3">
          <OutRow id="exit" label="Customer leaves / done" />
          <OutRow id="handoff" label="Wants a person" />
        </div>
      )}

      {['start', 'message', 'ask', 'save_lead'].includes(type) && (
        <Handle type="source" position={Position.Bottom} id="next" className={handleClass} />
      )}
    </div>
  );
}

const BotNode = memo(BotNodeView);

export const nodeTypes = Object.fromEntries(
  (Object.keys(NODE_META) as BotNodeType[]).map((t) => [t, BotNode]),
);
