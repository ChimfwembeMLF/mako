import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Eye, MousePointer, FileText, Sparkles, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { contentItemsApi, leadsApi } from "@/lib/api";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import { useTenant } from "@/hooks/useTenant";
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
  const { toast } = useToast();
  const [contentStats, setContentStats] = useState({ total: 0, published: 0, draft: 0, approved: 0 });
  const [channelBreakdown, setChannelBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [leadStats, setLeadStats] = useState({ total: 0, hot: 0, warm: 0, cold: 0 });
  const [loading, setLoading] = useState(true);
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<{ title: string; description: string; trend: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    loadAllData();
  }, [user]);

  const loadAllData = async () => {
    if (!user) return;
    setLoading(true);
    await Promise.all([loadContentStats(), loadLeadStats(), loadWeeklyTrend()]);
    setLoading(false);
  };

  const loadContentStats = async () => {
    if (!user) return;
    try {
      const all = await contentItemsApi.findAll();
      const list = (Array.isArray(all) ? all : []).filter(
        (d: Record<string, unknown>) =>
          d.userId === user.id && (!tenant?.id || d.tenantId === tenant.id),
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
    if (!user) return;
    try {
      const all = await leadsApi.findAll();
      const list = (Array.isArray(all) ? all : []).filter(
        (d: Record<string, unknown>) =>
          d.userId === user.id && (!tenant?.id || d.tenantId === tenant.id),
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
    if (!user) return;
    try {
      const all = await contentItemsApi.findAll();
      const data = (Array.isArray(all) ? all : [])
        .filter((d: Record<string, unknown>) =>
          d.userId === user.id && (!tenant?.id || d.tenantId === tenant.id),
        )
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
      const context = `Content stats: ${contentStats.total} total, ${contentStats.published} published, ${contentStats.draft} drafts, ${contentStats.approved} approved. Channels: ${channelBreakdown.map(c => `${c.name}: ${c.value}`).join(", ")}. Leads: ${leadStats.total} total (${leadStats.hot} hot, ${leadStats.warm} warm, ${leadStats.cold} cold).`;

      const { data, error } = await invokeEdgeFunction("generate-content", {
        body: {
          contentType: "ad_copy",
          theme: `ANALYTICS SUGGESTIONS MODE: Based on this data, provide exactly 4 marketing optimization suggestions as a JSON array. Each item must have "title" (short), "description" (1 sentence), and "trend" ("up" or "down"). Data: ${context}. Return ONLY the JSON array, no other text.`,
        },
      });

      if (error) throw error;
      const content = (data as { content?: string } | null)?.content || "";
      // Try to parse JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setSuggestions(parsed);
      } else {
        // Fallback suggestions based on real data
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
          <BarChart3 className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display">Analytics & Insights</h1>
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
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="total" name="Created" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="published" name="Published" fill={COLORS[3]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {channelBreakdown.length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display">Content by Channel</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={250}>
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
                <CardContent className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={250}>
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
            {suggestions.length > 0 ? (
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
