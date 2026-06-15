import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CloudUpload,
  FileText,
  MessageSquare,
  Pencil,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTenant } from "@/hooks/useTenant";
import { useWorkspace } from "@/hooks/useWorkspace";
import { usePermissions } from "@/hooks/usePermissions";
import { P } from "@/lib/permissions";
import { knowledgeApi } from "@/lib/api";
import { KNOWLEDGE_UPLOAD_ACCEPT, KNOWLEDGE_UPLOAD_HINT } from "@/lib/knowledge-upload";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PermissionGate } from "@/components/PermissionGate";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ready: "default",
  pending: "secondary",
  processing: "secondary",
  failed: "destructive",
};

export default function ChatbotKnowledgePage() {
  const { tenant } = useTenant();
  const { activeWorkspace } = useWorkspace();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id ?? "";
  const workspaceId = activeWorkspace ?? undefined;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const docsQuery = useQuery({
    queryKey: ["knowledge-docs", tenantId, activeWorkspace],
    queryFn: () => knowledgeApi.list(tenantId, workspaceId),
    enabled: Boolean(tenantId && activeWorkspace) && can(P.chatbot.view),
    refetchInterval: (q) => {
      const docs = q.state.data;
      if (docs?.some((d) => d.status === "pending" || d.status === "processing")) return 3000;
      return false;
    },
  });

  const upload = useMutation({
    mutationFn: (file: File) => knowledgeApi.upload(file, tenantId, workspaceId),
    onSuccess: () => {
      toast.success("Document uploaded — indexing started");
      void queryClient.invalidateQueries({ queryKey: ["knowledge-docs", tenantId, activeWorkspace] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => knowledgeApi.delete(tenantId, id, workspaceId),
    onSuccess: () => {
      toast.success("Document removed");
      void queryClient.invalidateQueries({ queryKey: ["knowledge-docs", tenantId, activeWorkspace] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rename = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      knowledgeApi.rename(tenantId, id, title, workspaceId),
    onSuccess: () => {
      toast.success("Document renamed");
      setEditingId(null);
      void queryClient.invalidateQueries({ queryKey: ["knowledge-docs", tenantId, activeWorkspace] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reindex = useMutation({
    mutationFn: (id: string) => knowledgeApi.reindex(tenantId, id, workspaceId),
    onSuccess: () => {
      toast.success("Re-indexing started");
      void queryClient.invalidateQueries({ queryKey: ["knowledge-docs", tenantId, activeWorkspace] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncMistral = useMutation({
    mutationFn: () => knowledgeApi.syncMistral(tenantId, workspaceId),
    onSuccess: () => {
      toast.success("Documents sent to Mistral for indexing");
      void queryClient.invalidateQueries({ queryKey: ["knowledge-docs", tenantId, activeWorkspace] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const docs = docsQuery.data ?? [];
  const readyCount = docs.filter((d) => d.status === "ready").length;
  const indexingCount = docs.filter((d) => d.status === "pending" || d.status === "processing").length;

  if (!can(P.chatbot.view)) {
    return <div className="p-8 text-center text-muted-foreground">Access denied</div>;
  }

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl gradient-primary text-white shrink-0">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-semibold">Knowledge Library</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Manage all documents that ground your chatbot. Files are chunked and embedded for
              retrieval at query time — not model fine-tuning.
            </p>
            {docs.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="secondary">{docs.length} document{docs.length === 1 ? "" : "s"}</Badge>
                {readyCount > 0 && <Badge variant="default">{readyCount} ready</Badge>}
                {indexingCount > 0 && (
                  <Badge variant="outline">{indexingCount} indexing</Badge>
                )}
              </div>
            )}
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link to="/chatbot">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to playground
          </Link>
        </Button>
      </div>

      <PermissionGate require={P.chatbot.manage}>
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Upload documents</CardTitle>
              <CardDescription>Add new files to the library</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={syncMistral.isPending || !docs.length}
              onClick={() => syncMistral.mutate()}
            >
              <CloudUpload className="h-4 w-4 mr-2" />
              {syncMistral.isPending ? "Syncing…" : "Sync to Mistral"}
            </Button>
          </CardHeader>
          <CardContent>
            <FileDropzone
              accept={KNOWLEDGE_UPLOAD_ACCEPT}
              hint={KNOWLEDGE_UPLOAD_HINT}
              loading={upload.isPending}
              emptyIcon={<FileText className="h-5 w-5" />}
              onFile={(file) => upload.mutate(file)}
            />
          </CardContent>
        </Card>
      </PermissionGate>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All documents</CardTitle>
          <CardDescription>Rename, re-index, or remove files</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!docs.length && (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                No documents yet. Upload your first file above, or add one from the playground.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/chatbot">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Open playground
                </Link>
              </Button>
            </div>
          )}
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/30"
            >
              <div className="min-w-0 flex-1">
                {editingId === doc.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="h-8 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editTitle.trim()) {
                          rename.mutate({ id: doc.id, title: editTitle.trim() });
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={!editTitle.trim() || rename.isPending}
                      onClick={() => rename.mutate({ id: doc.id, title: editTitle.trim() })}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="font-medium truncate">{doc.title}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {doc.status === "ready"
                    ? `${doc.chunkCount} chunk${doc.chunkCount === 1 ? "" : "s"} · used by chatbot`
                    : doc.chunkCount > 0
                      ? `${doc.chunkCount} chunks`
                      : "—"}
                  {doc.errorMessage && ` · ${doc.errorMessage}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={STATUS_VARIANT[doc.status] ?? "outline"}>{doc.status}</Badge>
                <PermissionGate require={P.chatbot.manage}>
                  {editingId !== doc.id && (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Rename"
                      onClick={() => {
                        setEditingId(doc.id);
                        setEditTitle(doc.title);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => reindex.mutate(doc.id)}
                    title="Re-index"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove.mutate(doc.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </PermissionGate>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
