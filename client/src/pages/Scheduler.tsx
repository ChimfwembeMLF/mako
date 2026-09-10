import { useState, useEffect, useCallback, DragEvent, useMemo } from "react";
import { Link } from "react-router-dom";
import { sanitizeHtml } from "@/lib/sanitize";
import {
  CalendarClock, Plus, CheckCircle2, XCircle, Send, Facebook, Linkedin, Instagram,
  Twitter, Mail, Megaphone, Zap, Loader2, List, CalendarDays, ChevronLeft, ChevronRight,
  AlertCircle, RotateCcw, Clock, Eye, Youtube, MessageCircle, Users, User, Bot,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { MediaUpload } from "@/components/MediaUpload";
import { MultiPlatformPicker } from "@/components/content/MultiPlatformPicker";
import { PlatformPreviewPanel } from "@/components/content/PlatformPreviewPanel";
import { PublishPanel } from "@/components/content/PublishPanel";
import { AutomationSettingsTab } from "@/components/scheduler/AutomationSettingsTab";
import { CalendarDayModal } from "@/components/scheduler/CalendarDayModal";
import type { ContentItem } from "@/components/content/types";
import {
  buildPlatformPayloads,
  platformRequiresMedia,
  instagramHasMedia,
  type PlatformMediaAttachment,
  type PlatformPayload,
} from "@/lib/platforms";
import { plainToHtml } from "@/lib/rich-text";
import { resolveRetryPublishArgs, submitPublish, toPublishMediaUrl } from "@/lib/publishContent";
import {
  formatScheduleLabel,
  formatTimeDisplay,
  parseTimeForInput,
  toApiTime,
  toLocalDateInput,
  isScheduledStatus,
} from "@/lib/schedule";
import {
  type ScheduledPost,
  type ListFilter,
  mapApiItemToPost,
  sortPostsBySchedule,
  filterPosts,
  getScheduledPosts,
  getUnscheduledPosts,
  countDueToday,
  countOverdue,
} from "@/lib/scheduler-post";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useWorkspace } from "@/hooks/useWorkspace";
import { contentItemsApi } from "@/lib/api";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
    </svg>
  );
}

const channelIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  facebook: Facebook,
  linkedin: Linkedin,
  instagram: Instagram,
  twitter: Twitter,
  email: Mail,
  ad_copy: Megaphone,
  tiktok: TikTokIcon,
  youtube: Youtube,
  whatsapp: MessageCircle,
};

const channelLabels: Record<string, string> = {
  facebook: "Facebook",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  twitter: "X / Twitter",
  email: "Email",
  ad_copy: "Ad",
  tiktok: "TikTok",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
};

const statusDots: Record<string, string> = {
  draft: "bg-muted-foreground",
  approved: "bg-primary",
  scheduled: "bg-blue-500",
  published: "bg-green-500",
  rejected: "bg-destructive",
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-primary/10 text-primary",
  scheduled: "bg-blue-100 text-blue-700",
  published: "bg-green-100 text-green-700",
  rejected: "bg-destructive/10 text-destructive",
};

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

function getPlatformBorderColor(p: string) {
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
}

function CalendarPostChip({
  post,
  dragId,
  onReschedule,
  onDragStart,
}: {
  post: ScheduledPost;
  dragId: string | null;
  onReschedule: (post: ScheduledPost) => void;
  onDragStart: (e: DragEvent, postId: string) => void;
}) {
  const platforms = post.platforms && post.platforms.length > 0 ? post.platforms : [post.content_type];
  const timeLabel = formatTimeDisplay(post.scheduled_time);

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div
            draggable
            onDragStart={(e) => onDragStart(e, post.id)}
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
                onReschedule(post);
              }}
              className="shrink-0 rounded p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              title="Set date & time"
            >
              <Clock className="h-2.5 w-2.5" />
            </button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="w-72 p-3 space-y-2 text-xs">
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
            <span className="font-semibold uppercase text-[9px] tracking-wider">{platforms.join(", ")}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function PostMediaPreview({ post }: { post: ScheduledPost }) {
  if (!post.media_url) return null;
  if (post.media_type === "slideshow") {
    try {
      const slides = JSON.parse(post.media_url) as string[];
      return (
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {slides.map((url, i) => (
            <img key={i} src={url} alt={`Slide ${i + 1}`} className="h-24 rounded-lg border border-border/50 object-cover shrink-0" />
          ))}
        </div>
      );
    } catch {
      return null;
    }
  }
  if (post.media_type === "video") {
    return (
      <div className="mb-2 rounded-lg overflow-hidden border border-border/50 max-w-xs">
        <video src={post.media_url} className="w-full max-h-32 object-cover" controls />
      </div>
    );
  }
  return (
    <div className="mb-2 rounded-lg overflow-hidden border border-border/50 max-w-xs">
      <img src={post.media_url} alt="" className="w-full max-h-32 object-cover" />
    </div>
  );
}

function getBrandBg(p: string) {
  switch (p) {
    case "facebook": return "bg-[#1877F2]";
    case "linkedin": return "bg-[#0A66C2]";
    case "instagram": return "bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]";
    case "twitter": return "bg-[#000000]";
    case "tiktok": return "bg-[#000000]";
    case "whatsapp": return "bg-[#25D366]";
    case "youtube": return "bg-[#FF0000]";
    default: return "bg-muted-foreground";
  }
}

function getPlatformStatusDot(posts: ScheduledPost[]) {
  if (posts.some(p => p.status === 'rejected')) return 'bg-destructive';
  if (posts.every(p => p.status === 'published')) return 'bg-green-500';
  if (posts.some(p => p.status === 'approved')) return 'bg-primary';
  if (posts.some(p => p.status === 'scheduled')) return 'bg-blue-500';
  return 'bg-muted-foreground'; // draft
}

const Scheduler = () => {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [view, setView] = useState<"list" | "calendar" | "automations">("calendar");
  const [listFilter, setListFilter] = useState<ListFilter>("upcoming");
  const [showTeam, setShowTeam] = useState(true);
  const [selectedDayForModal, setSelectedDayForModal] = useState<Date | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(true);
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
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('month');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [dragId, setDragId] = useState<string | null>(null);
  const [reschedule, setReschedule] = useState<{ postId: string; date: string; time: string; status: string } | null>(null);
  const [savingReschedule, setSavingReschedule] = useState(false);
  const [publishItem, setPublishItem] = useState<ContentItem | null>(null);
  const [previewPost, setPreviewPost] = useState<ScheduledPost | null>(null);
  const [queuePreviewTab, setQueuePreviewTab] = useState("facebook");
  const [schedulePayloadOverrides, setSchedulePayloadOverrides] = useState<Record<string, PlatformPayload>>({});
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { activeWorkspace, workspaces, workspaceVersion, loading: workspaceLoading } = useWorkspace();
  const activeWorkspaceObj = workspaces.find(w => w.id === activeWorkspace) ?? null;

  const schedulePreviewPayloads = useMemo(() => {
    const baseMedia: PlatformMediaAttachment[] = newMedia
      ? [{ url: newMedia.url, type: newMedia.type }]
      : [];
    return buildPlatformPayloads(plainToHtml(newContent), newTitle, selectedPlatforms, baseMedia);
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

  const sortedPosts = useMemo(() => sortPostsBySchedule(posts), [posts]);
  const visiblePosts = useMemo(
    () => filterPosts(sortedPosts, listFilter, { showTeam, userId: user?.id }),
    [sortedPosts, listFilter, showTeam, user?.id],
  );
  const scheduledPosts = useMemo(() => getScheduledPosts(posts), [posts]);
  const unscheduledPosts = useMemo(() => getUnscheduledPosts(posts), [posts]);

  const loadPosts = useCallback(async () => {
    if (!user || !activeWorkspace) {
      setPosts([]);
      setLoadingPosts(false);
      return;
    }
    setLoadingPosts(true);
    try {
      const all = await contentItemsApi.findAll(tenant?.id, {
        workspaceId: activeWorkspace,
        includeMedia: true,
      });
      const list = (Array.isArray(all) ? all : []).map((item) =>
        mapApiItemToPost(item as Record<string, unknown>),
      );
      setPosts(list);
    } catch (err: unknown) {
      setPosts([]);
      toast({
        title: "Failed to load schedule",
        description: err instanceof Error ? err.message : "Could not load content items.",
        variant: "destructive",
      });
    } finally {
      setLoadingPosts(false);
    }
  }, [user, tenant?.id, activeWorkspace, toast]);

  useEffect(() => {
    if (user && activeWorkspace) void loadPosts();
  }, [user, tenant?.id, activeWorkspace, workspaceVersion, loadPosts]);

  useEffect(() => {
    if (sheetOpen && !newDate) {
      setNewDate(toLocalDateInput(new Date()));
    }
  }, [sheetOpen, newDate]);

  const openCreatePostForDate = (date: Date) => {
    setNewDate(toLocalDateInput(date));
    setSheetOpen(true);
  };

  useEffect(() => {
    if (!sheetOpen) setSchedulePayloadOverrides({});
  }, [sheetOpen]);

  const handleRetry = async (id: string) => {
    setRetrying(id);
    try {
      const retryArgs = await resolveRetryPublishArgs(id);
      if (retryArgs.alreadyComplete) {
        toast({
          title: "Already published",
          description: "All platforms for this post were published successfully.",
        });
        void loadPosts();
        return;
      }
      await submitPublish(id, retryArgs.platforms, retryArgs.platformPayloads, (t) => toast(t));
      void loadPosts();
    } catch (err: unknown) {
      toast({
        title: "Retry failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
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

    const htmlContent = plainToHtml(newContent);
    const storedPayloads = Object.fromEntries(
      Object.entries(displaySchedulePayloads).map(([platform, payload]) => [
        platform,
        {
          ...payload,
          media: payload.media?.map((m) => ({ ...m, url: toPublishMediaUrl(m.url) })),
        },
      ]),
    );

    try {
      const created = await contentItemsApi.create({
        userId: user.id,
        tenantId: tenant?.id,
        workspaceId: activeWorkspace,
        content: htmlContent,
        contentType: selectedPlatforms[0],
        platforms: selectedPlatforms,
        platformPayloads: storedPayloads,
        title: newTitle.trim() || `Scheduled for ${formatScheduleLabel(newDate, newTime)}`,
        status: "approved",
        scheduledDate: newDate,
        scheduledTime: toApiTime(newTime || "09:00"),
      } as Parameters<typeof contentItemsApi.create>[0]);

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
      void loadPosts();
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await contentItemsApi.update(id, { status } as Parameters<typeof contentItemsApi.update>[1]);
    void loadPosts();
  };

  const persistSchedule = async (
    postId: string,
    date: string,
    time: string,
    currentStatus: string,
    options?: { silent?: boolean },
  ) => {
    const patch: Record<string, string> = {
      scheduledDate: date,
      scheduledTime: toApiTime(time || "09:00"),
    };
    if (currentStatus === "draft") {
      patch.status = "approved";
    }
    await contentItemsApi.update(postId, patch as Parameters<typeof contentItemsApi.update>[1]);
    if (!options?.silent) {
      toast({
        title: "Schedule updated",
        description: formatScheduleLabel(date, time),
      });
    }
    void loadPosts();
  };

  const applyMakoSlot = () => {
    const futurePosts = posts.filter((p) => p.id !== reschedule?.postId && p.scheduled_date);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    let targetDate = new Date(tomorrow);
    for (let i = 0; i < 30; i++) {
      const dateString = toLocalDateInput(targetDate);
      const postsOnDate = futurePosts.filter((p) => p.scheduled_date === dateString);
      if (postsOnDate.length === 0) {
        setReschedule((prev) => (prev ? { ...prev, date: dateString, time: "09:00" } : prev));
        toast({ title: "Mako Slot Selected", description: `Scheduled for ${dateString} (next fully empty day).` });
        return;
      }
      targetDate.setDate(targetDate.getDate() + 1);
    }

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
    toast({ title: "Mako Slot Selected", description: `Scheduled for ${bestDate} (day with lowest posting volume).` });
  };

  const openReschedule = (post: ScheduledPost, dateOverride?: string) => {
    setReschedule({
      postId: post.id,
      date: dateOverride ?? post.scheduled_date ?? toLocalDateInput(new Date()),
      time: parseTimeForInput(post.scheduled_time) ?? "09:00",
      status: post.status,
    });
  };

  const saveReschedule = async () => {
    if (!reschedule?.date) {
      toast({ title: "Date required", variant: "destructive" });
      return;
    }
    setSavingReschedule(true);
    try {
      await persistSchedule(reschedule.postId, reschedule.date, reschedule.time, reschedule.status);
      setReschedule(null);
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
    setDragId(null);
    if (!postId) return;

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const dateStr = toLocalDateInput(date);
    const time = parseTimeForInput(post.scheduled_time) ?? "09:00";
    try {
      await persistSchedule(post.id, dateStr, time, post.status, { silent: true });
      toast({ title: "Moved", description: formatScheduleLabel(dateStr, time) });
    } catch (err: unknown) {
      toast({
        title: "Failed to move post",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
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
      if (generated > 0) void loadPosts();
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

  const getPostsForDate = useCallback(
    (date: Date) => {
      const dateStr = toLocalDateInput(date);
      return scheduledPosts.filter((p) => p.scheduled_date === dateStr);
    },
    [scheduledPosts],
  );

  const today = new Date();
  const isToday = (d: Date) =>
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  const monthLabel = calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const stats = [
    { label: "Scheduled", count: posts.filter((p) => p.status === "scheduled" || (p.status === "approved" && p.scheduled_date)).length, color: "text-blue-600" },
    { label: "Due today", count: countDueToday(posts), color: "text-amber-600" },
    { label: "Overdue", count: countOverdue(posts), color: "text-destructive" },
    { label: "Published", count: posts.filter((p) => p.status === "published").length, color: "text-green-600" },
  ];

  const renderListPost = (post: ScheduledPost) => {
    const platforms = post.platforms && post.platforms.length > 0 ? post.platforms : [post.content_type];
    return (
      <Card key={post.id} className="border-border/50 hover:shadow-card transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {platforms.map((p) => {
                  const Icon = channelIcons[p] || CalendarClock;
                  return <Icon key={`icon-${p}`} className="h-4 w-4 text-muted-foreground shrink-0" />;
                })}
                {platforms.map((p) => (
                  <Badge key={`badge-${p}`} variant="secondary" className="text-xs mr-1">{channelLabels[p] || p}</Badge>
                ))}
                <Badge className={`text-xs ${statusColors[post.status] || statusColors.draft}`}>{post.status}</Badge>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => openReschedule(post)}>
                  <CalendarDays className="h-3 w-3" />
                  {post.scheduled_date ? formatScheduleLabel(post.scheduled_date, post.scheduled_time) : "Set schedule"}
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
              <PostMediaPreview post={post} />
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
              <Button size="sm" variant="ghost" onClick={() => { setQueuePreviewTab(platforms[0] ?? "facebook"); setPreviewPost(post); }} className="h-8 text-muted-foreground" title="Preview">
                <Eye className="h-4 w-4" />
              </Button>
              {(post.status === "draft" || post.status === "scheduled") && (
                <Button size="sm" variant="ghost" onClick={() => updateStatus(post.id, "approved")} className="text-primary h-8">
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              )}
              {(isScheduledStatus(post.status) || post.status === "published" || post.status === "rejected") && (
                <Button size="sm" variant="ghost" onClick={() => setPublishItem(postToContentItem(post))} className={`h-8 ${isScheduledStatus(post.status) ? "text-green-600" : "text-muted-foreground"}`} title="Publish">
                  <Send className="h-4 w-4" />
                </Button>
              )}
              {post.publish_failed_reason && (
                <Button size="sm" variant="ghost" onClick={() => handleRetry(post.id)} disabled={retrying === post.id} className="h-8 text-amber-600">
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
  };

  if (workspaceLoading) {
    return (
      <div className="w-full space-y-6 pb-10">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Select a workspace to manage your content schedule.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-5 sm:space-y-6 pb-8 sm:pb-10 min-w-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold font-display">{view === "calendar" ? "Calendar" : view === "automations" ? "Automations" : "Scheduler"}</h1>
            <p className="text-muted-foreground text-sm">
              {view === "calendar" ? `Plan, inspect, and reschedule posts for ${activeWorkspaceObj?.name || "your workspace"}.` : "Plan, schedule, and publish across channels"}
            </p>
          </div>
        </div>
        <div className="flex gap-4 flex-wrap items-center">
          {view === "calendar" && (
            <div className="flex items-center gap-2 bg-card border border-border/50 rounded-full px-1.5 py-1">
              <div className="px-2 border-r border-border/50">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground"><path d="M2.5 3.5C2.5 3.22386 2.72386 3 3 3H12C12.2761 3 12.5 3.22386 12.5 3.5C12.5 3.77614 12.2761 4 12 4H3C2.72386 4 2.5 3.77614 2.5 3.5ZM4.5 7.5C4.5 7.22386 4.72386 7 5 7H10C10.2761 7 10.5 7.22386 10.5 7.5C10.5 7.77614 10.2761 8 10 8H5C4.72386 8 4.5 7.77614 4.5 7.5ZM6.5 11.5C6.5 11.2239 6.72386 11 7 11H8C8.27614 11 8.5 11.2239 8.5 11.5C8.5 11.7761 8.27614 12 8 12H7C6.72386 12 6.5 11.7761 6.5 11.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
              </div>
              <div className="flex items-center gap-1.5 px-1">
                <Badge variant="secondary" className="bg-white text-black hover:bg-white/90 rounded-full text-[10px] px-2 h-5 cursor-pointer">All</Badge>
                <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-[#fd5949] to-[#d6249f] flex items-center justify-center cursor-pointer opacity-70 hover:opacity-100 transition-opacity">
                  <Instagram className="h-2.5 w-2.5 text-white" />
                </div>
                <div className="h-5 w-5 rounded-full bg-black flex items-center justify-center cursor-pointer opacity-70 hover:opacity-100 transition-opacity">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-2.5 w-2.5 text-white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                </div>
                <div className="h-5 w-5 rounded-full bg-[#0A66C2] flex items-center justify-center cursor-pointer opacity-70 hover:opacity-100 transition-opacity">
                  <Linkedin className="h-2.5 w-2.5 text-white" />
                </div>
                <div className="h-5 w-5 rounded-full bg-[#1877F2] flex items-center justify-center cursor-pointer opacity-70 hover:opacity-100 transition-opacity">
                  <Facebook className="h-2.5 w-2.5 text-white" />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {view === "calendar" && (
               <div className="flex items-center bg-card border border-border/50 rounded-full p-1 h-9 text-xs font-medium">
                 {(['day', 'week', 'month'] as const).map((v) => (
                   <button
                     key={v}
                     className={`px-3 rounded-full capitalize transition-all ${
                       calendarView === v
                         ? 'bg-white dark:bg-foreground text-black shadow-sm h-7 font-semibold'
                         : 'text-muted-foreground hover:text-foreground'
                     }`}
                     onClick={() => {
                       setCalendarView(v);
                       if (v === 'day') setCalendarDate(new Date());
                       if (v === 'week' || v === 'month') setCalendarMonth(new Date());
                     }}
                   >
                     {v}
                   </button>
                 ))}
               </div>
            )}
            
            <Tabs value={view} onValueChange={(v) => setView(v as "list" | "calendar" | "automations")}>
              <TabsList className="h-9 rounded-full">
                <TabsTrigger value="calendar" className="h-7 text-xs px-2.5 rounded-full"><CalendarDays className="h-3.5 w-3.5 mr-1 hidden sm:block" /> Calendar</TabsTrigger>
                <TabsTrigger value="list" className="h-7 text-xs px-2.5 rounded-full"><List className="h-3.5 w-3.5 mr-1 hidden sm:block" /> List</TabsTrigger>
                <TabsTrigger value="automations" className="h-7 text-xs px-2.5 rounded-full"><Bot className="h-3.5 w-3.5 mr-1 hidden sm:block" /> Automations</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button size="sm" className="rounded-full bg-white text-black hover:bg-white/90 h-9 font-medium shadow-sm"><Plus className="mr-1 h-4 w-4" /> Schedule</Button>
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
                    <Textarea rows={8} value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Write your post content..." />
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
                        <button onClick={() => setNewMedia(null)} className="absolute top-1.5 right-1.5 rounded-full bg-background/80 p-1 text-xs hover:bg-background">✕</button>
                      </div>
                    ) : (
                      <MediaUpload label="" onUpload={(url, type) => setNewMedia({ url, type })} />
                    )}
                  </div>
                  <Button onClick={handleSchedule} disabled={!newContent.trim() || !selectedPlatforms.length || !newDate || instagramNeedsMedia} className="w-full">
                    <Send className="mr-2 h-4 w-4" /> Schedule to {selectedPlatforms.length} platform{selectedPlatforms.length !== 1 ? "s" : ""}
                  </Button>
                </div>
                <PlatformPreviewPanel
                  platforms={selectedPlatforms}
                  platformPayloads={displaySchedulePayloads}
                  title={newTitle}
                  baseContent={plainToHtml(newContent)}
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4 text-center">
              {loadingPosts ? <Skeleton className="h-8 w-10 mx-auto mb-1" /> : (
                <p className={`text-2xl font-bold font-display ${s.color}`}>{s.count}</p>
              )}
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {view === "calendar" && (() => {
        // ── Shared helpers ────────────────────────────────────────────────
        const navLabel = (() => {
          if (calendarView === 'day') return calendarDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
          if (calendarView === 'week') {
            const weekStart = new Date(calendarDate); weekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
            const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
            return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
          }
          return calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        })();

        const navPrev = () => {
          if (calendarView === 'day') { const d = new Date(calendarDate); d.setDate(d.getDate() - 1); setCalendarDate(d); }
          else if (calendarView === 'week') { const d = new Date(calendarDate); d.setDate(d.getDate() - 7); setCalendarDate(d); }
          else setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1));
        };
        const navNext = () => {
          if (calendarView === 'day') { const d = new Date(calendarDate); d.setDate(d.getDate() + 1); setCalendarDate(d); }
          else if (calendarView === 'week') { const d = new Date(calendarDate); d.setDate(d.getDate() + 7); setCalendarDate(d); }
          else setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1));
        };
        const navToday = () => { setCalendarDate(new Date()); setCalendarMonth(new Date()); };

        const sharedHeader = (
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-border/20">
            <div>
              <p className="text-[11px] font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-widest mb-0.5">{calendarView} View</p>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-foreground">{navLabel}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button className="h-9 w-9 rounded-full flex items-center justify-center border border-gray-200 dark:border-border/50 bg-white dark:bg-background hover:bg-gray-50 dark:hover:bg-muted/50 transition-colors shadow-sm" onClick={navPrev}>
                <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-muted-foreground" />
              </button>
              <button className="h-9 px-4 rounded-full text-xs font-semibold border border-gray-200 dark:border-border/50 bg-white dark:bg-background hover:bg-gray-50 dark:hover:bg-muted/50 transition-colors shadow-sm text-gray-700 dark:text-foreground" onClick={navToday}>
                Today
              </button>
              <button className="h-9 w-9 rounded-full flex items-center justify-center border border-gray-200 dark:border-border/50 bg-white dark:bg-background hover:bg-gray-50 dark:hover:bg-muted/50 transition-colors shadow-sm" onClick={navNext}>
                <ChevronRight className="h-4 w-4 text-gray-600 dark:text-muted-foreground" />
              </button>
            </div>
          </div>
        );

        const legend = (
          <div className="flex flex-wrap items-center gap-4 px-6 py-3 border-t border-gray-100 dark:border-border/20 bg-gray-50/50 dark:bg-muted/5 text-[11px] text-gray-400 dark:text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gray-400" /> Draft</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" /> Scheduled</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> Approved</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500" /> Published</span>
            <span className="ml-auto hidden sm:inline">Click a day to view or add posts</span>
          </div>
        );

        // ── Day chip helper ───────────────────────────────────────────────
        const DayCellPosts = ({ day, mini = false }: { day: Date; mini?: boolean }) => {
          const dayPosts = getPostsForDate(day);
          const platformPostsMap: Record<string, ScheduledPost[]> = {};
          for (const post of dayPosts) {
            const platforms = post.platforms && post.platforms.length > 0 ? post.platforms : [post.content_type];
            for (const p of platforms) {
              if (!platformPostsMap[p]) platformPostsMap[p] = [];
              platformPostsMap[p].push(post);
            }
          }
          const platKeys = Object.keys(platformPostsMap);
          return (
            <>
              {platKeys.slice(0, mini ? 2 : 3).map((platform) => {
                const Icon = channelIcons[platform] || CalendarClock;
                const platformPosts = platformPostsMap[platform] || [];
                const statusDot = getPlatformStatusDot(platformPosts);
                return (
                  <Popover key={platform}>
                    <PopoverTrigger asChild>
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold cursor-pointer transition-all hover:scale-[1.02] ${getBrandBg(platform)} text-white`} onClick={(e) => e.stopPropagation()}>
                        <Icon className="h-2.5 w-2.5 shrink-0" />
                        {!mini && <span className="truncate capitalize hidden sm:block">{platform}</span>}
                        <span className="ml-auto font-bold">{platformPosts.length}</span>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusDot} hidden sm:inline shrink-0`} />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2 space-y-1 bg-white dark:bg-background border border-gray-200 dark:border-border shadow-xl rounded-xl" align="start">
                      <p className="text-xs font-bold mb-2 capitalize text-gray-700 dark:text-foreground">{platform} Posts ({platformPosts.length})</p>
                      <div className="space-y-1">
                        {platformPosts.map((post) => (
                          <CalendarPostChip key={post.id} post={post} dragId={dragId} onReschedule={openReschedule} onDragStart={handleDragStart} />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              })}
              {platKeys.length > (mini ? 2 : 3) && (
                <span className="text-[10px] text-gray-400 dark:text-muted-foreground px-2">+{platKeys.length - (mini ? 2 : 3)} more</span>
              )}
            </>
          );
        };

        return (
          <div className="space-y-4">
            <div className="bg-white dark:bg-card rounded-2xl overflow-hidden border border-gray-200/80 dark:border-border/30 shadow-sm">
              {sharedHeader}
              {loadingPosts ? <Skeleton className="h-80 w-full" /> : (
                <>
                  {/* ── MONTH VIEW ─────────────────────────────────────────── */}
                  {calendarView === 'month' && (
                    <>
                      <div className="grid grid-cols-7 bg-gray-50/80 dark:bg-muted/5 border-b border-gray-100 dark:border-border/20">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                          <div key={d} className="text-center text-[11px] font-bold text-gray-400 dark:text-muted-foreground uppercase tracking-wider py-3">{d}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 divide-x divide-y divide-gray-100 dark:divide-border/20">
                        {getCalendarDays().map((day, idx) => {
                          if (!day) return <div key={`empty-${idx}`} className="min-h-[130px] bg-gray-50/50 dark:bg-muted/5" />;
                          const dayPosts = getPostsForDate(day);
                          const isTodayDate = isToday(day);
                          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                          return (
                            <div
                              key={day.toISOString()}
                              className={`min-h-[130px] flex flex-col cursor-pointer group/cell transition-colors ${isWeekend ? "bg-gray-50/70 dark:bg-muted/5" : "bg-white dark:bg-card"} ${dragId !== null ? "bg-primary/5" : "hover:bg-blue-50/40 dark:hover:bg-muted/20"}`}
                              onDragOver={handleDragOver}
                              onDrop={(e) => void handleDrop(e, day)}
                              onClick={() => setSelectedDayForModal(day)}
                            >
                              <div className="p-3 pb-2 flex items-center justify-between">
                                <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-colors ${isTodayDate ? "bg-primary text-primary-foreground shadow-sm" : "text-gray-700 dark:text-foreground group-hover/cell:bg-gray-100 dark:group-hover/cell:bg-muted/30"}`}>
                                  {day.getDate()}
                                </span>
                                {dayPosts.length > 0 && <span className="text-[10px] font-semibold bg-primary/10 text-primary rounded-full px-1.5 py-0.5">{dayPosts.length}</span>}
                              </div>
                              <div className="px-2 pb-2 flex flex-col gap-1">
                                <DayCellPosts day={day} />
                                {dayPosts.length === 0 && (
                                  <button className="opacity-0 group-hover/cell:opacity-100 transition-opacity mt-1 flex items-center gap-1 text-[10px] text-gray-400 dark:text-muted-foreground hover:text-primary px-1" onClick={(e) => { e.stopPropagation(); openCreatePostForDate(day); }}>
                                    <Plus className="h-3 w-3" /> Add
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* ── WEEK VIEW ──────────────────────────────────────────── */}
                  {calendarView === 'week' && (() => {
                    const weekStart = new Date(calendarDate);
                    weekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
                    const weekDays = Array.from({ length: 7 }, (_, i) => {
                      const d = new Date(weekStart);
                      d.setDate(weekStart.getDate() + i);
                      return d;
                    });
                    return (
                      <>
                        <div className="grid grid-cols-7 bg-gray-50/80 dark:bg-muted/5 border-b border-gray-100 dark:border-border/20">
                          {weekDays.map((d) => (
                            <div key={d.toISOString()} className={`text-center py-3 border-r border-gray-100 dark:border-border/20 last:border-r-0 ${isToday(d) ? 'bg-primary/5' : ''}`}>
                              <p className="text-[11px] font-bold text-gray-400 dark:text-muted-foreground uppercase tracking-wider">{d.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                              <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mx-auto mt-0.5 ${isToday(d) ? 'bg-primary text-primary-foreground' : 'text-gray-700 dark:text-foreground'}`}>{d.getDate()}</span>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 divide-x divide-gray-100 dark:divide-border/20">
                          {weekDays.map((d) => {
                            const dayPosts = getPostsForDate(d);
                            return (
                              <div
                                key={d.toISOString()}
                                className="min-h-[400px] flex flex-col p-2 gap-1 cursor-pointer group/cell hover:bg-blue-50/30 dark:hover:bg-muted/10 transition-colors"
                                onClick={() => { setCalendarDate(d); setSelectedDayForModal(d); }}
                                onDragOver={handleDragOver}
                                onDrop={(e) => void handleDrop(e, d)}
                              >
                                <DayCellPosts day={d} mini />
                                {dayPosts.length === 0 && (
                                  <button className="opacity-0 group-hover/cell:opacity-100 transition-opacity flex items-center gap-1 text-[10px] text-gray-400 dark:text-muted-foreground hover:text-primary p-1" onClick={(e) => { e.stopPropagation(); openCreatePostForDate(d); }}>
                                    <Plus className="h-3 w-3" /> Add
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}

                  {/* ── DAY VIEW ───────────────────────────────────────────── */}
                  {calendarView === 'day' && (() => {
                    const dayPosts = getPostsForDate(calendarDate);
                    return (
                      <div className="min-h-[400px] p-6">
                        {dayPosts.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-muted/30 flex items-center justify-center">
                              <CalendarDays className="h-6 w-6 text-gray-400 dark:text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-700 dark:text-foreground">No posts scheduled</p>
                              <p className="text-sm text-gray-400 dark:text-muted-foreground mt-0.5">Click below to schedule a post for this day.</p>
                            </div>
                            <button
                              className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                              onClick={() => openCreatePostForDate(calendarDate)}
                            >
                              <Plus className="h-4 w-4" /> Create post
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between mb-4">
                              <p className="text-sm font-semibold text-gray-700 dark:text-foreground">{dayPosts.length} post{dayPosts.length !== 1 ? 's' : ''} scheduled</p>
                              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 dark:border-border/50 text-xs font-medium text-gray-600 dark:text-muted-foreground hover:bg-gray-50 dark:hover:bg-muted/30 transition-colors" onClick={() => openCreatePostForDate(calendarDate)}>
                                <Plus className="h-3 w-3" /> Add post
                              </button>
                            </div>
                            {dayPosts.map((post) => {
                              const postPlatforms = post.platforms && post.platforms.length > 0 ? post.platforms : [post.content_type];
                              const timeStr = post.scheduled_at ? new Date(post.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Unscheduled';
                              return (
                                <div key={post.id} className="flex gap-4 p-4 rounded-xl border border-gray-100 dark:border-border/30 bg-gray-50/50 dark:bg-muted/5 hover:border-gray-200 dark:hover:border-border/60 transition-colors">
                                  <div className="flex flex-col items-center min-w-[52px]">
                                    <span className="text-xs font-bold text-primary">{timeStr}</span>
                                    <div className="flex-1 w-px bg-gray-200 dark:bg-border/30 mt-1" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <p className="text-sm font-semibold text-gray-800 dark:text-foreground truncate">{post.title || 'Untitled Post'}</p>
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize shrink-0 ${statusColors[post.status] || 'bg-muted text-muted-foreground'}`}>{post.status}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-muted-foreground line-clamp-2 mb-3" dangerouslySetInnerHTML={{ __html: post.content.replace(/<[^>]*>/g, '') }} />
                                    <div className="flex items-center gap-1.5">
                                      {postPlatforms.map((p) => {
                                        const Icon = channelIcons[p] || CalendarClock;
                                        return (
                                          <span key={p} className={`h-5 w-5 rounded-full flex items-center justify-center ${getBrandBg(p)}`}>
                                            <Icon className="h-2.5 w-2.5 text-white" />
                                          </span>
                                        );
                                      })}
                                      <button className="ml-auto text-[10px] text-gray-400 dark:text-muted-foreground hover:text-primary transition-colors" onClick={() => openReschedule(post)}>
                                        Reschedule
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
              {legend}
            </div>

          {unscheduledPosts.length > 0 && (
            <Card className="border-border/50 border-dashed">
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold font-display">Unscheduled ({unscheduledPosts.length})</h3>
                <p className="text-xs text-muted-foreground">These posts have no publish date. Drag onto the calendar or set a schedule.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {unscheduledPosts.slice(0, 9).map((post) => (
                    <div
                      key={post.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, post.id)}
                      className="rounded-md border border-border/60 p-2 text-xs bg-card cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-medium truncate">{post.title?.replace(/<[^>]*>/g, "") || "Untitled"}</span>
                        <Badge variant="outline" className="text-[9px] capitalize">{post.status}</Badge>
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => openReschedule(post)}>
                        Set schedule
                      </Button>
                    </div>
                  ))}
                </div>
                {unscheduledPosts.length > 9 && (
                  <p className="text-xs text-muted-foreground">+{unscheduledPosts.length - 9} more in list view</p>
                )}
              </CardContent>
            </Card>
          )}
          
          <CalendarDayModal
            isOpen={!!selectedDayForModal}
            onClose={() => setSelectedDayForModal(null)}
            date={selectedDayForModal}
            posts={selectedDayForModal ? getPostsForDate(selectedDayForModal) : []}
            workspaceName={activeWorkspaceObj?.name}
            onCreatePost={(date) => {
              setSelectedDayForModal(null);
              openCreatePostForDate(date);
            }}
          />
        </div>
        );
      })()}

      {view === "list" && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-lg font-display font-semibold">Publishing Queue</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={listFilter} onValueChange={(v) => setListFilter(v as ListFilter)}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="unscheduled">Unscheduled</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant={showTeam ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => setShowTeam((v) => !v)}
              >
                {showTeam ? <Users className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                {showTeam ? "Team" : "Mine"}
              </Button>
            </div>
          </div>

          {loadingPosts ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
            </div>
          ) : visiblePosts.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="p-8 text-center text-muted-foreground">
                No posts match this filter. Try another filter or schedule new content.
              </CardContent>
            </Card>
          ) : (
            visiblePosts.map(renderListPost)
          )}
        </div>
      )}

      {view === "automations" && (
        <AutomationSettingsTab />
      )}

      <Dialog open={reschedule != null} onOpenChange={(open) => !open && setReschedule(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Set publish date & time</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="reschedule-date">Date</Label>
              <Input id="reschedule-date" type="date" value={reschedule?.date ?? ""} onChange={(e) => setReschedule((prev) => (prev ? { ...prev, date: e.target.value } : prev))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reschedule-time">Time</Label>
              <Input id="reschedule-time" type="time" value={reschedule?.time ?? "09:00"} onChange={(e) => setReschedule((prev) => (prev ? { ...prev, time: e.target.value } : prev))} />
            </div>
          </div>
          <div className="flex justify-between items-center bg-muted/40 p-2.5 rounded-lg border border-border/50">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20" />
              Mako Scheduler
            </div>
            <Button type="button" variant="outline" size="sm" onClick={applyMakoSlot} className="h-7 text-[10px] px-2">
              Find next slot
            </Button>
          </div>
          {reschedule?.status === "draft" && (
            <p className="text-xs text-muted-foreground">Saving will approve this post for auto-publish.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReschedule(null)}>Cancel</Button>
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
                {previewPost.scheduled_date ? ` Scheduled for ${formatScheduleLabel(previewPost.scheduled_date, previewPost.scheduled_time)}.` : ""}
              </p>
              <PlatformPreviewPanel
                platforms={previewPost.platforms?.length ? previewPost.platforms : [previewPost.content_type]}
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
                <Button type="button" className="flex-1" onClick={() => { setPreviewPost(null); setPublishItem(postToContentItem(previewPost)); }}>
                  <Send className="h-4 w-4 mr-2" /> Edit & publish
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={!!publishItem} onOpenChange={(open) => { if (!open) setPublishItem(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl p-0 flex flex-col overflow-hidden">
          {publishItem && (
            <PublishPanel item={publishItem} onCancel={() => setPublishItem(null)} onPublished={() => { setPublishItem(null); void loadPosts(); }} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Scheduler;
