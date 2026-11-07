import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { NODE_META, type BotFlowNode } from './nodes';
import { WHATSAPP_LIMITS, type AgentCustomAction, type BotNodeData, type ConditionRule } from './types';

const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className={cn('text-[11px] tabular-nums', value.length > max ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
      {value.length}/{max}
    </span>
  );
}

function Field({ label, htmlFor, hint, counter, children }: {
  label: string; htmlFor?: string; hint?: string; counter?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-xs font-semibold">{label}</Label>
        {counter}
      </div>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Comma-separated words edited as one text box (keywords, parameters). */
function ListInput({ id, value, onChange, placeholder }: { id: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <Input
      id={id}
      defaultValue={value.join(', ')}
      placeholder={placeholder}
      onBlur={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
    />
  );
}

export function Inspector({ node, nodes, bots, variables, onChange, onDelete, onClose }: {
  node: BotFlowNode;
  nodes: BotFlowNode[];
  /** Other bots in this workspace, for "Go to another bot". */
  bots: Array<{ id: string; name: string; status: string }>;
  /** Answers saved by Ask blocks, offered for {{placeholders}} and conditions. */
  variables: string[];
  onChange: (patch: Partial<BotNodeData>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const d = node.data;
  const meta = NODE_META[node.type];
  const Icon = meta.icon;
  const id = (suffix: string) => `insp-${node.id}-${suffix}`;

  const textField = (label: string, max = WHATSAPP_LIMITS.body, hint?: string) => (
    <Field label={label} htmlFor={id('text')} counter={<Counter value={d.text ?? ''} max={max} />} hint={hint}>
      <Textarea id={id('text')} rows={4} value={d.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
      {variables.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {variables.map((v) => (
            <button
              key={v}
              type="button"
              className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-muted"
              onClick={() => onChange({ text: `${d.text ?? ''}{{${v}}}` })}
              title={`Insert ${v}`}
            >
              {`{{${v}}}`}
            </button>
          ))}
        </div>
      )}
    </Field>
  );

  const options = d.options ?? [];
  const isMenu = node.type === 'menu';
  const maxOptions = isMenu ? WHATSAPP_LIMITS.menuRows : WHATSAPP_LIMITS.buttons;
  const titleMax = isMenu ? WHATSAPP_LIMITS.menuRowTitle : WHATSAPP_LIMITS.buttonTitle;
  const setOption = (i: number, patch: Partial<(typeof options)[number]>) =>
    onChange({ options: options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const moveOption = (i: number, by: number) => {
    const next = [...options];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item);
    onChange({ options: next });
  };

  const rules = d.rules ?? [];
  const setRule = (i: number, patch: Partial<ConditionRule>) => onChange({ rules: rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  const actions = d.customActions ?? [];
  const setAction = (i: number, patch: Partial<AgentCustomAction>) => onChange({ customActions: actions.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  const builtIns = new Set(d.builtInActions ?? []);
  const toggleBuiltIn = (name: 'save_lead' | 'handoff' | 'end_conversation', on: boolean) => {
    const next = new Set(builtIns);
    if (on) next.add(name);
    else next.delete(name);
    onChange({ builtInActions: Array.from(next) });
  };

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden border-l border-border bg-card" aria-label="Block settings">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-md text-white', meta.accent)}><Icon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{meta.title}</p>
          <p className="truncate text-xs text-muted-foreground">{meta.hint}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close settings"><X className="h-4 w-4" /></Button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {(d.problems ?? []).length > 0 && (
          <ul className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            {d.problems!.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}

        {node.type !== 'start' && (
          <Field label="Block name" htmlFor={id('label')} hint="Only you see this, on the canvas.">
            <Input id={id('label')} value={d.label ?? ''} placeholder={meta.title} onChange={(e) => onChange({ label: e.target.value })} />
          </Field>
        )}

        {node.type === 'start' && (
          <p className="text-sm text-muted-foreground">
            The bot starts here when a customer sends one of its trigger keywords, or any message if this is the default bot. Set both in the top bar.
          </p>
        )}

        {node.type === 'message' && (
          <>
            {textField('Message')}
            <Field label="Image link (optional)" htmlFor={id('img')} hint="A public https link, sent after the text.">
              <Input id={id('img')} value={d.imageUrl ?? ''} placeholder="https://…" onChange={(e) => onChange({ imageUrl: e.target.value })} />
            </Field>
          </>
        )}

        {(node.type === 'buttons' || node.type === 'menu') && (
          <>
            {textField('Question')}
            {isMenu && (
              <Field label="Menu button label" htmlFor={id('btn')} counter={<Counter value={d.buttonLabel ?? ''} max={WHATSAPP_LIMITS.menuButtonLabel} />}>
                <Input id={id('btn')} value={d.buttonLabel ?? ''} placeholder="Options" onChange={(e) => onChange({ buttonLabel: e.target.value })} />
              </Field>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Options <span className="font-normal text-muted-foreground">({options.length}/{maxOptions})</span></span>
                <Button
                  type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs"
                  disabled={options.length >= maxOptions}
                  onClick={() => onChange({ options: [...options, { id: newId('opt'), title: '' }] })}
                >
                  <Plus className="mr-1 h-3 w-3" /> Add
                </Button>
              </div>
              {options.map((o, i) => (
                <div key={o.id} className="space-y-1.5 rounded-lg border border-border p-2">
                  <div className="flex items-center gap-1">
                    <Input
                      aria-label={`Option ${i + 1} title`}
                      value={o.title}
                      placeholder={`Option ${i + 1}`}
                      onChange={(e) => setOption(i, { title: e.target.value })}
                      className="h-8 text-sm"
                    />
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" disabled={i === 0} onClick={() => moveOption(i, -1)} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></Button>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" disabled={i === options.length - 1} onClick={() => moveOption(i, 1)} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></Button>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => onChange({ options: options.filter((_, j) => j !== i) })} aria-label="Remove option"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="flex justify-end"><Counter value={o.title} max={titleMax} /></div>
                  {isMenu && (
                    <Input
                      aria-label={`Option ${i + 1} description`}
                      value={o.description ?? ''}
                      placeholder="Description (optional)"
                      onChange={(e) => setOption(i, { description: e.target.value })}
                      className="h-8 text-xs"
                    />
                  )}
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">Drag from each option's dot on the canvas to the step it leads to.</p>
            </div>
          </>
        )}

        {node.type === 'ask' && (
          <>
            {textField('Question')}
            <Field label="Save the answer as" htmlFor={id('var')} hint="Use it later as {{name}}, e.g. full_name or email.">
              <Input
                id={id('var')}
                value={d.variable ?? ''}
                placeholder="full_name"
                className="font-mono text-sm"
                onChange={(e) => onChange({ variable: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40) })}
              />
            </Field>
            <Field label="Expect" htmlFor={id('val')}>
              <Select value={d.validation ?? 'text'} onValueChange={(v) => onChange({ validation: v as BotNodeData['validation'] })}>
                <SelectTrigger id={id('val')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Any text</SelectItem>
                  <SelectItem value="email">An email address</SelectItem>
                  <SelectItem value="phone">A phone number</SelectItem>
                  <SelectItem value="number">A number</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="If the answer doesn't fit (optional)" htmlFor={id('retry')}>
              <Input id={id('retry')} value={d.retryText ?? ''} placeholder="Sorry, please try again." onChange={(e) => onChange({ retryText: e.target.value })} />
            </Field>
          </>
        )}

        {node.type === 'condition' && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Goes down <span className="font-semibold text-green-700 dark:text-green-400">Yes</span> when all rules match, otherwise <span className="font-semibold text-red-700 dark:text-red-400">No</span>.</p>
            {rules.map((r, i) => (
              <div key={i} className="space-y-1.5 rounded-lg border border-border p-2">
                <div className="flex gap-1">
                  <Select value={r.source} onValueChange={(v) => setRule(i, { source: v })}>
                    <SelectTrigger className="h-8 text-xs" aria-label="Check"><SelectValue placeholder="Check…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="message">Last message</SelectItem>
                      <SelectItem value="last_choice">Last option chosen</SelectItem>
                      {variables.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => onChange({ rules: rules.filter((_, j) => j !== i) })} aria-label="Remove rule"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                <Select value={r.operator} onValueChange={(v) => setRule(i, { operator: v as ConditionRule['operator'] })}>
                  <SelectTrigger className="h-8 text-xs" aria-label="Operator"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">is exactly</SelectItem>
                    <SelectItem value="contains">contains</SelectItem>
                    <SelectItem value="starts_with">starts with</SelectItem>
                    <SelectItem value="is_set">has been answered</SelectItem>
                    <SelectItem value="matches">matches pattern (advanced)</SelectItem>
                  </SelectContent>
                </Select>
                {r.operator !== 'is_set' && (
                  <Input aria-label="Value" className="h-8 text-xs" value={r.value ?? ''} placeholder="Value" onChange={(e) => setRule(i, { value: e.target.value })} />
                )}
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => onChange({ rules: [...rules, { source: 'message', operator: 'contains', value: '' }] })}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add rule
            </Button>
          </div>
        )}

        {node.type === 'ai_agent' && (
          <>
            {textField('Opening message', WHATSAPP_LIMITS.body, 'Sent when the agent takes over.')}
            <Field label="What the agent should do" htmlFor={id('instr')} hint="Its role, what it can help with, and what to collect.">
              <Textarea id={id('instr')} rows={6} value={d.instructions ?? ''} onChange={(e) => onChange({ instructions: e.target.value })} />
            </Field>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div>
                <Label htmlFor={id('kb')} className="text-xs font-semibold">Answer from your documents</Label>
                <p className="text-[11px] text-muted-foreground">Uses files uploaded to the chatbot knowledge base.</p>
              </div>
              <Switch id={id('kb')} checked={d.useKnowledge !== false} onCheckedChange={(v) => onChange({ useKnowledge: v })} />
            </div>
            <Field label="Words that leave the agent" htmlFor={id('exit')} hint="Comma separated. Sends the customer down the “leaves” exit.">
              <ListInput id={id('exit')} value={d.exitKeywords ?? []} onChange={(v) => onChange({ exitKeywords: v })} placeholder="menu, stop" />
            </Field>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-xs font-semibold">Actions it can take</legend>
              {([
                ['save_lead', 'Save the customer as a lead'],
                ['handoff', 'Hand over to a person'],
                ['end_conversation', 'End the conversation'],
              ] as const).map(([key, text]) => (
                <label key={key} htmlFor={id(key)} className="flex items-center gap-2 text-sm">
                  <Checkbox id={id(key)} checked={builtIns.has(key)} onCheckedChange={(v) => toggleBuiltIn(key, v === true)} />
                  {text}
                </label>
              ))}
            </fieldset>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Actions in your systems</span>
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs"
                  onClick={() => onChange({ customActions: [...actions, { name: '', description: '', url: 'https://', parameters: [] }] })}>
                  <Plus className="mr-1 h-3 w-3" /> Add
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                e.g. look up an order or book a slot. Mako POSTs <span className="font-mono">{'{ action, args, customer }'}</span> to your https URL and reads the reply.
              </p>
              {actions.map((a, i) => (
                <div key={i} className="space-y-1.5 rounded-lg border border-border p-2">
                  <div className="flex gap-1">
                    <Input aria-label="Action name" className="h-8 font-mono text-xs" value={a.name} placeholder="check_order"
                      onChange={(e) => setAction(i, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40) })} />
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => onChange({ customActions: actions.filter((_, j) => j !== i) })} aria-label="Remove action"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                  <Input aria-label="When to use it" className="h-8 text-xs" value={a.description} placeholder="When to use it, e.g. customer asks where their order is" onChange={(e) => setAction(i, { description: e.target.value })} />
                  <Input aria-label="URL" className="h-8 font-mono text-xs" value={a.url} placeholder="https://your-system.com/hooks/order" onChange={(e) => setAction(i, { url: e.target.value })} />
                  <ListInput id={id(`params-${i}`)} value={a.parameters} onChange={(v) => setAction(i, { parameters: v })} placeholder="Details to collect, e.g. order_number" />
                  <div className="flex items-center gap-1.5">
                    <Input
                      aria-label="Secret (optional)"
                      type="password"
                      autoComplete="new-password"
                      className="h-8 text-xs"
                      value={a.secret ?? ''}
                      placeholder={a.hasSecret ? 'Saved. Type to replace it' : 'Secret sent as Bearer token (optional)'}
                      onChange={(e) => setAction(i, { secret: e.target.value })}
                    />
                    {(a.hasSecret || a.secret) && (
                      <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 px-2 text-xs" onClick={() => setAction(i, { secret: '', hasSecret: false })}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {node.type === 'save_lead' && (
          <p className="text-sm text-muted-foreground">
            Updates this customer's lead: <span className="font-mono">full_name</span> (or <span className="font-mono">name</span>) becomes the name, <span className="font-mono">email</span> the email, and every other answer is added to the notes.
          </p>
        )}

        {(node.type === 'handoff' || node.type === 'end') &&
          textField('Message (optional)', WHATSAPP_LIMITS.body, node.type === 'handoff' ? 'The bot then stays quiet for 24 hours so your team can reply from the Inbox.' : undefined)}

        {node.type === 'switch_bot' && (
          <>
            <Field label="Continue in" htmlFor={id('bot')} hint="Can be a draft with no keywords, so it works as a reusable part of other bots.">
              <Select
                value={d.targetBotId ?? ''}
                onValueChange={(v) => onChange({ targetBotId: v, targetBotName: bots.find((b) => b.id === v)?.name })}
              >
                <SelectTrigger id={id('bot')}><SelectValue placeholder="Choose a bot" /></SelectTrigger>
                <SelectContent>
                  {bots.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Create another bot first.</div>}
                  {bots.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}{b.status === 'live' ? ' (live)' : ' (draft)'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div>
                <Label htmlFor={id('keep')} className="text-xs font-semibold">Carry over answers</Label>
                <p className="text-[11px] text-muted-foreground">The next bot can use {'{{full_name}}'} and other answers from this one.</p>
              </div>
              <Switch id={id('keep')} checked={d.keepAnswers !== false} onCheckedChange={(v) => onChange({ keepAnswers: v })} />
            </div>
            <p className="text-xs text-muted-foreground">The customer moves straight on; the next bot replies to the same message.</p>
          </>
        )}

        {node.type === 'goto' && (
          <Field label="Go to" htmlFor={id('goto')}>
            <Select value={d.targetNodeId ?? ''} onValueChange={(v) => onChange({ targetNodeId: v })}>
              <SelectTrigger id={id('goto')}><SelectValue placeholder="Choose a block" /></SelectTrigger>
              <SelectContent>
                {nodes.filter((n) => n.id !== node.id && n.type !== 'start').map((n) => (
                  <SelectItem key={n.id} value={n.id}>{n.data.label || NODE_META[n.type].title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>

      {node.type !== 'start' && (
        <div className="border-t border-border p-3">
          <Button type="button" variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete block
          </Button>
        </div>
      )}
    </aside>
  );
}
