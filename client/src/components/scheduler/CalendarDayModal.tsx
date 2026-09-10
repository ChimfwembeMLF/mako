import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Clock, CheckCircle2, Send, Loader2, Link } from "lucide-react";
import { ScheduledPost } from "../../hooks/api/useContentItems";
import { contentItemsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Link as RouterLink } from "react-router-dom";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  approved: "bg-blue-100 text-blue-700",
  scheduled: "bg-purple-100 text-purple-700",
  published: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

interface CalendarDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
  posts: ScheduledPost[];
  workspaceName?: string;
  onCreatePost: (date: Date) => void;
}

export function CalendarDayModal({
  isOpen,
  onClose,
  date,
  posts,
  workspaceName = "your workspace",
  onCreatePost,
}: CalendarDayModalProps) {
  const { session } = useAuth();
  const { tenant } = useTenant();
  const { activeWorkspace } = useWorkspace();
  const [draftPosts, setDraftPosts] = useState<any[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  useEffect(() => {
    if (!isOpen || !tenant?.id || !activeWorkspace) return;
    setLoadingDrafts(true);
    contentItemsApi
      .findAll(tenant.id, { workspaceId: activeWorkspace, limit: 8 })
      .then((data: any) => {
        const items = Array.isArray(data) ? data : data?.items ?? [];
        setDraftPosts(items.filter((i: any) => i.status === "draft" && !i.scheduled_at));
      })
      .catch(() => setDraftPosts([]))
      .finally(() => setLoadingDrafts(false));
  }, [isOpen, tenant?.id, activeWorkspace]);

  if (!date) return null;

  const dateString = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-white dark:bg-[#0f0f0f] border border-gray-200/60 dark:border-border/20 p-0 text-foreground shadow-2xl overflow-hidden gap-0 rounded-2xl">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-border/10">
          <DialogTitle className="text-xl font-bold">{dateString}</DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            {posts.length} scheduled post{posts.length !== 1 ? "s" : ""} for{" "}
            <span className="font-medium text-foreground">{workspaceName}</span>.
            {posts.some((p) => p.status === "draft" || p.status === "scheduled") &&
              " Pending posts require approval."}
          </p>
        </DialogHeader>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto bg-gray-50/40 dark:bg-[#0a0a0a]">
          {/* Scheduled Posts Section */}
          <div className="bg-white dark:bg-card border border-gray-100 dark:border-border/20 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-border/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Scheduled Posts</h3>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs rounded-full"
                onClick={() => onCreatePost(date)}
              >
                <Plus className="h-3 w-3 mr-1" /> New post
              </Button>
            </div>

            <div className="p-4">
              {posts.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-muted/30 flex items-center justify-center mx-auto mb-3">
                    <Clock className="h-5 w-5 text-gray-400" />
                  </div>
                  <p className="font-medium text-gray-600 dark:text-foreground">No posts scheduled</p>
                  <p className="text-xs mt-1">Create a post or schedule an unscheduled draft below.</p>
                  <Button
                    className="mt-4 rounded-full h-8 text-xs"
                    onClick={() => onCreatePost(date)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Create post
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {posts.map((post) => {
                    const timeStr = post.scheduled_at
                      ? new Date(post.scheduled_at).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : null;
                    return (
                      <div
                        key={post.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-border/20 bg-gray-50/50 dark:bg-muted/5 hover:border-gray-200 dark:hover:border-border/50 transition-colors"
                      >
                        {timeStr && (
                          <span className="text-[11px] font-bold text-primary min-w-[40px] shrink-0">
                            {timeStr}
                          </span>
                        )}
                        <span className="text-sm font-medium flex-1 truncate">
                          {post.title || "Untitled Post"}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize shrink-0 ${
                            statusColors[post.status] ?? "bg-muted text-muted-foreground"
                          }`}
                        >
                          {post.status}
                        </span>
                        <RouterLink
                          to={`/content/${post.id}`}
                          className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                          onClick={onClose}
                        >
                          <Link className="h-3.5 w-3.5" />
                        </RouterLink>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Unscheduled Drafts Section */}
          <div className="bg-white dark:bg-card border border-gray-100 dark:border-border/20 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-border/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold text-sm">Unscheduled Drafts</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Posts written but not yet placed on the calendar.
                  </p>
                </div>
              </div>
              <RouterLink to="/content" onClick={onClose}>
                <Button variant="outline" size="sm" className="h-7 text-xs rounded-full">
                  View all
                </Button>
              </RouterLink>
            </div>

            <div className="p-4">
              {loadingDrafts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : draftPosts.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-400" />
                  <p className="font-medium">All caught up!</p>
                  <p className="text-xs mt-1">No unscheduled drafts in this workspace.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {draftPosts.map((draft) => (
                    <div
                      key={draft.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-border/20 bg-gray-50/50 dark:bg-muted/5 hover:border-primary/30 hover:bg-primary/5 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {draft.title || draft.content?.replace(/<[^>]*>/g, "").slice(0, 60) || "Untitled Draft"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">
                          {draft.content_type || draft.platforms?.[0] || "post"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] px-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                        onClick={() => {
                          onClose();
                          // Navigate to the content item to schedule it
                          window.location.href = `/content/${draft.id}`;
                        }}
                      >
                        <Send className="h-2.5 w-2.5 mr-1" /> Schedule
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
