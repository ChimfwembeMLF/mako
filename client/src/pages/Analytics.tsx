import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Eye, MousePointer, FileText, Sparkles, ArrowUp, ArrowDown, Loader2, ThumbsUp, MessageCircle, Share2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { contentItemsApi, contentPublicationsApi, leadsApi, analyticsApi, type TopPerformingPost } from "@/lib/api";
import { platformOf } from "@/lib/platforms";
import { Link } from "react-router-dom";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import { useTenant } from "@/hooks/useTenant";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const COLORS = ["hsl(15, 90%, 55%)", "hsl(220, 60%, 50%)", "hsl(280, 70%, 55%)", "hsl(150, 60%, 45%)", "hsl(45, 90%, 50%)", "hsl(340, 70%, 55%)"];

const channelLabels: Record<string, string> = {
  facebook: "Facebook",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  twitter: "X / Twitter",
  email: "Email",
  ad_copy: "Ad Copy",
};

const Analytics = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { activeWorkspace, workspaceVersion } = useWorkspace();
  const { toast } = useToast();
  const [contentStats, setContentStats] = useState({ total: 0, published: 0, draft: 0, approved: 0 });
  const [channelBreakdown, setChannelBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [leadStats, setLeadStats] = useState({ total: 0, hot: 0, warm: 0, cold: 0 });
  const [loading, setLoading] = useState(true);
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<{ title: string; description: string; trend: string }[]>([]);
  const [topPosts, setTopPosts] = useState<TopPerformingPost[]>([]);
  const [syncingEngagement, setSyncingEngagement] = useState(false);
  const [pageInsights, setPageInsights] = useState<any[]>([]);
  const [aiReport, setAiReport] = useState<any>(null);

  useEffect(() => {
    if (!user || !activeWorkspace) return;
    loadAllData();
  }, [user, tenant?.id, activeWorkspace, workspaceVersion]);

  const loadAllData = async () => {
    if (!user) return;
    setLoading(true);
    await Promise.all([loadContentStats(), loadLeadStats(), loadWeeklyTrend(), loadTopPosts(), loadPageInsights()]);
    setLoading(false);
  };

  const loadPageInsights = async () => {
    if (!activeWorkspace) return;
    try {
      const data = await analyticsApi.getInsights(30, activeWorkspace);
      setPageInsights(Array.isArray(data) ? data : []);
    } catch {
      setPageInsights([]);
    }
  };

  const loadTopPosts = async () => {
    if (!tenant?.id || !activeWorkspace) return;
    try {
      const posts = await contentPublicationsApi.topPerforming(tenant.id, 5, activeWorkspace);
      setTopPosts(Array.isArray(posts) ? posts : []);
    } catch {
      setTopPosts([]);
    }
  };

  const syncEngagement = async () => {
    if (!tenant?.id || !activeWorkspace) return;
    setSyncingEngagement(true);
    try {
      const { updated } = await contentPublicationsApi.syncEngagement(tenant.id, activeWorkspace);
      await loadTopPosts();
      toast({
        title: "Engagement synced",
        description: updated > 0 ? `Updated metrics for ${updated} post${updated !== 1 ? "s" : ""}.` : "All posts are up to date.",
      });
    } catch (err: unknown) {
      toast({
        title: "Sync failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSyncingEngagement(false);
    }
  };

  const loadContentStats = async () => {
    if (!user || !activeWorkspace) return;
    try {
      const all = await contentItemsApi.findAll(tenant?.id, { workspaceId: activeWorkspace });
      const list = (Array.isArray(all) ? all : []).filter(
        (d: Record<string, unknown>) => d.userId === user.id,
      );
      setContentStats({
        total: list.length,
        published: list.filter((d) => d.status === "published").length,
        draft: list.filter((d) => d.status === "draft").length,
        approved: list.filter((d) => d.status === "approved").length,
      });

      const byType: Record<string, number> = {};
      list.forEach((d) => {
        const type = String(d.contentType ?? "");
        const label = channelLabels[type] || type;
        byType[label] = (byType[label] || 0) + 1;
      });
      setChannelBreakdown(Object.entries(byType).map(([name, value]) => ({ name, value })));

      const byStatus: Record<string, number> = {};
      list.forEach((d) => {
        const status = String(d.status ?? "unknown");
        byStatus[status] = (byStatus[status] || 0) + 1;
      });
      setStatusBreakdown(Object.entries(byStatus).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value })));
    } catch {
      /* empty stats */
    }
  };

  const loadLeadStats = async () => {
    if (!user || !activeWorkspace) return;
    try {
      const all = await leadsApi.findAll(tenant?.id, activeWorkspace);
      const list = (Array.isArray(all) ? all : []).filter(
        (d: Record<string, unknown>) => d.userId === user.id,
      );
      setLeadStats({
        total: list.length,
        hot: list.filter((d) => d.classification === "hot").length,
        warm: list.filter((d) => d.classification === "warm").length,
        cold: list.filter((d) => d.classification === "cold").length,
      });
    } catch {
      /* empty stats */
    }
  };

  const loadWeeklyTrend = async () => {
    if (!user || !activeWorkspace) return;
    try {
      const all = await contentItemsApi.findAll(tenant?.id, { workspaceId: activeWorkspace });
      const data = (Array.isArray(all) ? all : [])
        .filter((d: Record<string, unknown>) => d.userId === user.id)
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

    if (data.length > 0) {
      // Group by day (last 14 days)
      const days: Record<string, { total: number; published: number }> = {};
      const now = new Date();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        days[key] = { total: 0, published: 0 };
      }
      data.forEach((item) => {
        const d = new Date(String(item.created_at));
        const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (days[key]) {
          days[key].total++;
          if (item.status === "published") days[key].published++;
        }
      });
      setWeeklyData(Object.entries(days).map(([day, stats]) => ({ day, ...stats })));
    }
    } catch {
      /* empty trend */
    }
  };

  const generateSuggestions = async () => {
    setGeneratingSuggestions(true);
    try {
      const data = await analyticsApi.getAiReport(activeWorkspace);
      if (data) {
        setAiReport(data);
      } else {
        setSuggestions(getDefaultSuggestions());
      }
    } catch {
      setSuggestions(getDefaultSuggestions());
    } finally {
      setGeneratingSuggestions(false);
    }
  };

  const getDefaultSuggestions = () => {
    const s = [];
    if (contentStats.draft > contentStats.published) {
      s.push({ title: "Publish your drafts", description: `You have ${contentStats.draft} drafts waiting. Approve and publish them to increase your content output.`, trend: "up" });
    }
    if (channelBreakdown.length < 3) {
      s.push({ title: "Diversify your channels", description: "You're only active on a few channels. Try generating content for LinkedIn, Instagram, or Email to reach more audiences.", trend: "up" });
    }
    if (leadStats.hot > 0) {
      s.push({ title: "Follow up on hot leads", description: `You have ${leadStats.hot} hot leads. Prioritize outreach to convert them into customers.`, trend: "up" });
    }
    if (contentStats.total === 0) {
      s.push({ title: "Start generating content", description: "Head to the Content Engine and create your first piece of AI-powered marketing content.", trend: "up" });
    }
    if (s.length === 0) {
      s.push({ title: "Keep up the momentum", description: "Your content strategy is on track. Consider scheduling content for consistent publishing.", trend: "up" });
    }
    return s;
  };

  return (
    <div className="w-full space-y-5 sm:space-y-6 pb-8 sm:pb-10 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shrink-0">
          <BarChart3 className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold font-display">Analytics & Insights</h1>
          <p className="text-muted-foreground text-sm">Real data from your content and leads</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Content Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Content", value: contentStats.total, icon: FileText, color: "text-foreground" },
              { label: "Published", value: contentStats.published, icon: TrendingUp, color: "text-green-600" },
              { label: "Approved", value: contentStats.approved, icon: Eye, color: "text-primary" },
              { label: "Drafts", value: contentStats.draft, icon: MousePointer, color: "text-muted-foreground" },
            ].map((s) => (
              <Card key={s.label} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                  </div>
                  <p className={`text-2xl font-bold font-display ${s.color}`}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Lead Stats */}
          {leadStats.total > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Leads", value: leadStats.total, color: "text-foreground" },
                { label: "Hot Leads", value: leadStats.hot, color: "text-destructive" },
                { label: "Warm Leads", value: leadStats.warm, color: "text-orange-500" },
                { label: "Cold Leads", value: leadStats.cold, color: "text-blue-500" },
              ].map((s) => (
                <Card key={s.label} className="border-border/50">
                  <CardContent className="p-4 text-center">
                    <p className={`text-2xl font-bold font-display ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {weeklyData.length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display">Content Created (Last 14 Days)</CardTitle>
                </CardHeader>
                <CardContent className="min-w-0">
                  <div className="w-full min-w-0">
                  <ResponsiveContainer width="100%" height={250} minWidth={0}>
                    <BarChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="total" name="Created" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="published" name="Published" fill={COLORS[3]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {pageInsights.length > 0 && (
              <Card className="border-border/50 col-span-1 lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display">Follower Growth</CardTitle>
                </CardHeader>
                <CardContent className="min-w-0">
                  <div className="w-full min-w-0">
                  <ResponsiveContainer width="100%" height={250} minWidth={0}>
                    <LineChart data={pageInsights}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tickFormatter={(val) => new Date(val).toLocaleDateString("en-US", { month: "short", day: "numeric" })} tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip labelFormatter={(val) => new Date(val).toLocaleDateString()} />
                      <Line type="monotone" dataKey="followersCount" name="Followers" stroke={COLORS[1]} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="reach" name="Reach" stroke={COLORS[2]} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {channelBreakdown.length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display">Content by Channel</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center min-w-0">
                  <ResponsiveContainer width="100%" height={250} minWidth={0}>
                    <PieChart>
                      <Pie data={channelBreakdown} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {channelBreakdown.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {statusBreakdown.length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display">Content by Status</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center min-w-0">
                  <ResponsiveContainer width="100%" height={250} minWidth={0}>
                    <PieChart>
                      <Pie data={statusBreakdown} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {statusBreakdown.map((_, i) => (
                          <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {contentStats.total === 0 && channelBreakdown.length === 0 && (
            <Card className="border-border/50">
              <CardContent className="p-8 text-center text-muted-foreground">
                No data yet. Generate some content in the Content Engine to see your analytics here.
              </CardContent>
            </Card>
          )}

          {/* Top traction posts — used by AI for content scoring */}
          {tenant && (
            <Card className="border-border/50">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Top performing posts
                </CardTitle>
                <Button size="sm" variant="outline" onClick={syncEngagement} disabled={syncingEngagement}>
                  {syncingEngagement ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                  Sync engagement
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {topPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Publish posts to social platforms, then sync engagement to see what captured traction.
                    The AI uses these insights when generating new content.
                  </p>
                ) : (
                  topPosts.map((post) => {
                    const platform = platformOf(post.platform);
                    const PlatformIcon = platform.icon;
                    return (
                      <div
                        key={post.id}
                        className="flex items-start gap-3 rounded-lg border border-border/50 p-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <PlatformIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate">
                              {post.publishedTitle || post.publishedContent.slice(0, 80) || "Untitled post"}
                            </p>
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              score {post.engagementScore}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {post.likeCount > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <ThumbsUp className="h-3 w-3" /> {post.likeCount}
                              </span>
                            )}
                            {post.commentCount > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <MessageCircle className="h-3 w-3" /> {post.commentCount}
                              </span>
                            )}
                            {post.shareCount > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <Share2 className="h-3 w-3" /> {post.shareCount}
                              </span>
                            )}
                            {post.viewCount > 0 && (
                              <span>{post.viewCount.toLocaleString()} views</span>
                            )}
                          </div>
                        </div>
                        <Link
                          to={`/content/${post.contentId}`}
                          className="text-xs text-primary hover:underline shrink-0"
                        >
                          View
                        </Link>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          )}

          {/* AI Suggestions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Optimization Suggestions
              </h2>
              <Button size="sm" variant="outline" onClick={generateSuggestions} disabled={generatingSuggestions}>
                {generatingSuggestions ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
                {generatingSuggestions ? "Analyzing..." : "Get AI Suggestions"}
              </Button>
            </div>
            {aiReport ? (
              <Card className="border-border/50 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-5 border-b border-border/50 bg-muted/20">
                    <p className="text-sm leading-relaxed">{aiReport.summary}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-border/50">
                    <div className="p-5 space-y-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2 text-green-600">
                        <ArrowUp className="h-4 w-4" /> Top Performing Traits
                      </h3>
                      <ul className="space-y-2">
                        {aiReport.topPerformingTraits?.map((trait: string, i: number) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                            {trait}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-5 space-y-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2 text-destructive">
                        <ArrowDown className="h-4 w-4" /> Underperforming Traits
                      </h3>
                      <ul className="space-y-2">
                        {aiReport.underperformingTraits?.map((trait: string, i: number) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                            {trait}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="p-5 border-t border-border/50 bg-primary/5">
                    <h3 className="text-sm font-semibold mb-3">Actionable Recommendations</h3>
                    <div className="space-y-2">
                      {aiReport.contentRecommendations?.map((rec: string, i: number) => (
                        <div key={i} className="flex gap-3 text-sm">
                          <span className="text-primary font-bold">{i + 1}.</span>
                          <p>{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {aiReport.optimalPostingTimes?.length > 0 && (
                    <div className="p-5 border-t border-border/50">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        Optimal Posting Times
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {aiReport.optimalPostingTimes.map((time: string, i: number) => (
                          <Badge key={i} variant="secondary">{time}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : suggestions.length > 0 ? (
              suggestions.map((s, i) => (
                <Card key={i} className="border-border/50 hover:shadow-card transition-shadow">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${s.trend === "up" ? "bg-green-100" : "bg-destructive/10"}`}>
                      {s.trend === "up" ? <ArrowUp className="h-4 w-4 text-green-600" /> : <ArrowDown className="h-4 w-4 text-destructive" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{s.title}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">{s.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="border-border/50">
                <CardContent className="p-6 text-center text-muted-foreground text-sm">
                  Click "Get AI Suggestions" to analyze your data and get personalized optimization tips.
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;
