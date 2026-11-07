import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Bot, FileStack, List, Loader2, MoreHorizontal, Plus, Star, UserPlus, Workflow } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import { whatsappBotsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { WhatsappBot } from '@/components/whatsapp/bot-builder/types';

type Template = 'blank' | 'menu' | 'agent' | 'lead_capture' | 'from_menu_bot';

const TEMPLATES: Array<{ key: Template; title: string; hint: string; icon: typeof Bot }> = [
  { key: 'agent', title: 'AI agent', hint: 'Chats naturally, answers from your documents, saves leads and hands off to a person.', icon: Bot },
  { key: 'menu', title: 'Menu', hint: 'A list of options, each with its own answer.', icon: List },
  { key: 'lead_capture', title: 'Lead capture', hint: 'Asks for name, need and email, then saves the lead.', icon: UserPlus },
  { key: 'from_menu_bot', title: 'Convert my menu bot', hint: 'Turns your current menu bot into an editable flow.', icon: FileStack },
  { key: 'blank', title: 'Blank', hint: 'Start from an empty canvas.', icon: Workflow },
];

export default function WhatsappBotsPage() {
  const { tenant } = useTenant();
  const { activeWorkspace } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();
  const tenantId = tenant?.id ?? '';
  const workspaceId = activeWorkspace ?? undefined;

  const [bots, setBots] = useState<WhatsappBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<Template>('agent');
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      setBots(await whatsappBotsApi.list(tenantId, workspaceId));
    } catch (err) {
      toast({ title: 'Could not load bots', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tenantId, workspaceId, toast]);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setCreating(true);
    try {
      const fallback = TEMPLATES.find((t) => t.key === template)?.title ?? 'New bot';
      const bot = await whatsappBotsApi.create({ tenantId, workspaceId, name: name.trim() || fallback, template });
      navigate(`/whatsapp/bots/${bot.id}`);
    } catch (err) {
      toast({ title: 'Could not create bot', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const act = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      toast({ title: success });
      await load();
    } catch (err) {
      toast({ title: 'That didn’t work', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    }
  };

  const live = bots.filter((b) => b.status === 'live');
  const defaultLive = live.find((b) => b.isDefault);

  return (
    <PageContainer>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/whatsapp" className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> WhatsApp
          </Link>
          <h1 className="font-display text-2xl font-bold">Bots</h1>
          <p className="text-sm text-muted-foreground">Build conversations by dragging blocks. Several bots can be live at once.</p>
        </div>
        <Button onClick={() => { setName(''); setTemplate('agent'); setOpen(true); }} className="gap-1.5"><Plus className="h-4 w-4" /> New bot</Button>
      </div>

      <Card className="border-border/60">
        <CardContent className="grid gap-3 p-4 text-sm sm:grid-cols-3">
          <p><span className="font-semibold">Keywords pick the bot.</span> <span className="text-muted-foreground">A message that starts with a live bot's keyword (e.g. “order”) starts that bot.</span></p>
          <p><span className="font-semibold">The default bot answers the rest.</span> <span className="text-muted-foreground">{defaultLive ? `Right now that's “${defaultLive.name}”.` : 'No default bot is live yet.'}</span></p>
          <p><span className="font-semibold">Hand-offs pause bots.</span> <span className="text-muted-foreground">After a hand-off, bots stay quiet with that customer for 24 hours.</span></p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
      ) : bots.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/15 text-[#128C7E]"><Workflow className="h-6 w-6" /></span>
            <p className="font-semibold">No bots yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">Start with an AI agent that answers from your documents, or convert your current menu bot.</p>
            <Button onClick={() => setOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Create your first bot</Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {bots.map((b) => (
            <li key={b.id}>
              <Card className="h-full border-border/60 transition-shadow hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/whatsapp/bots/${b.id}`} className="min-w-0 hover:underline">
                      <p className="flex items-center gap-1.5 truncate font-semibold">
                        {b.isDefault && <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-500" aria-label="Default bot" />}
                        {b.name}
                      </p>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-8 w-8" aria-label={`More for ${b.name}`}><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild><Link to={`/whatsapp/bots/${b.id}`}>Edit</Link></DropdownMenuItem>
                        {b.status === 'live'
                          ? <DropdownMenuItem onClick={() => void act(() => whatsappBotsApi.unpublish(b.id), 'Bot is now a draft')}>Take offline</DropdownMenuItem>
                          : <DropdownMenuItem onClick={() => void act(() => whatsappBotsApi.publish(b.id), 'Bot is live')}>Go live</DropdownMenuItem>}
                        {!b.isDefault && <DropdownMenuItem onClick={() => void act(() => whatsappBotsApi.update(b.id, { isDefault: true }), 'Default bot changed')}>Make default</DropdownMenuItem>}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => { if (window.confirm(`Delete “${b.name}”? This can't be undone.`)) void act(() => whatsappBotsApi.remove(b.id), 'Bot deleted'); }}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <span className={cn(
                    'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                    b.status === 'live' ? 'bg-green-600/10 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground',
                  )}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', b.status === 'live' ? 'bg-green-600' : 'bg-muted-foreground')} />
                    {b.status === 'live' ? 'Live' : 'Draft'}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {b.triggers.length
                      ? b.triggers.map((t) => <span key={t} className="rounded border border-border px-1.5 py-0.5 font-mono text-xs">{t}</span>)
                      : <span className="text-xs text-muted-foreground">{b.isDefault ? 'Answers every message' : 'No keywords yet'}</span>}
                  </div>
                  <p className="mt-auto text-xs text-muted-foreground">
                    {b.graph.nodes.length} block{b.graph.nodes.length === 1 ? '' : 's'} · edited {formatDistanceToNow(new Date(b.updated_at), { addSuffix: true })}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New bot</DialogTitle>
            <DialogDescription>Pick a starting point. You can change everything in the builder.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Starting point">
            {TEMPLATES.map((t) => {
              const Icon = t.icon;
              const on = template === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setTemplate(t.key)}
                  className={cn('flex gap-3 rounded-xl border p-3 text-left transition-colors', on ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border hover:bg-muted/50')}
                >
                  <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', on ? 'text-primary' : 'text-muted-foreground')} />
                  <span>
                    <span className="block text-sm font-semibold">{t.title}</span>
                    <span className="block text-xs text-muted-foreground">{t.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-bot-name">Name</Label>
            <Input id="new-bot-name" value={name} placeholder={TEMPLATES.find((t) => t.key === template)?.title} onChange={(e) => setName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void create()} disabled={creating}>
              {creating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Create and open
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
