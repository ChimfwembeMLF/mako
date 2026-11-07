import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Trash2, Bot, Plus, Clock, Save, Loader2, Sparkles, CalendarDays, Repeat, CheckCircle2,
  AlertTriangle, MinusCircle, ShieldCheck,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useWorkspaceAutomationConfig, type AutomationRun } from "../../hooks/api/useWorkspaceAutomationConfig";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useTenant } from "@/hooks/useTenant";
import { contentAiApi, queued } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PLATFORMS = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "twitter", label: "X / Twitter" },
  { id: "linkedin", label: "LinkedIn" },
];
const TIMEZONES = [
  "Africa/Lusaka", "Africa/Johannesburg", "Africa/Nairobi", "Africa/Lagos", "Africa/Cairo",
  "Europe/London", "America/New_York", "UTC",
];
const DEFAULT_TIMEZONE = "Africa/Lusaka";

const RUN_STYLE: Record<AutomationRun["status"], { icon: typeof CheckCircle2; className: string; label: string }> = {
  success: { icon: CheckCircle2, className: "text-green-700 dark:text-green-300", label: "Drafts ready" },
  partial: { icon: AlertTriangle, className: "text-amber-700 dark:text-amber-300", label: "Partly done" },
  failed: { icon: AlertTriangle, className: "text-destructive", label: "Failed" },
  skipped: { icon: MinusCircle, className: "text-muted-foreground", label: "Skipped" },
};

/** "Today at 19:00", "Tomorrow at 19:00" or "Mon at 19:00" for the next generation slot. */
function describeNextRun(days: string[], generateAt: string, timeZone: string, lastRunAt?: string | null): string {
  const allowed = days.length ? days : DAYS;
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false, year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  const nowMinutes = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
  const [h, m] = generateAt.split(":").map(Number);
  const target = h * 60 + (m || 0);
  const todayKey = `${parts.year}-${parts.month}-${parts.day}`;
  let ranToday = false;
  if (lastRunAt) {
    const last = Object.fromEntries(fmt.formatToParts(new Date(lastRunAt)).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
    ranToday = `${last.year}-${last.month}-${last.day}` === todayKey;
  }
  const order = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayIdx = order.indexOf(parts.weekday);
  for (let offset = 0; offset < 8; offset++) {
    const day = order[(todayIdx + offset) % 7];
    if (!allowed.includes(day)) continue;
    if (offset === 0 && (ranToday || nowMinutes > target + 5)) continue;
    const when = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : day;
    return `${when} at ${generateAt}`;
  }
  return "No publishing days selected";
}

export function AutomationSettingsTab({ onGenerated, onReviewDrafts }: { onGenerated?: () => void; onReviewDrafts?: () => void }) {
  const { activeWorkspace } = useWorkspace();
  const { tenant } = useTenant();
  const { config, isLoading, updateConfig, refetch } = useWorkspaceAutomationConfig(activeWorkspace);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [isActive, setIsActive] = useState(false);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [generateAt, setGenerateAt] = useState("19:00");
  const [postsPerCycle, setPostsPerCycle] = useState("3");
  const [planAhead, setPlanAhead] = useState("1");
  const [activeDays, setActiveDays] = useState<string[]>([]);
  const [postingTimes, setPostingTimes] = useState<string[]>(["09:00"]);
  const [activePlatforms, setActivePlatforms] = useState<string[]>([]);

  useEffect(() => {
    if (config) {
      setIsActive(config.isActive ?? false);
      setTimezone(config.timezone || DEFAULT_TIMEZONE);
      setGenerateAt(config.generateAt ?? "19:00");
      setPostsPerCycle(String(config.postsPerCycle ?? 3));
      setPlanAhead(String(config.planAheadDays ?? 1));
      setActiveDays(config.publishingDays ?? []);
      setPostingTimes(config.postingTimes?.length ? config.postingTimes : ["09:00"]);
      setActivePlatforms(config.platforms ?? []);
    }
  }, [config]);

  const dirty = useMemo(() => {
    if (!config) return false;
    return (
      isActive !== config.isActive ||
      timezone !== (config.timezone || DEFAULT_TIMEZONE) ||
      generateAt !== config.generateAt ||
      Number(postsPerCycle) !== config.postsPerCycle ||
      Number(planAhead) !== config.planAheadDays ||
      JSON.stringify([...activeDays].sort()) !== JSON.stringify([...(config.publishingDays ?? [])].sort()) ||
      JSON.stringify(postingTimes) !== JSON.stringify(config.postingTimes?.length ? config.postingTimes : ["09:00"]) ||
      JSON.stringify([...activePlatforms].sort()) !== JSON.stringify([...(config.platforms ?? [])].sort())
    );
  }, [config, isActive, timezone, generateAt, postsPerCycle, planAhead, activeDays, postingTimes, activePlatforms]);

  const handleSave = async () => {
    if (activePlatforms.length === 0) {
      toast.error("Pick at least one platform for automated posts.");
      return;
    }
    setIsSaving(true);
    try {
      await updateConfig({
        isActive,
        timezone,
        generateAt,
        postsPerCycle: Math.min(10, Math.max(1, parseInt(postsPerCycle, 10) || 1)),
        planAheadDays: parseInt(planAhead, 10),
        publishingDays: activeDays,
        postingTimes,
        platforms: activePlatforms,
      });
      await refetch();
      toast.success(isActive ? "Automation saved and switched on." : "Automation settings saved.");
    } catch {
      toast.error("Failed to save automation settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateNow = async () => {
    if (!tenant?.id || !activeWorkspace) return;
    if (dirty) await handleSave();
    setIsGenerating(true);
    try {
      const result = await queued(contentAiApi.dailyWorkflow(tenant.id, activeWorkspace));
      const generated = result?.generated ?? 0;
      if (generated > 0) {
        toast.success(`${generated} draft${generated === 1 ? "" : "s"} created. Review and approve them before they publish.`);
        onGenerated?.();
      } else {
        toast.error(result?.errors?.[0]?.replace(/^[^:]+:\s*/, "") ?? "Nothing was generated.");
      }
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate posts.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading && !config) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const runs = config?.recentRuns ?? [];
  const nextRun = describeNextRun(activeDays, generateAt, timezone, config?.lastRunAt);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Daily automation</h2>
            <p className="text-sm text-muted-foreground">
              {isActive
                ? <>Next batch: <span className="font-medium text-foreground">{nextRun}</span> ({timezone}) · {postsPerCycle} post{postsPerCycle === "1" ? "" : "s"}</>
                : "Switched off. Turn it on to write posts for you every publishing day."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Automation on or off" />
            {isActive ? "On" : "Off"}
          </label>
          <Button variant="outline" onClick={handleGenerateNow} disabled={isGenerating || isSaving} className="gap-1.5">
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate now
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Automated posts are always drafts.</span> They land on the calendar as
          {" "}<span className="font-medium text-amber-700 dark:text-amber-300">Needs approval</span> at the times below, and only publish after someone approves them.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-8 pt-6">
            <section className="space-y-4">
              <div>
                <h3 className="flex items-center gap-2 font-semibold"><Clock className="h-4 w-4" /> When to write</h3>
                <p className="mt-1 text-xs text-muted-foreground">Mako writes the batch at this time, ahead of the posting days.</p>
              </div>
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" htmlFor="auto-tz">Time zone</label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger id="auto-tz" className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES]).map((tz) => (
                        <SelectItem key={tz} value={tz}>{tz.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" htmlFor="auto-at">Write at</label>
                  <Input id="auto-at" type="time" value={generateAt} onChange={(e) => setGenerateAt(e.target.value)} className="bg-background" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" htmlFor="auto-count">Posts each time</label>
                  <Input id="auto-count" type="number" min={1} max={10} value={postsPerCycle} onChange={(e) => setPostsPerCycle(e.target.value)} className="bg-background" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" htmlFor="auto-ahead">Plan for</label>
                  <Select value={planAhead} onValueChange={setPlanAhead}>
                    <SelectTrigger id="auto-ahead" className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">The same day</SelectItem>
                      <SelectItem value="1">1 day ahead</SelectItem>
                      <SelectItem value="3">3 days ahead</SelectItem>
                      <SelectItem value="7">1 week ahead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="flex items-center gap-2 font-semibold"><CalendarDays className="h-4 w-4" /> When to post</h3>
                <p className="mt-1 text-xs text-muted-foreground">Drafts are placed on these days and times. Leave all days off to post every day.</p>
              </div>
              <div className="space-y-2">
                <span className="text-xs font-semibold">Publishing days</span>
                <div className="flex rounded-md border border-border/50 bg-muted/40 p-1" role="group" aria-label="Publishing days">
                  {DAYS.map((day) => (
                    <button
                      type="button"
                      key={day}
                      aria-pressed={activeDays.includes(day)}
                      onClick={() => setActiveDays((prev) => toggle(prev, day))}
                      className={cn(
                        "flex-1 rounded py-1.5 text-xs font-medium transition-colors",
                        activeDays.includes(day) ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60",
                      )}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Posting times</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPostingTimes((t) => [...t, "12:00"].sort())} className="h-7 px-2 text-xs">
                    <Plus className="mr-1 h-3 w-3" /> Add time
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {postingTimes.map((time, index) => (
                    <div key={index} className="flex items-center gap-1 rounded-md border border-border/50 bg-muted/20 p-1">
                      <Input
                        type="time"
                        value={time}
                        aria-label={`Posting time ${index + 1}`}
                        onChange={(e) => setPostingTimes((t) => t.map((v, i) => (i === index ? e.target.value : v)).sort())}
                        className="h-8 bg-background text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setPostingTimes((t) => t.filter((_, i) => i !== index))}
                        disabled={postingTimes.length <= 1}
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${time}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="flex items-center gap-2 font-semibold"><Repeat className="h-4 w-4" /> Where to post</h3>
                <p className="mt-1 text-xs text-muted-foreground">Each draft targets all of these. Mako varies the angle between posts.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {PLATFORMS.map((platform) => (
                  <label key={platform.id} htmlFor={`platform-${platform.id}`} className="flex cursor-pointer items-center gap-2 rounded-md border border-border/50 px-3 py-2 text-sm font-medium hover:bg-muted/40">
                    <Checkbox
                      id={`platform-${platform.id}`}
                      checked={activePlatforms.includes(platform.id)}
                      onCheckedChange={() => setActivePlatforms((prev) => toggle(prev, platform.id))}
                    />
                    {platform.label}
                  </label>
                ))}
              </div>
            </section>

            <div className="flex items-center justify-end gap-3 border-t border-border/50 pt-4">
              {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
              <Button onClick={handleSave} disabled={isSaving || !dirty}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save settings
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base">Recent cycles</CardTitle>
            <CardDescription>What each automation run produced.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {runs.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold">No runs yet</p>
                <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">Switch automation on, or press Generate now to try it.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {runs.map((run) => {
                  const style = RUN_STYLE[run.status];
                  const Icon = style.icon;
                  return (
                    <li key={run.at} className="space-y-1 px-5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("flex items-center gap-1.5 text-sm font-semibold", style.className)}>
                          <Icon className="h-4 w-4" /> {style.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(run.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {run.trigger === "manual" ? " · manual" : ""}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{run.message}</p>
                      {run.generated > 0 && run.targetDate && (
                        <p className="text-xs text-muted-foreground">
                          For {new Date(`${run.targetDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {runs.some((r) => r.generated > 0) && onReviewDrafts && (
              <div className="border-t border-border/50 p-4">
                <Button variant="outline" className="w-full" onClick={onReviewDrafts}>Review drafts waiting for approval</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
