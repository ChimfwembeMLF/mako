import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, MarkerType,
  addEdge, useEdgesState, useNodesState, useReactFlow,
  type Connection, type Edge, type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AlertTriangle, ArrowLeft, Loader2, MessageCircle, PanelLeftClose, PanelLeftOpen, Plus, Power, Save, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { whatsappBotsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { NODE_META, nodeTypes, type BotFlowNode } from '@/components/whatsapp/bot-builder/nodes';
import { Inspector } from '@/components/whatsapp/bot-builder/Inspector';
import { Simulator } from '@/components/whatsapp/bot-builder/Simulator';
import type { BotGraph, BotNodeData, BotNodeType, GraphProblem, WhatsappBot } from '@/components/whatsapp/bot-builder/types';

const DRAG_TYPE = 'application/mako-bot-block';
const PALETTE: BotNodeType[] = ['message', 'buttons', 'menu', 'ask', 'condition', 'ai_agent', 'save_lead', 'handoff', 'goto', 'switch_bot', 'end'];

const DEFAULT_DATA: Partial<Record<BotNodeType, BotNodeData>> = {
  buttons: { text: 'What would you like to do?', options: [{ id: 'opt_a', title: 'Option A' }, { id: 'opt_b', title: 'Option B' }] },
  menu: { text: 'Choose an option:', buttonLabel: 'Options', options: [{ id: 'opt_1', title: 'First option' }] },
  ask: { text: "What's your name?", variable: 'full_name', validation: 'text' },
  condition: { rules: [{ source: 'message', operator: 'contains', value: '' }] },
  ai_agent: {
    text: 'Hi! How can I help?',
    instructions: 'Answer questions about our products and services. Offer to pass the customer to a person if you cannot help.',
    useKnowledge: true,
    exitKeywords: ['menu'],
    builtInActions: ['save_lead', 'handoff'],
    customActions: [],
  },
};

const edgeStyle = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
  style: { strokeWidth: 2 },
};

const toFlowEdges = (graph: BotGraph): Edge[] =>
  graph.edges.map((e) => ({ ...e, sourceHandle: e.sourceHandle ?? 'next', ...edgeStyle }));

function BuilderInner({ bot: initial }: { bot: WhatsappBot }) {
  const { toast } = useToast();
  const flow = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);

  const [bot, setBot] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [triggers, setTriggers] = useState(initial.triggers.join(', '));
  const [isDefault, setIsDefault] = useState(initial.isDefault);
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<BotFlowNode>(initial.graph.nodes as BotFlowNode[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toFlowEdges(initial.graph));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<'inspector' | 'test' | null>(null);
  const [problems, setProblems] = useState<GraphProblem[]>([]);
  const [otherBots, setOtherBots] = useState<Array<{ id: string; name: string; status: string }>>([]);

  useEffect(() => {
    whatsappBotsApi
      .list(initial.tenantId, initial.workspaceId ?? undefined)
      .then((list) => setOtherBots(list.filter((b) => b.id !== initial.id).map((b) => ({ id: b.id, name: b.name, status: b.status }))))
      .catch(() => setOtherBots([]));
  }, [initial.id, initial.tenantId, initial.workspaceId]);
  const [showProblems, setShowProblems] = useState(false);
  const [dirty, setDirty] = useState(false);
  // Icon-only palette by default below extra-wide screens, to leave room for the canvas.
  const [paletteOpen, setPaletteOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1536);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const selected = nodes.find((n) => n.id === selectedId) ?? null;
  const variables = useMemo(
    () => Array.from(new Set(nodes.filter((n) => n.type === 'ask' && n.data.variable).map((n) => n.data.variable!))),
    [nodes],
  );

  const markDirty = () => setDirty(true);

  // The Start block can't be deleted.
  const onNodesChange = useCallback((changes: NodeChange<BotFlowNode>[]) => {
    const allowed = changes.filter((c) => !(c.type === 'remove' && nodes.find((n) => n.id === c.id)?.type === 'start'));
    if (allowed.some((c) => c.type !== 'select' && c.type !== 'dimensions')) markDirty();
    onNodesChangeBase(allowed);
  }, [nodes, onNodesChangeBase]);

  const onConnect = useCallback((c: Connection) => {
    markDirty();
    const handle = c.sourceHandle ?? 'next';
    // Each exit leads to exactly one next step.
    setEdges((eds) => addEdge(
      { ...c, sourceHandle: handle, id: `e-${c.source}-${handle}-${c.target}`, ...edgeStyle },
      eds.filter((e) => !(e.source === c.source && (e.sourceHandle ?? 'next') === handle)),
    ));
  }, [setEdges]);

  const addNode = useCallback((type: BotNodeType, position?: { x: number; y: number }) => {
    const rect = wrapper.current?.getBoundingClientRect();
    const at = position ?? flow.screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? 800) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? 600) / 2,
    });
    const id = `${type}_${Math.random().toString(36).slice(2, 8)}`;
    const data: BotNodeData = { label: NODE_META[type].title, ...(DEFAULT_DATA[type] ?? {}) };
    // Fresh option ids per block, so two copies never share connection points.
    if (data.options) data.options = data.options.map((o) => ({ ...o, id: `opt_${Math.random().toString(36).slice(2, 8)}` }));
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), { id, type, position: at, data, selected: true }]);
    setSelectedId(id);
    setPanel('inspector');
    markDirty();
  }, [flow, setNodes]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData(DRAG_TYPE) as BotNodeType;
    if (!type || !NODE_META[type]) return;
    addNode(type, flow.screenToFlowPosition({ x: e.clientX - 128, y: e.clientY - 24 }));
  }, [addNode, flow]);

  const updateSelected = (patch: Partial<BotNodeData>) => {
    if (!selectedId) return;
    markDirty();
    setNodes((ns) => ns.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n)));
    // Removing an option also removes the connection leaving it.
    if (patch.options) {
      const keep = new Set(patch.options.map((o) => o.id));
      setEdges((es) => es.filter((e) => e.source !== selectedId || keep.has(e.sourceHandle ?? 'next')));
    }
  };

  const deleteSelected = () => {
    if (!selectedId || selected?.type === 'start') return;
    setNodes((ns) => ns.filter((n) => n.id !== selectedId));
    setEdges((es) => es.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
    setPanel(null);
    markDirty();
  };

  const currentGraph = useCallback((): BotGraph => ({
    nodes: nodes.map((n) => {
      const { problems: _omit, ...data } = n.data;
      return { id: n.id, type: n.type as BotNodeType, position: n.position, data };
    }),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? 'next' })),
  }), [nodes, edges]);

  const applyProblems = (list: GraphProblem[]) => {
    setProblems(list);
    const byNode = new Map<string, string[]>();
    for (const p of list) if (p.nodeId) byNode.set(p.nodeId, [...(byNode.get(p.nodeId) ?? []), p.message]);
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, problems: byNode.get(n.id) } })));
  };

  const save = useCallback(async (): Promise<GraphProblem[] | null> => {
    setSaving(true);
    try {
      const res = await whatsappBotsApi.update(bot.id, {
        name,
        triggers: triggers.split(',').map((t) => t.trim()).filter(Boolean),
        isDefault,
        graph: currentGraph(),
      });
      setBot(res.bot);
      setTriggers(res.bot.triggers.join(', '));
      applyProblems(res.problems);
      setDirty(false);
      if (bot.status === 'live' && res.bot.status === 'draft') {
        toast({ title: 'Bot taken offline', description: 'Your changes left problems to fix before it can go live again.', variant: 'destructive' });
      } else {
        toast({ title: 'Saved', description: res.problems.length ? `${res.problems.length} thing${res.problems.length === 1 ? '' : 's'} to fix before going live.` : undefined });
      }
      return res.problems;
    } catch (err) {
      toast({ title: 'Could not save', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
      return null;
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot.id, bot.status, name, triggers, isDefault, currentGraph, toast]);

  const goLive = async () => {
    setPublishing(true);
    try {
      const found = await save();
      if (found === null) return;
      if (found.length) {
        setShowProblems(true);
        toast({ title: 'Fix these first', description: 'The bot stays a draft until every problem is fixed.', variant: 'destructive' });
        return;
      }
      setBot(await whatsappBotsApi.publish(bot.id));
      toast({ title: 'Bot is live', description: isDefault ? 'It answers every message that no other bot claims.' : 'It answers its trigger keywords.' });
    } catch (err) {
      toast({ title: 'Could not go live', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  const takeOffline = async () => {
    setBot(await whatsappBotsApi.unpublish(bot.id));
    toast({ title: 'Bot is now a draft', description: 'It no longer answers customers.' });
  };

  // Ctrl/⌘+S saves; warn before leaving with unsaved changes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onLeave);
    };
  }, [save, dirty]);

  const focusNode = (id?: string) => {
    if (!id) return;
    const n = nodes.find((x) => x.id === id);
    if (!n) return;
    setSelectedId(id);
    setPanel('inspector');
    void flow.setCenter(n.position.x + 128, n.position.y + 60, { zoom: 1.1, duration: 300 });
  };

  const live = bot.status === 'live';

  return (
    // Fills the space under the app's top bar and breadcrumb.
    <div className="flex h-[calc(100dvh-9.5rem)] min-h-[520px] flex-col overflow-hidden rounded-2xl border border-border bg-card">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Button asChild variant="ghost" size="icon" className="h-9 w-9" aria-label="Back to bots">
          <Link to="/whatsapp/bots"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <Input
          aria-label="Bot name"
          value={name}
          onChange={(e) => { setName(e.target.value); markDirty(); }}
          className="h-9 w-44 border-transparent font-semibold hover:border-border focus-visible:border-input"
        />
        <span className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
          live ? 'bg-green-600/10 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground',
        )}>
          <span className={cn('h-1.5 w-1.5 rounded-full', live ? 'bg-green-600' : 'bg-muted-foreground')} />
          {live ? 'Live' : 'Draft'}
        </span>

        <div className="flex min-w-[220px] flex-1 items-center gap-2">
          <Label htmlFor="bot-triggers" className="shrink-0 text-xs text-muted-foreground">Keywords</Label>
          <Input
            id="bot-triggers"
            value={triggers}
            placeholder={isDefault ? 'Optional for the default bot' : 'e.g. order, track'}
            onChange={(e) => { setTriggers(e.target.value); markDirty(); }}
            className="h-9"
          />
        </div>
        <label htmlFor="bot-default" className="flex items-center gap-1.5 text-xs" title="Answers every message that no other live bot's keywords match">
          <Switch id="bot-default" checked={isDefault} onCheckedChange={(v) => { setIsDefault(v); markDirty(); }} />
          <Star className={cn('h-3.5 w-3.5', isDefault ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground')} /> Default
        </label>

        <div className="ml-auto flex items-center gap-2">
          {problems.length > 0 && (
            <div className="relative">
              <Button variant="outline" size="sm" className="h-9 gap-1.5 border-destructive/40 text-destructive" onClick={() => setShowProblems((v) => !v)} aria-expanded={showProblems}>
                <AlertTriangle className="h-4 w-4" /> {problems.length}
              </Button>
              {showProblems && (
                <ul className="absolute right-0 top-11 z-20 w-80 space-y-1 rounded-xl border border-border bg-popover p-2 text-sm shadow-lg">
                  {problems.map((p, i) => (
                    <li key={i}>
                      <button type="button" className="w-full rounded-md px-2 py-1.5 text-left hover:bg-muted" onClick={() => { focusNode(p.nodeId); setShowProblems(false); }}>
                        {p.message}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <Button variant={panel === 'test' ? 'secondary' : 'outline'} size="sm" className="h-9 gap-1.5" onClick={() => setPanel(panel === 'test' ? null : 'test')}>
            <MessageCircle className="h-4 w-4" /> Test
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {dirty ? 'Save' : 'Saved'}
          </Button>
          {live ? (
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => void takeOffline()}>
              <Power className="h-4 w-4" /> Take offline
            </Button>
          ) : (
            <Button size="sm" className="h-9 gap-1.5" onClick={() => void goLive()} disabled={publishing}>
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />} Go live
            </Button>
          )}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* Palette: full list, or a slim icon strip to leave room for the canvas */}
        <nav
          aria-label="Blocks"
          className={cn(
            'hidden shrink-0 flex-col overflow-y-auto border-r border-border md:flex',
            paletteOpen ? 'w-52 p-3' : 'w-14 items-center px-2 py-3',
          )}
        >
          <div className={cn('mb-1 flex items-center', paletteOpen ? 'justify-between px-1' : 'justify-center')}>
            {paletteOpen && <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Drag onto the canvas</p>}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPaletteOpen((v) => !v)}
              aria-label={paletteOpen ? 'Collapse blocks' : 'Expand blocks'}
              title={paletteOpen ? 'Collapse' : 'Show block names'}
            >
              {paletteOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </Button>
          </div>
          {PALETTE.map((type) => {
            const meta = NODE_META[type];
            const Icon = meta.icon;
            return (
              <button
                key={type}
                type="button"
                draggable
                title={paletteOpen ? undefined : `${meta.title}: ${meta.hint}`}
                aria-label={meta.title}
                onDragStart={(e) => { e.dataTransfer.setData(DRAG_TYPE, type); e.dataTransfer.effectAllowed = 'move'; }}
                onClick={() => addNode(type)}
                className={cn(
                  'flex cursor-grab rounded-lg border border-transparent text-left hover:border-border hover:bg-muted/50 active:cursor-grabbing',
                  paletteOpen ? 'w-full items-start gap-2 px-2 py-2' : 'mb-1 h-10 w-10 items-center justify-center',
                )}
              >
                <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white', paletteOpen && 'mt-0.5', meta.accent)}><Icon className="h-3.5 w-3.5" /></span>
                {paletteOpen && (
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{meta.title}</span>
                    <span className="block text-[11px] leading-tight text-muted-foreground">{meta.hint}</span>
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Canvas */}
        <div ref={wrapper} className="relative min-w-0 flex-1" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={(c) => { if (c.some((x) => x.type === 'remove')) markDirty(); onEdgesChange(c); }}
            onConnect={onConnect}
            onNodeClick={(_, n) => { setSelectedId(n.id); setPanel('inspector'); }}
            onPaneClick={() => { setSelectedId(null); if (panel === 'inspector') setPanel(null); }}
            deleteKeyCode={['Backspace', 'Delete']}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.2}
          >
            <Background gap={20} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!hidden lg:!block" nodeStrokeWidth={3} />
          </ReactFlow>

          {/* Adding blocks on small screens, where the palette is hidden */}
          <div className="absolute left-3 top-3 md:hidden">
            <Select value="" onValueChange={(v) => addNode(v as BotNodeType)}>
              <SelectTrigger className="h-9 w-40 bg-card"><Plus className="mr-1 h-4 w-4" /><SelectValue placeholder="Add block" /></SelectTrigger>
              <SelectContent>
                {PALETTE.map((t) => <SelectItem key={t} value={t}>{NODE_META[t].title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Right panel: overlays the canvas on smaller screens */}
        {panel && (
          <div className="absolute inset-y-0 right-0 z-10 w-full max-w-sm shadow-xl 2xl:static 2xl:w-[22rem] 2xl:max-w-none 2xl:shadow-none">
            {panel === 'inspector' && selected ? (
              <Inspector
                key={selected.id}
                node={selected}
                nodes={nodes}
                bots={otherBots}
                variables={variables}
                onChange={updateSelected}
                onDelete={deleteSelected}
                onClose={() => { setPanel(null); setSelectedId(null); }}
              />
            ) : panel === 'test' ? (
              <Simulator botId={bot.id} graph={currentGraph()} onClose={() => setPanel(null)} />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WhatsappBotBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const [bot, setBot] = useState<WhatsappBot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    whatsappBotsApi.get(id).then(setBot).catch((e) => setError(e instanceof Error ? e.message : 'Could not load bot'));
  }, [id]);

  if (error) {
    return (
      <div className="space-y-3 p-8 text-center">
        <p className="text-destructive">{error}</p>
        <Button asChild variant="outline"><Link to="/whatsapp/bots">Back to bots</Link></Button>
      </div>
    );
  }
  if (!bot) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading bot…</div>;
  }
  return (
    <ReactFlowProvider>
      <BuilderInner bot={bot} />
    </ReactFlowProvider>
  );
}
