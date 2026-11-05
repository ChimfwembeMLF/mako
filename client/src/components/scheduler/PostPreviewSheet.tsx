import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Film, Images,
  Loader2, Paperclip, RotateCcw, Send, XCircle, AlertTriangle,
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformPreviewPanel } from "@/components/content/PlatformPreviewPanel";
import { contentItemsApi } from "@/lib/api";
import { sanitizeHtml } from "@/lib/sanitize";
import { formatScheduleLabel } from "@/lib/schedule";
import { buildPlatformPayloads, platformRequiresMedia, type PlatformPayload } from "@/lib/platforms";
import { getPostActions, getPostDisplayStatus, POST_STATUS_META } from "@/lib/post-status";
import type { ScheduledPost } from "@/lib/scheduler-post";
import { cn } from "@/lib/utils";

type Attachment = { id: string; url: string; type: "image" | "video"; name?: string; alt?: string };

type Publication = {
  id: string;
  platform: string;
  status: string;
  errorMessage?: string | null;
  publishedAt?: string | null;
};

/** Expands stored media rows into one entry per viewable file (a slideshow holds several images). */
function toAttachments(media: Array<Record<string, unknown>>): Attachment[] {
  const out: Attachment[] = [];
  for (const m of media) {
    const id = String(m.id);
    const type = String(m.mediaType ?? "image");
    const url = String(m.mediaUrl ?? "");
    const name = m.name != null ? String(m.name) : undefined;
    const alt = m.altText != null ? String(m.altText) : undefined;
    if (type === "slideshow") {
      try {
        (JSON.parse(url) as string[]).forEach((slide, i) =>
          out.push({ id: `${id}-${i}`, url: slide, type: "image", name: `${name ?? "Slide"} ${i + 1}`, alt }),
        );
      } catch {
        // A malformed slideshow is skipped rather than breaking the preview.
      }
    } else if (url) {
      out.push({ id, url, type: type === "video" ? "video" : "image", name, alt });
    }
  }
  return out;
}

function previewPayloads(post: ScheduledPost): Record<string, PlatformPayload> {
  if (post.platform_payloads && Object.keys(post.platform_payloads).length > 0) return post.platform_payloads;
  const platforms = post.platforms?.length ? post.platforms : [post.content_type];
  return buildPlatformPayloads(post.content, post.title ?? "", platforms);
}

export function PostStatusBadge({ post, className }: { post: ScheduledPost; className?: string }) {
  const meta = POST_STATUS_META[getPostDisplayStatus(post)];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", meta.badge, className)} title={meta.hint}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

interface PostPreviewSheetProps {
  post: ScheduledPost | null;
  onClose: () => void;
  channelLabels: Record<string, string>;
  channelIcons: Record<string, React.ComponentType<{ className?: string }>>;
  retrying: boolean;
  onApprove: (post: ScheduledPost) => Promise<void> | void;
  onReject: (post: ScheduledPost) => Promise<void> | void;
  onPublish: (post: ScheduledPost) => void;
  onRetry: (post: ScheduledPost) => Promise<void> | void;
  onReschedule: (post: ScheduledPost) => void;
}

export function PostPreviewSheet({
  post, onClose, channelLabels, channelIcons, retrying,
  onApprove, onReject, onPublish, onRetry, onReschedule,
}: PostPreviewSheetProps) {
  const [attachments, setAttachments] = useState<Attachment[] | null>(null);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [detailsFailed, setDetailsFailed] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [previewTab, setPreviewTab] = useState("facebook");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  const postId = post?.id;
  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    setAttachments(null);
    setPublications([]);
    setDetailsFailed(false);
    setViewer(null);
    contentItemsApi
      .getDetails(postId)
      .then((res: { media?: Array<Record<string, unknown>>; publications?: Publication[] }) => {
        if (cancelled) return;
        setAttachments(toAttachments(res?.media ?? []));
        setPublications(res?.publications ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setAttachments([]);
          setDetailsFailed(true);
        }
      });
    return () => { cancelled = true; };
  }, [postId]);

  useEffect(() => {
    if (post) setPreviewTab((post.platforms?.length ? post.platforms : [post.content_type])[0] ?? "facebook");
  }, [post]);

  const platforms = post ? (post.platforms?.length ? post.platforms : [post.content_type]) : [];
  const status = post ? getPostDisplayStatus(post) : "draft";
  const meta = POST_STATUS_META[status];
  const actions = getPostActions(status);
  const failedPublications = publications.filter((p) => p.status === "failed");
  const missingMediaFor = attachments && attachments.length === 0
    ? platforms.filter((p) => platformRequiresMedia(p))
    : [];

  const run = async (kind: "approve" | "reject", fn: () => Promise<void> | void) => {
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const viewing = viewer != null && attachments ? attachments[viewer] : null;

  return (
    <>
      <Sheet open={!!post} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col overflow-hidden">
          {post && (
            <>
              <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/60 space-y-3 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <PostStatusBadge post={post} />
                  {platforms.map((p) => {
                    const Icon = channelIcons[p];
                    return (
                      <span key={p} className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground">
                        {Icon && <Icon className="h-3 w-3" />}
                        {channelLabels[p] ?? p}
                      </span>
                    );
                  })}
                </div>
                <SheetTitle className="font-display text-xl leading-tight pr-6">{post.title || "Untitled post"}</SheetTitle>
                <SheetDescription className="flex items-center gap-1.5 text-sm">
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  {post.published_at
                    ? `Published ${new Date(post.published_at).toLocaleString()}`
                    : post.scheduled_date
                      ? formatScheduleLabel(post.scheduled_date, post.scheduled_time)
                      : "No publish date"}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                <div className={cn("rounded-xl border-l-4 bg-muted/40 px-4 py-3 text-sm", meta.edge)}>
                  <p className="font-semibold text-foreground">{meta.label}</p>
                  <p className="text-muted-foreground">{meta.hint}</p>
                  {status === "failed" && post.publish_failed_reason && (
                    <p className="mt-2 text-destructive">{post.publish_failed_reason}</p>
                  )}
                </div>

                {publications.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Per platform</h3>
                    <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
                      {publications.map((pub) => {
                        const Icon = channelIcons[pub.platform];
                        const ok = pub.status === "published";
                        return (
                          <li key={pub.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                            {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">{channelLabels[pub.platform] ?? pub.platform}</p>
                              {!ok && pub.errorMessage && <p className="text-xs text-destructive break-words">{pub.errorMessage}</p>}
                            </div>
                            <span className={cn("shrink-0 text-xs font-semibold", ok ? "text-green-700 dark:text-green-300" : "text-destructive")}>
                              {ok ? "Published" : "Failed"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Content</h3>
                  <div
                    className="text-sm leading-relaxed text-foreground break-words [&_p]:mb-2 [&_p:last-child]:mb-0 [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
                  />
                </section>

                <section className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Paperclip className="h-3.5 w-3.5" />
                    Attachments{attachments && attachments.length > 0 ? ` (${attachments.length})` : ""}
                  </h3>
                  {attachments === null ? (
                    <div className="grid grid-cols-3 gap-2">
                      {Array.from({ length: Math.min(3, Math.max(1, post.media_count)) }).map((_, i) => (
                        <Skeleton key={i} className="aspect-square rounded-lg" />
                      ))}
                    </div>
                  ) : attachments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {detailsFailed ? "Could not load attachments." : "No attachments."}
                    </p>
                  ) : (
                    <ul className="grid grid-cols-3 gap-2">
                      {attachments.map((a, i) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => setViewer(i)}
                            className="group relative block aspect-square w-full overflow-hidden rounded-lg border border-border/60 bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`Open ${a.name ?? `attachment ${i + 1}`}`}
                          >
                            {a.type === "video" ? (
                              <>
                                <video src={a.url} className="h-full w-full object-cover" muted preload="metadata" />
                                <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                                  <Film className="h-6 w-6 text-white" />
                                </span>
                              </>
                            ) : (
                              <img src={a.url} alt={a.alt ?? ""} loading="lazy" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {missingMediaFor.length > 0 && (
                    <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {missingMediaFor.map((p) => channelLabels[p] ?? p).join(", ")} needs an image or video, so this will fail to publish there.
                    </p>
                  )}
                </section>

                <section className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Images className="h-3.5 w-3.5" /> How it will look
                  </h3>
                  <PlatformPreviewPanel
                    platforms={platforms}
                    platformPayloads={previewPayloads(post)}
                    title={post.title ?? ""}
                    baseContent={post.content}
                    previewTab={previewTab}
                    onPreviewTabChange={setPreviewTab}
                  />
                </section>
              </div>

              <div className="border-t border-border/60 bg-card px-6 py-4 flex flex-wrap gap-2">
                {actions.retry && (
                  <Button onClick={() => void onRetry(post)} disabled={retrying} className="gap-1.5">
                    {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Retry
                  </Button>
                )}
                {actions.approve && (
                  <Button onClick={() => void run("approve", () => onApprove(post))} disabled={busy !== null} className="gap-1.5">
                    {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve
                  </Button>
                )}
                {actions.publishNow && (
                  <Button variant={actions.approve ? "outline" : "default"} onClick={() => onPublish(post)} className="gap-1.5">
                    <Send className="h-4 w-4" /> Publish now
                  </Button>
                )}
                {actions.reschedule && (
                  <Button variant="outline" onClick={() => onReschedule(post)} className="gap-1.5">
                    <CalendarDays className="h-4 w-4" /> {post.scheduled_date ? "Reschedule" : "Set date"}
                  </Button>
                )}
                <Button variant="ghost" asChild className="gap-1.5">
                  <Link to={`/content/${post.id}`}>
                    <ExternalLink className="h-4 w-4" /> Edit
                  </Link>
                </Button>
                {actions.reject && (
                  <Button
                    variant="ghost"
                    onClick={() => void run("reject", () => onReject(post))}
                    disabled={busy !== null}
                    className="ml-auto gap-1.5 text-destructive hover:text-destructive"
                  >
                    {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Reject
                  </Button>
                )}
                {failedPublications.length > 0 && !actions.retry && (
                  <p className="w-full text-xs text-destructive">
                    {failedPublications.length} platform{failedPublications.length === 1 ? "" : "s"} failed. Open Edit to fix and republish.
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={viewing != null} onOpenChange={(open) => { if (!open) setViewer(null); }}>
        <DialogContent className="max-w-4xl border-0 bg-black/95 p-2 sm:p-4">
          <DialogTitle className="sr-only">{viewing?.name ?? "Attachment"}</DialogTitle>
          {viewing && attachments && (
            <div className="relative flex items-center justify-center">
              {viewing.type === "video" ? (
                <video src={viewing.url} controls autoPlay className="max-h-[80vh] w-full rounded-lg" />
              ) : (
                <img src={viewing.url} alt={viewing.alt ?? ""} className="max-h-[80vh] w-auto rounded-lg object-contain" />
              )}
              {attachments.length > 1 && (
                <>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full"
                    onClick={() => setViewer((v) => (v == null ? v : (v - 1 + attachments.length) % attachments.length))}
                    aria-label="Previous attachment"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full"
                    onClick={() => setViewer((v) => (v == null ? v : (v + 1) % attachments.length))}
                    aria-label="Next attachment"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                  <p className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                    {(viewer ?? 0) + 1} / {attachments.length}
                  </p>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
