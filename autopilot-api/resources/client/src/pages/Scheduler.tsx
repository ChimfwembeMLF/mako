import { useState, useEffect, useCallback, useRef, DragEvent, useMemo } from "react";
import { Link } from "react-router-dom";
import { sanitizeHtml } from "@/lib/sanitize";
import {
  CalendarClock, Plus, CheckCircle2, XCircle, Send, Facebook, Linkedin, Instagram,
  Twitter, Mail, Megaphone, Zap, Loader2, List, CalendarDays, ChevronLeft, ChevronRight,
  AlertCircle, RotateCcw, Clock, Eye, Youtube,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RichTextEditor from "@/components/RichTextEditor";
import { MediaUpload } from "@/components/MediaUpload";
import { MultiPlatformPicker } from "@/components/content/MultiPlatformPicker";
import { PlatformPreviewPanel } from "@/components/content/PlatformPreviewPanel";
import { PublishPanel } from "@/components/content/PublishPanel";
import type { ContentItem } from "@/components/content/types";
import { buildPlatformPayloads, platformRequiresMedia, instagramHasMedia, type PlatformMediaAttachment, type PlatformPayload } from "@/lib/platforms";
import { resolveRetryPublishArgs, submitPublish, toPublishMediaUrl } from "@/lib/publishContent";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useWorkspace } from "@/hooks/useWorkspace";
import { contentItemsApi } from "@/lib/api";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";

const channelIcons: Record<string, any> = {
  facebook: Facebook, linkedin: Linkedin, instagram: Instagram,
  twitter: Twitter, email: Mail, ad_copy: Megaphone, tiktok: Instagram, youtube: Youtube,
};

const channelLabels: Record<string, string> = {
  facebook: "Facebook", linkedin: "LinkedIn", instagram: "Instagram",
  twitter: "X / Twitter", email: "Email", ad_copy: "Ad", tiktok: "TikTok Video", youtube: "YouTube",
};

const channelColors: Record<string, string> = {
  facebook: "bg-blue-100 text-blue-700 border-blue-200",
  linkedin: "bg-sky-100 text-sky-700 border-sky-200",
  instagram: "bg-pink-100 text-pink-700 border-pink-200",
  twitter: "bg-slate-100 text-slate-700 border-slate-200",
  email: "bg-amber-100 text-amber-700 border-amber-200",
  ad_copy: "bg-purple-100 text-purple-700 border-purple-200",
  tiktok: "bg-black text-white border-gray-400",
  youtube: "bg-red-100 text-red-700 border-red-200",
};

const statusDots: Record<string, string> = {
  draft: "bg-muted-foreground",
  approved: "bg-primary",
  published: "bg-green-500",
  rejected: "bg-destructive",
};

function toLocalDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseScheduleDateFromApi(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value);
  return raw.includes("T") ? raw.split("T")[0] : raw.slice(0, 10);
}

/** Normalize API timetz to HH:mm for time inputs */
function parseTimeForInput(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = String(value).match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function formatTimeDisplay(value: string | null | undefined): string | null {
  const parsed = parseTimeForInput(value);
  if (!parsed) return null;
  const [h, m] = parsed.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatScheduleLabel(date: string | null, time: string | null | undefined): string {
  if (!date) return "Not scheduled";
  const datePart = new Date(`${date}T12:00:00`).toLocaleDateString();
  const timePart = formatTimeDisplay(time);
  return timePart ? `${datePart} at ${timePart}` : datePart;
}

function toApiTime(value: string): string {
  const parsed = parseTimeForInput(value);
  return parsed ? `${parsed}:00` : "09:00:00";
}

interface ScheduledPost {
  id: string;
  content: string;
  content_type: string;
  platforms?: string[]; // Multi-platform support
  title: string | null;
  status: string;
  created_at: string;
  media_url: string | null;
  media_type: string | null;
  campaign_theme: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  publish_failed_reason: string | null;
  published_at: string | null;
  platform_payloads?: Record<string, PlatformPayload>;
  workspace_id?: string;
}

function postToContentItem(post: ScheduledPost): ContentItem {
  return {
    id: post.id,
    title: post.title ?? undefined,
    content: post.content,
    content_type: post.content_type,
    platforms: post.platforms,
    platformPayloads: post.platform_payloads,
    workspaceId: post.workspace_id,
    campaign_theme: post.campaign_theme ?? undefined,
    status: post.status,
    created_at: post.created_at,
  };
}

function getPostPreviewPayloads(post: ScheduledPost): Record<string, PlatformPayload> {
  if (post.platform_payloads && Object.keys(post.platform_payloads).length > 0) {
    return post.platform_payloads;
  }
  const platforms =
    post.platforms && post.platforms.length > 0 ? post.platforms : [post.content_type];
  return buildPlatformPayloads(post.content, post.title ?? "", platforms);
}

const Scheduler = () => {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [view, setView] = useState<"list" | "calendar">("calendar");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["facebook"]);
  const [previewTab, setPreviewTab] = useState("facebook");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [newTitle, setNewTitle] = useState("");
  const [newMedia, setNewMedia] = useState<{ url: string; type: "image" | "video" } | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [runningWorkflow, setRunningWorkflow] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [dragId, setDragId] = useState<string | null>(null);
  const [reschedule, setReschedule] = useState<{
    postId: string;
    date: string;
    time: string;
  } | null>(null);
  const [savingReschedule, setSavingReschedule] = useState(false);
  const [publishItem, setPublishItem] = useState<ContentItem | null>(null);
  const [previewPost, setPreviewPost] = useState<ScheduledPost | null>(null);
  const [queuePreviewTab, setQueuePreviewTab] = useState("facebook");
  const [schedulePayloadOverrides, setSchedulePayloadOverrides] = useState<
    Record<string, PlatformPayload>
  >({});
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { activeWorkspace, workspaceVersion } = useWorkspace();

  const schedulePreviewPayloads = useMemo(() => {
    const baseMedia: PlatformMediaAttachment[] = newMedia
      ? [{ url: newMedia.url, type: newMedia.type }]
      : [];
    return buildPlatformPayloads(newContent, newTitle, selectedPlatforms, baseMedia);
  }, [newContent, newTitle, selectedPlatforms, newMedia]);

  const displaySchedulePayloads = useMemo(() => {
    const merged = { ...schedulePreviewPayloads };
    for (const [platform, payload] of Object.entries(schedulePayloadOverrides)) {
      if (merged[platform]) {
        merged[platform] = { ...merged[platform], ...payload };
      }
    }
    return merged;
  }, [schedulePreviewPayloads, schedulePayloadOverrides]);

  const instagramNeedsMedia = selectedPlatforms.some(
    (p) => platformRequiresMedia(p) && !instagramHasMedia(displaySchedulePayloads[p], newMedia ? 1 : 0),
  );

  useEffect(() => {
    if (user && activeWorkspace) loadPosts();
  }, [user, tenant?.id, activeWorkspace, workspaceVersion]);

  useEffect(() => {
    if (sheetOpen && !newDate) {
      setNewDate(toLocalDateInput(new Date()));
    }
  }, [sheetOpen, newDate]);

  useEffect(() => {
    if (!sheetOpen) {
      setSchedulePayloadOverrides({});
    }
  }, [sheetOpen]);

  const loadPosts = async () => {
    if (!user || !activeWorkspace) return;
    try {
      const all = await contentItemsApi.findAll(tenant?.id, { workspaceId: activeWorkspace });
      const list = (Array.isArray(all) ? all : [])
        .filter((item: Record<string, unknown>) =>
          item.userId === user.id && (!tenant?.id || item.tenantId === tenant.id),
        )
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      setPosts(
        list.map((item: Record<string, unknown>) => ({
          id: String(item.id),
          content: String(item.content ?? ""),
          content_type: String(item.contentType ?? ""),
          platforms: item.platforms as string[] | undefined,
          title: item.title != null ? String(item.title) : null,
          status: String(item.status ?? "draft"),
          created_at: String(item.created_at ?? ""),
          media_url: null,
          media_type: null,
          campaign_theme: item.campaignTheme != null ? String(item.campaignTheme) : null,
          scheduled_date: parseScheduleDateFromApi(item.scheduledDate),
          scheduled_time: item.scheduledTime != null ? String(item.scheduledTime) : null,
          publish_failed_reason: item.publishFailedReason != null ? String(item.publishFailedReason) : null,
          published_at: item.publishedAt != null ? String(item.publishedAt) : null,
          platform_payloads: item.platformPayloads as Record<string, PlatformPayload> | undefined,
          workspace_id: item.workspaceId != null ? String(item.workspaceId) : undefined,
        })),
      );
    } catch {
      setPosts([]);
    }
  };

  const handleRetry = async (id: string) => {
    setRetrying(id);
    try {
      const retryArgs = await resolveRetryPublishArgs(id);
      if (retryArgs.alreadyComplete) {
        toast({
          title: "Already published",
          description: "All platforms for this post were published successfully.",
        });
        loadPosts();
        return;
      }
      await submitPublish(id, retryArgs.platforms, retryArgs.platformPayloads, (t) => toast(t));
      loadPosts();
    } catch (err: any) {
      toast({ title: "Retry failed", description: err.message, variant: "destructive" });
    } finally {
      setRetrying(null);
    }
  };

  const handleSchedule = async () => {
    if (!user || !newContent.trim() || !selectedPlatforms.length || !activeWorkspace) return;
    if (!newDate) {
      toast({ title: "Date required", description: "Pick a date and time for this post.", variant: "destructive" });
      return;
    }
    const baseMedia: PlatformMediaAttachment[] = newMedia
      ? [{ url: newMedia.url, type: newMedia.type }]
      : [];

    const missingMedia = selectedPlatforms.filter(
      (p) => platformRequiresMedia(p) && !instagramHasMedia(displaySchedulePayloads[p], newMedia ? 1 : 0),
    );
    if (missingMedia.length > 0) {
      toast({
        title: "Media required",
        description: `${missingMedia.map((p) => channelLabels[p] ?? p).join(", ")} requires at least one image or video before scheduling.`,
        variant: "destructive",
      });
      return;
    }

    const storedPayloads = Object.fromEntries(
      Object.entries(displaySchedulePayloads).map(([platform, payload]) => [
        platform,
        {
          ...payload,
          media: payload.media?.map((m) => ({
            ...m,
            url: toPublishMediaUrl(m.url),
          })),
        },
      ]),
    );

    try {
      const created = await contentItemsApi.create({
        userId: user.id,
        tenantId: tenant?.id,
        workspaceId: activeWorkspace,
        content: newContent,
        contentType: selectedPlatforms[0],
        platforms: selectedPlatforms,
        platformPayloads: storedPayloads,
        title: newTitle.trim() || `Scheduled for ${formatScheduleLabel(newDate, newTime)}`,
        status: "approved",
        scheduledDate: newDate,
        scheduledTime: toApiTime(newTime || "09:00"),
      } as any);

      const contentId = created?.id ?? created?.data?.id;
      if (newMedia && tenant?.id && contentId) {
        await contentItemsApi.attachMedia(contentId, tenant.id, [
          { url: toPublishMediaUrl(newMedia.url), type: newMedia.type },
        ]);
      }

      toast({
        title: "Scheduled!",
        description: `Post scheduled for ${formatScheduleLabel(newDate, newTime)} on ${selectedPlatforms.length} platform(s).`,
      });
      setSheetOpen(false);
      setNewContent("");
      setNewTitle("");
      setNewMedia(null);
      setSelectedPlatforms(["facebook"]);
      loadPosts();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await contentItemsApi.update(id, { status } as any);
    loadPosts();
  };

  const handlePublish = (post: ScheduledPost) => {
    setPublishItem(postToContentItem(post));
  };

  const openQueuePreview = (post: ScheduledPost) => {
    const platforms =
      post.platforms && post.platforms.length > 0 ? post.platforms : [post.content_type];
    setQueuePreviewTab(platforms[0] ?? "facebook");
    setPreviewPost(post);
  };

  const closePublish = () => setPublishItem(null);

  const handlePublished = () => {
    closePublish();
    loadPosts();
  };

  const handleDailyWorkflow = async () => {
    if (!tenant || !activeWorkspace) {
      toast({ title: "Select a workspace", description: "Choose a workspace from the top navbar.", variant: "destructive" });
      return;
    }
    setRunningWorkflow(true);
    try {
      const { data, error } = await invokeEdgeFunction("daily-content-workflow", {
        body: { tenantId: tenant.id, workspaceId: activeWorkspace },
      });
      if (error) throw error;
      const result = data as { generated?: number; skipped?: number; errors?: string[] } | null;
      const generated = result?.generated ?? 0;
      const skipped = result?.skipped ?? 0;
      const firstError = result?.errors?.[0];
      if (generated === 0 && firstError) {
        throw new Error(firstError.replace(/^[^:]+:\s*/, ""));
      }
      toast({
        title: generated > 0 ? "Workflow complete!" : "Nothing generated",
        description: generated > 0
          ? `Generated ${generated} draft${generated === 1 ? "" : "s"}.${skipped ? ` Skipped ${skipped}.` : ""}`
          : firstError ?? "Complete Brand Brain setup and upgrade to Starter or Pro for daily auto-generate.",
        variant: generated > 0 ? "default" : "destructive",
      });
      if (generated > 0) loadPosts();
    } catch (err: unknown) {
      toast({
        title: "Workflow failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setRunningWorkflow(false);
    }
  };

  // Calendar helpers
  const getCalendarDays = useCallback(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const days: (Date | null)[] = [];

    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    const remainder = days.length % 7;
    if (remainder) for (let i = 0; i < 7 - remainder; i++) days.push(null);

    return days;
  }, [calendarMonth]);

  const getPostsForDate = useCallback((date: Date) => {
    const dateStr = toLocalDateInput(date);
    return posts.filter((p) => {
      if (p.scheduled_date) return p.scheduled_date === dateStr;
      return p.created_at.startsWith(dateStr);
    });
  }, [posts]);

  const getPlatformBorderColor = (p: string) => {
    switch (p) {
      case "facebook": return "border-l-[3px] border-l-[#1877F2]";
      case "linkedin": return "border-l-[3px] border-l-[#0A66C2]";
      case "instagram": return "border-l-[3px] border-l-[#E1306C]";
      case "twitter": return "border-l-[3px] border-l-[#000000]";
      case "tiktok": return "border-l-[3px] border-l-[#000000]";
      case "whatsapp": return "border-l-[3px] border-l-[#25D366]";
      case "youtube": return "border-l-[3px] border-l-[#ff0000]";
      default: return "border-l-[3px] border-l-muted-foreground";
    }
  };

  const applyAutopilotSlot = () => {
    // Find all future posts (ignoring the one we are editing)
    const futurePosts = posts.filter(
      (p) => p.id !== reschedule?.postId && p.scheduled_date
    );

    // Convert to tomorrow's date to start looking
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check up to 30 days
    let targetDate = tomorrow;
    for (let i = 0; i < 30; i++) {
      const dateString = toLocalDateInput(targetDate);
      const postsOnDate = futurePosts.filter((p) => p.scheduled_date === dateString);

      // If there are no posts on this day, select this day!
      if (postsOnDate.length === 0) {
        setReschedule((prev) => (prev ? { ...prev, date: dateString, time: "09:00" } : prev));
        toast({
          title: "Autopilot Slot Selected",
          description: `Scheduled for ${dateString} (next fully empty day).`,
        });
        return;
      }

      // Move to next day
      targetDate.setDate(targetDate.getDate() + 1);
    }

    // Fallback: if all next 30 days have posts, find the day with the fewest posts
    targetDate = new Date(tomorrow);
    let bestDate = toLocalDateInput(targetDate);
    let minPostsCount = 999;

    for (let i = 0; i < 30; i++) {
      const dateString = toLocalDateInput(targetDate);
      const postsOnDate = futurePosts.filter((p) => p.scheduled_date === dateString);
      if (postsOnDate.length < minPostsCount) {
        minPostsCount = postsOnDate.length;
        bestDate = dateString;
      }
      targetDate.setDate(targetDate.getDate() + 1);
    }

    setReschedule((prev) => (prev ? { ...prev, date: bestDate, time: "09:00" } : prev));
    toast({
      title: "Autopilot Slot Selected",
      description: `Scheduled for ${bestDate} (day with lowest posting volume).`,
    });
  };

  const openReschedule = (post: ScheduledPost, dateOverride?: string) => {
    setReschedule({
      postId: post.id,
      date: dateOverride ?? post.scheduled_date ?? toLocalDateInput(new Date()),
      time: parseTimeForInput(post.scheduled_time) ?? "09:00",
    });
  };

  const saveReschedule = async () => {
    if (!reschedule?.date) {
      toast({ title: "Date required", variant: "destructive" });
      return;
    }
    setSavingReschedule(true);
    try {
      await contentItemsApi.update(reschedule.postId, {
        scheduledDate: reschedule.date,
        scheduledTime: toApiTime(reschedule.time || "09:00"),
      } as any);
      toast({
        title: "Schedule updated",
        description: formatScheduleLabel(reschedule.date, reschedule.time),
      });
      setReschedule(null);
      loadPosts();
    } catch (err: unknown) {
      toast({
        title: "Failed to update schedule",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSavingReschedule(false);
    }
  };

  const handleDragStart = (e: DragEvent, postId: string) => {
    setDragId(postId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", postId);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: DragEvent, date: Date) => {
    e.preventDefault();
    const postId = e.dataTransfer.getData("text/plain");
    if (!postId) return;
    setDragId(null);

    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    openReschedule(post, toLocalDateInput(date));
  };

  const today = new Date();
  const isToday = (d: Date) =>
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  const monthLabel = calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    approved: "bg-primary/10 text-primary",
    published: "bg-green-100 text-green-700",
    rejected: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="w-full space-y-5 sm:space-y-6 pb-8 sm:pb-10 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-accent">
            <CalendarClock className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Scheduler & Publisher</h1>
            <p className="text-muted-foreground text-sm">Plan, schedule, and publish across channels</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Tabs value={view} onValueChange={(v) => setView(v as "list" | "calendar")}>
            <TabsList className="h-9">
              <TabsTrigger value="calendar" className="h-7 text-xs px-2.5"><CalendarDays className="h-3.5 w-3.5 mr-1" /> Calendar</TabsTrigger>
              <TabsTrigger value="list" className="h-7 text-xs px-2.5"><List className="h-3.5 w-3.5 mr-1" /> List</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={handleDailyWorkflow} disabled={runningWorkflow} variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/5">
            {runningWorkflow ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-1.5 h-3.5 w-3.5" />}
            {runningWorkflow ? "Generating..." : "Auto-Generate"}
          </Button>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button size="sm" className="gradient-primary text-primary-foreground border-0 shadow-glow hover:opacity-90">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Schedule
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="font-display">Schedule content</SheetTitle>
              </SheetHeader>
              <div className="grid lg:grid-cols-2 gap-6 mt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Platforms</Label>
                    <MultiPlatformPicker values={selectedPlatforms} onChange={setSelectedPlatforms} />
                  </div>
                  <div className="space-y-2">
                    <Label>Title <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input placeholder="Give this post a title..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Time</Label>
                      <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Content</Label>
                    <RichTextEditor value={newContent} onChange={setNewContent} placeholder="Write your post content..." minHeight="100px" />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Media{" "}
                      <span className="text-muted-foreground text-xs">
                        {instagramNeedsMedia ? "(required for Instagram)" : "(optional)"}
                      </span>
                    </Label>
                    {newMedia ? (
                      <div className="relative w-full rounded-lg overflow-hidden border border-border/50 bg-muted/30">
                        {newMedia.type === "image" ? (
                          <img src={newMedia.url} alt="Attached media" className="w-full max-h-40 object-cover" />
                        ) : (
                          <video src={newMedia.url} className="w-full max-h-40 object-cover" controls />
                        )}
                        <button
                          onClick={() => setNewMedia(null)}
                          className="absolute top-1.5 right-1.5 rounded-full bg-background/80 p-1 text-xs hover:bg-background"
                        >✕</button>
                      </div>
                    ) : (
                      <MediaUpload label="" onUpload={(url, type) => setNewMedia({ url, type })} />
                    )}
                  </div>
                  <Button
                    onClick={handleSchedule}
                    disabled={
                      !newContent.trim() ||
                      !selectedPlatforms.length ||
                      !newDate ||
                      instagramNeedsMedia
                    }
                    className="w-full gradient-primary text-primary-foreground border-0"
                  >
                    <Send className="mr-2 h-4 w-4" /> Schedule to {selectedPlatforms.length} platform{selectedPlatforms.length !== 1 ? 's' : ''}
                  </Button>
                </div>
                <PlatformPreviewPanel
                  platforms={selectedPlatforms}
                  platformPayloads={displaySchedulePayloads}
                  title={newTitle}
                  baseContent={newContent}
                  previewTab={previewTab}
                  onPreviewTabChange={setPreviewTab}
                  mediaUrls={newMedia ? [newMedia.url] : []}
                  showEditors
                  onEditPayload={(platform, patch) =>
                    setSchedulePayloadOverrides((prev) => ({
                      ...prev,
                      [platform]: { ...displaySchedulePayloads[platform], ...prev[platform], ...patch },
                    }))
                  }
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Drafts", count: posts.filter(p => p.status === "draft").length, color: "text-muted-foreground" },
          { label: "Approved", count: posts.filter(p => p.status === "approved").length, color: "text-primary" },
          { label: "Published", count: posts.filter(p => p.status === "published").length, color: "text-green-600" },
          { label: "Rejected", count: posts.filter(p => p.status === "rejected").length, color: "text-destructive" },
        ].map((s) => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold font-display ${s.color}`}>{s.count}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Calendar View */}
      {view === "calendar" && (
        <Card className="border-border/50">
          <CardContent className="p-4">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-sm font-display font-semibold">{monthLabel}</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-px mb-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px bg-border/30 rounded-lg overflow-hidden">
              {getCalendarDays().map((day, idx) => {
                if (!day) {
                  return <div key={`empty-${idx}`} className="bg-background min-h-[110px] p-1" />;
                }
                const dayPosts = getPostsForDate(day);
                const todayClass = isToday(day) ? "ring-2 ring-primary ring-inset" : "";
                const isDraggingActive = dragId !== null;

                return (
                  <div
                    key={day.toISOString()}
                    className={`bg-background min-h-[110px] p-1.5 flex flex-col gap-1 ${todayClass} transition-all relative ${
                      isDraggingActive
                        ? "border border-dashed border-primary/30 bg-primary/5/10 hover:border-primary/60 hover:bg-primary/10"
                        : "hover:bg-muted/15"
                    }`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, day)}
                  >
                    <div className={`text-xs font-semibold mb-1 ${isToday(day) ? "text-primary font-bold" : "text-muted-foreground"}`}>
                      {day.getDate()}
                    </div>
                    <div className="space-y-1 z-10">
                      {dayPosts.slice(0, 3).map((post) => {
                        const platforms = post.platforms && post.platforms.length > 0 ? post.platforms : [post.content_type];
                        const timeLabel = formatTimeDisplay(post.scheduled_time);
                        return (
                          <TooltipProvider key={post.id}>
                            <Tooltip delayDuration={200}>
                              <TooltipTrigger asChild>
                                <div
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, post.id)}
                                  className={`flex items-center justify-between gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border cursor-grab active:cursor-grabbing bg-card hover:shadow-sm transition-all ${
                                    getPlatformBorderColor(platforms[0] ?? "")
                                  } ${dragId === post.id ? "opacity-40 scale-95" : ""}`}
                                >
                                  <Link
                                    to={`/content/${post.id}`}
                                    className="flex items-center gap-1 min-w-0 flex-1 cursor-pointer"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDots[post.status] || "bg-muted-foreground"}`} />
                                    {platforms.map((p) => {
                                      const Icon = channelIcons[p] || CalendarClock;
                                      return <Icon key={p} className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />;
                                    })}
                                    <span className="truncate font-semibold text-foreground/90">
                                      {timeLabel || post.title?.replace(/<[^>]*>/g, "").slice(0, 12) || "Untitled"}
                                    </span>
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openReschedule(post);
                                    }}
                                    className="shrink-0 rounded p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                                    title="Set date & time"
                                  >
                                    <Clock className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" align="start" className="w-72 p-3 space-y-2 text-xs bg-popover border border-border/80 text-popover-foreground rounded-xl shadow-md z-50">
                                <div className="flex items-center justify-between border-b pb-1.5 mb-1.5">
                                  <span className="font-semibold text-primary truncate max-w-[160px]">
                                    {post.title || "Draft Post"}
                                  </span>
                                  <Badge variant="outline" className={`text-[9px] capitalize font-medium ${statusColors[post.status] || ""}`}>
                                    {post.status}
                                  </Badge>
                                </div>
                                <p className="line-clamp-3 leading-relaxed text-muted-foreground italic">
                                  "{post.content ? post.content.replace(/<[^>]*>/g, "").slice(0, 150) : "No content"}"
                                </p>
                                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1.5 border-t mt-1.5">
                                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {timeLabel || "All day"}</span>
                                  <span className="font-semibold uppercase text-[9px] tracking-wider">{platforms.join(', ')}</span>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}
                      {dayPosts.length > 3 && (
                        <div className="text-[10px] text-muted-foreground pl-1">+{dayPosts.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground" /> Draft</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> Approved</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> Published</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" /> Rejected</span>
              <span className="ml-auto">Click to view · clock to reschedule · drag to move</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List View */}
      {view === "list" && (
        <div className="space-y-3">
          <h2 className="text-lg font-display font-semibold">Publishing Queue</h2>
          {posts.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="p-8 text-center text-muted-foreground">
                No content in the queue. Generate content or click "Auto-Generate" to get started.
              </CardContent>
            </Card>
          ) : (
            posts.map((post) => {
              const platforms = post.platforms && post.platforms.length > 0 ? post.platforms : [post.content_type];
              return (
                <Card key={post.id} className="border-border/50 hover:shadow-card transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {/* Show all platform icons and badges */}
                          {platforms.map((p) => {
                            const Icon = channelIcons[p] || CalendarClock;
                            return <Icon key={p} className="h-4 w-4 text-muted-foreground shrink-0" />;
                          })}
                          {platforms.map((p) => (
                            <Badge key={p} variant="secondary" className="text-xs mr-1">{channelLabels[p] || p}</Badge>
                          ))}
                          <Badge className={`text-xs ${statusColors[post.status]}`}>{post.status}</Badge>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => openReschedule(post)}
                          >
                            <CalendarDays className="h-3 w-3" />
                            {post.scheduled_date
                              ? formatScheduleLabel(post.scheduled_date, post.scheduled_time)
                              : "Set schedule"}
                          </Button>
                          {post.campaign_theme && <span className="text-xs text-muted-foreground">{post.campaign_theme}</span>}
                          {post.publish_failed_reason && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-1 text-xs text-destructive cursor-default">
                                    <AlertCircle className="h-3.5 w-3.5" /> Publish failed
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">{post.publish_failed_reason}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        {post.media_url && post.media_type === "slideshow" && (() => {
                          try {
                            const slides = JSON.parse(post.media_url) as string[];
                            return (
                              <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                                {slides.map((url, i) => (
                                  <img key={i} src={url} alt={`Slide ${i + 1}`} className="h-24 rounded-lg border border-border/50 object-cover shrink-0" />
                                ))}
                              </div>
                            );
                          } catch { return null; }
                        })()}
                        {post.media_url && post.media_type === "video" && (
                          <div className="mb-2 rounded-lg overflow-hidden border border-border/50 max-w-xs">
                            <video src={post.media_url} className="w-full max-h-32 object-cover" controls />
                          </div>
                        )}
                        {post.media_url && (post.media_type === "image" || (!post.media_type && !post.media_url.startsWith("["))) && post.media_type !== "slideshow" && post.media_type !== "video" && (
                          <div className="mb-2 rounded-lg overflow-hidden border border-border/50 max-w-xs">
                            <img src={post.media_url} alt="" className="w-full max-h-32 object-cover" />
                          </div>
                        )}
                        <Link
                          to={`/content/${post.id}`}
                          className="text-sm text-foreground line-clamp-2 hover:underline block"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {post.published_at
                            ? `Published ${new Date(post.published_at).toLocaleString()}`
                            : `Created ${new Date(post.created_at).toLocaleString()}`}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openQueuePreview(post)}
                          className="h-8 text-muted-foreground"
                          title="Preview per-platform content"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {post.status === "draft" && (
                          <Button size="sm" variant="ghost" onClick={() => updateStatus(post.id, "approved")} className="text-primary h-8">
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        {(post.status === "approved" || post.status === "published" || post.status === "rejected") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePublish(post)}
                            className={`h-8 ${post.status === "approved" ? "text-green-600" : "text-muted-foreground"}`}
                            title={post.status === "published" ? "Publish again" : post.status === "rejected" ? "Open publisher" : "Publish"}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {post.publish_failed_reason && (
                          <Button size="sm" variant="ghost" onClick={() => handleRetry(post.id)} disabled={retrying === post.id}
                            className="h-8 text-amber-600" title="Retry failed publish">
                            {retrying === post.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                          </Button>
                        )}
                        {post.status !== "rejected" && post.status !== "published" && (
                          <Button size="sm" variant="ghost" onClick={() => updateStatus(post.id, "rejected")} className="text-destructive h-8">
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      <Dialog open={reschedule != null} onOpenChange={(open) => !open && setReschedule(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Set publish date & time</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="reschedule-date">Date</Label>
              <Input
                id="reschedule-date"
                type="date"
                value={reschedule?.date ?? ""}
                onChange={(e) =>
                  setReschedule((prev) => (prev ? { ...prev, date: e.target.value } : prev))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reschedule-time">Time</Label>
              <Input
                id="reschedule-time"
                type="time"
                value={reschedule?.time ?? "09:00"}
                onChange={(e) =>
                  setReschedule((prev) => (prev ? { ...prev, time: e.target.value } : prev))
                }
              />
            </div>
          </div>
          <div className="flex justify-between items-center bg-muted/40 p-2.5 rounded-lg border border-border/50">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20" />
              Autopilot Scheduler
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyAutopilotSlot}
              className="h-7 text-[10px] px-2 font-medium cursor-pointer"
            >
              Find next slot
            </Button>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Auto-publish runs when this date and time is reached (approved posts only).
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReschedule(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveReschedule} disabled={savingReschedule || !reschedule?.date}>
              {savingReschedule ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!previewPost} onOpenChange={(open) => { if (!open) setPreviewPost(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">Per-platform content</SheetTitle>
          </SheetHeader>
          {previewPost && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                What will be sent to each platform when this post publishes.
                {previewPost.scheduled_date
                  ? ` Scheduled for ${formatScheduleLabel(previewPost.scheduled_date, previewPost.scheduled_time)}.`
                  : ""}
              </p>
              <PlatformPreviewPanel
                platforms={
                  previewPost.platforms && previewPost.platforms.length > 0
                    ? previewPost.platforms
                    : [previewPost.content_type]
                }
                platformPayloads={getPostPreviewPayloads(previewPost)}
                title={previewPost.title ?? ""}
                baseContent={previewPost.content}
                previewTab={queuePreviewTab}
                onPreviewTabChange={setQueuePreviewTab}
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" asChild>
                  <Link to={`/content/${previewPost.id}`}>Open full detail</Link>
                </Button>
                <Button
                  type="button"
                  className="flex-1 gradient-primary text-primary-foreground border-0"
                  onClick={() => {
                    setPreviewPost(null);
                    handlePublish(previewPost);
                  }}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Edit & publish
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={!!publishItem} onOpenChange={(open) => { if (!open) closePublish(); }}>
        <SheetContent side="right" className="w-full sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl p-0 flex flex-col overflow-hidden">
          {publishItem && (
            <PublishPanel
              item={publishItem}
              onCancel={closePublish}
              onPublished={handlePublished}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Scheduler;
