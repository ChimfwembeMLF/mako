import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarPlus, CheckCircle2, Clock, FileText, Paperclip, Plus } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { formatTimeDisplay } from "@/lib/schedule";
import { getPostDisplayStatus, POST_STATUS_META } from "@/lib/post-status";
import type { ScheduledPost } from "@/lib/scheduler-post";
import { PostStatusBadge } from "./PostPreviewSheet";
import { cn } from "@/lib/utils";

interface CalendarDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
  posts: ScheduledPost[];
  unscheduledPosts: ScheduledPost[];
  workspaceName?: string;
  channelIcons: Record<string, React.ComponentType<{ className?: string }>>;
  onCreatePost: (date: Date) => void;
  onOpenPost: (post: ScheduledPost) => void;
  onScheduleDraft: (post: ScheduledPost, date: Date) => void;
}

function plainText(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function PostThumb({ post, channelIcons }: { post: ScheduledPost; channelIcons: CalendarDayModalProps["channelIcons"] }) {
  const platform = post.platforms?.[0] ?? post.content_type;
  const Icon = channelIcons[platform] ?? FileText;
  let src = post.media_type === "video" ? null : post.media_url;
  if (post.media_type === "slideshow" && post.media_url) {
    try {
      src = (JSON.parse(post.media_url) as string[])[0] ?? null;
    } catch {
      src = null;
    }
  }
  return (
    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted">
      {src ? <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Icon className="h-5 w-5 text-muted-foreground" />}
    </span>
  );
}

export function CalendarDayModal({
  isOpen,
  onClose,
  date,
  posts,
  unscheduledPosts,
  workspaceName = "your workspace",
  channelIcons,
  onCreatePost,
  onOpenPost,
  onScheduleDraft,
}: CalendarDayModalProps) {
  if (!date) return null;

  const dateString = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const needsApproval = posts.filter((p) => getPostDisplayStatus(p) === "needs_approval").length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60 text-left">
          <DialogTitle className="text-xl font-bold">{dateString}</DialogTitle>
          <DialogDescription>
            {posts.length} post{posts.length !== 1 ? "s" : ""} for <span className="font-medium text-foreground">{workspaceName}</span>
            {needsApproval > 0 && ` · ${needsApproval} waiting for approval`}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-primary" /> On this day
              </h3>
              <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => onCreatePost(date)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> New post
              </Button>
            </div>

            {posts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Nothing scheduled</p>
                <p className="text-xs mt-1">Create a post, or place one of the drafts below on this day.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {posts.map((post) => {
                  const meta = POST_STATUS_META[getPostDisplayStatus(post)];
                  return (
                    <li key={post.id}>
                      <button
                        type="button"
                        onClick={() => onOpenPost(post)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border border-border/60 border-l-4 bg-card p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          meta.edge,
                        )}
                      >
                        <PostThumb post={post} channelIcons={channelIcons} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary tabular-nums">{formatTimeDisplay(post.scheduled_time) ?? "Any time"}</span>
                            <PostStatusBadge post={post} />
                          </span>
                          <span className="mt-1 block truncate text-sm font-medium">{post.title || "Untitled post"}</span>
                          <span className="block truncate text-xs text-muted-foreground">{plainText(post.content)}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className="flex -space-x-1">
                            {(post.platforms?.length ? post.platforms : [post.content_type]).map((p) => {
                              const Icon = channelIcons[p];
                              return Icon ? (
                                <span key={p} className="flex h-5 w-5 items-center justify-center rounded-full border border-card bg-muted">
                                  <Icon className="h-3 w-3 text-muted-foreground" />
                                </span>
                              ) : null;
                            })}
                          </span>
                          {post.media_count > 0 && (
                            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground" title={`${post.media_count} attachment${post.media_count === 1 ? "" : "s"}`}>
                              <Paperclip className="h-3 w-3" /> {post.media_count}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="h-4 w-4 text-muted-foreground" /> Unscheduled drafts
                </h3>
                <p className="text-xs text-muted-foreground">Written but not on the calendar yet.</p>
              </div>
              <Button variant="outline" size="sm" className="h-8 rounded-full text-xs" asChild>
                <RouterLink to="/content" onClick={onClose}>View all</RouterLink>
              </Button>
            </div>

            {unscheduledPosts.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> No unscheduled drafts.
              </p>
            ) : (
              <ul className="space-y-2">
                {unscheduledPosts.slice(0, 8).map((draft) => (
                  <li key={draft.id} className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpenPost(draft)}>
                      <span className="block truncate text-sm font-medium hover:underline">
                        {draft.title || plainText(draft.content).slice(0, 60) || "Untitled draft"}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {(draft.platforms?.length ? draft.platforms : [draft.content_type]).join(", ")}
                        {draft.media_count > 0 && ` · ${draft.media_count} attachment${draft.media_count === 1 ? "" : "s"}`}
                      </span>
                    </button>
                    <Button size="sm" variant="outline" className="h-8 shrink-0 rounded-full text-xs" onClick={() => onScheduleDraft(draft, date)}>
                      <CalendarPlus className="h-3.5 w-3.5 mr-1" /> Place here
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
