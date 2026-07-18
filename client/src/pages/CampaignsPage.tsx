import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Sparkles, Loader2, Calendar, Trash2, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { useFieldEnhance } from '@/hooks/useFieldEnhance';
import { SuggestedField } from '@/components/form/SuggestedField';
import { contentCampaignsApi } from '@/lib/api';
import { MultiPlatformPicker } from '@/components/content/MultiPlatformPicker';
import { platformOf } from '@/lib/platforms';
import { sanitizeHtml } from '@/lib/sanitize';

interface Campaign {
  id: string;
  name: string;
  theme?: string;
  goal?: string;
  summary?: string;
  postCount: number;
  startDate?: string;
  status: string;
  platforms?: string[];
  created_at: string;
}

function CampaignCard({
  campaign,
  tenantId,
  onDeleted,
}: {
  campaign: Campaign;
  tenantId: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [posts, setPosts] = useState<Record<string, unknown>[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const { toast } = useToast();

  async function toggle() {
    if (!open && posts.length === 0) {
      setLoadingPosts(true);
      try {
        const data = await contentCampaignsApi.getOne(campaign.id, tenantId);
        setPosts(data.posts ?? []);
      } catch {
        toast({ title: 'Could not load posts', variant: 'destructive' });
      }
      setLoadingPosts(false);
    }
    setOpen((v) => !v);
  }

  async function handleDelete() {
    try {
      await contentCampaignsApi.remove(campaign.id, tenantId);
      toast({ title: 'Campaign deleted' });
      onDeleted();
    } catch (e: unknown) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">{campaign.name}</h3>
            <Badge variant="secondary" className="text-[10px] capitalize">{campaign.status}</Badge>
            <Badge variant="outline" className="text-[10px]">{campaign.postCount} posts</Badge>
          </div>
          {campaign.theme && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{campaign.theme}</p>
          )}
          {campaign.summary && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{campaign.summary}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
            {campaign.startDate && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Starts {new Date(campaign.startDate).toLocaleDateString()}
              </span>
            )}
            <span>{new Date(campaign.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggle}>
            {loadingPosts ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t bg-muted/20 px-4 py-3 space-y-2">
          {posts.length === 0 && !loadingPosts ? (
            <p className="text-xs text-muted-foreground">No posts found.</p>
          ) : (
            posts.map((p) => {
              const platform = Array.isArray(p.platforms) ? String(p.platforms[0] ?? '') : '';
              const plat = platform ? platformOf(platform) : null;
              const Icon = plat?.icon;
              return (
                <div key={String(p.id)} className="rounded-lg border bg-background p-3 text-sm">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-xs">{String(p.title ?? 'Untitled')}</span>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {plat && Icon && (
                        <span className="inline-flex items-center gap-1">
                          <Icon size={11} style={{ color: plat.color }} />
                          {plat.label}
                        </span>
                      )}
                      {p.scheduledDate && (
                        <span>{String(p.scheduledDate).split('T')[0]}</span>
                      )}
                    </div>
                  </div>
                  <div
                    className="text-xs text-muted-foreground line-clamp-2 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(String(p.content ?? '')) }}
                  />
                </div>
              );
            })
          )}
          <Button asChild variant="outline" size="sm" className="w-full mt-2">
            <Link to="/scheduler">
              View in Scheduler <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default function CampaignsPage() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { activeWorkspace, workspaceVersion } = useWorkspace();
  const { toast } = useToast();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [theme, setTheme] = useState('');
  const [postCount, setPostCount] = useState('7');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [platforms, setPlatforms] = useState<string[]>(['linkedin', 'facebook', 'instagram']);

  const { enhanceField, enhancingKey } = useFieldEnhance({
    form: 'campaign',
    tenantId: tenant?.id,
  });

  useEffect(() => {
    if (!tenant || !activeWorkspace) return;
    loadCampaigns();
  }, [tenant?.id, activeWorkspace, workspaceVersion]);

  async function loadCampaigns() {
    if (!tenant || !activeWorkspace) return;
    setLoading(true);
    try {
      const rows = await contentCampaignsApi.list(tenant.id, activeWorkspace);
      setCampaigns(
        (Array.isArray(rows) ? rows : []).map((r) => ({
          id: String(r.id),
          name: String(r.name ?? ''),
          theme: r.theme != null ? String(r.theme) : undefined,
          goal: r.goal != null ? String(r.goal) : undefined,
          summary: r.summary != null ? String(r.summary) : undefined,
          postCount: Number(r.postCount ?? 0),
          startDate: r.startDate != null ? String(r.startDate) : undefined,
          status: String(r.status ?? 'active'),
          platforms: r.platforms as string[] | undefined,
          created_at: String(r.created_at ?? ''),
        })),
      );
    } catch {
      setCampaigns([]);
    }
    setLoading(false);
  }

  async function handleGenerate() {
    if (!tenant || !activeWorkspace) {
      toast({ title: 'Select a workspace', description: 'Choose one from the top navbar.', variant: 'destructive' });
      return;
    }
    if (!theme.trim()) {
      toast({ title: 'Enter a campaign theme', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const result = await contentCampaignsApi.generate({
        tenantId: tenant.id,
        workspaceId: activeWorkspace,
        theme: theme.trim(),
        name: name.trim() || undefined,
        goal: goal.trim() || undefined,
        platforms,
        postCount: parseInt(postCount, 10),
        startDate,
      });
      toast({
        title: 'Campaign generated!',
        description: `${result.posts?.length ?? 0} posts scheduled. Review them in the Scheduler.`,
      });
      setTheme('');
      setGoal('');
      setName('');
      await loadCampaigns();
    } catch (e: unknown) {
      toast({
        title: 'Generation failed',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="w-full space-y-5 sm:space-y-6 pb-8 sm:pb-10 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/30 to-primary/10 border border-primary/30 flex items-center justify-center">
            <Megaphone size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">AI Campaigns</h1>
            <p className="text-sm text-muted-foreground">
              Generate a full multi-day content series from one theme
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Generator */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden lg:col-span-1">
          <div className="px-5 py-4 border-b bg-muted/30">
            <h2 className="font-semibold text-sm">Create campaign</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              AI plans posts across days and platforms using your Brand Brain
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <Label>Campaign name</Label>
              <SuggestedField
                type="input"
                value={name}
                onChange={setName}
                placeholder="e.g. Summer Product Launch"
                onEnhance={() => enhanceField('name', name, setName)}
                enhancing={enhancingKey === 'name'}
              />
            </div>
            <div className="space-y-2">
              <Label>Campaign theme *</Label>
              <SuggestedField
                type="textarea"
                value={theme}
                onChange={setTheme}
                placeholder="What is this campaign about? e.g. Launching our new delivery app for farmers in Zambia"
                onEnhance={() => enhanceField('theme', theme, setTheme)}
                enhancing={enhancingKey === 'theme'}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Goal</Label>
              <SuggestedField
                type="input"
                value={goal}
                onChange={setGoal}
                placeholder="e.g. Drive sign-ups, build awareness, promote offer"
                onEnhance={() => enhanceField('goal', goal, setGoal)}
                enhancing={enhancingKey === 'goal'}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Number of posts</Label>
                <Select value={postCount} onValueChange={setPostCount}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[3, 5, 7, 10, 14].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} posts</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Platforms</Label>
              <MultiPlatformPicker values={platforms} onChange={setPlatforms} />
            </div>
            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={generating || !theme.trim()}
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating campaign…</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Generate AI campaign</>
              )}
            </Button>
          </div>
        </div>

        {/* Campaign list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Your campaigns</h2>
            <span className="text-xs text-muted-foreground">{campaigns.length} total</span>
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 p-10 text-center">
              <Megaphone className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">No campaigns yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Fill in the form and generate your first AI campaign
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  tenantId={tenant!.id}
                  onDeleted={loadCampaigns}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
