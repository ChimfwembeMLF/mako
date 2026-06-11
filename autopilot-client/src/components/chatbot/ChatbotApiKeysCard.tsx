import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { chatbotApi, type ChatbotApiKeySummary } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ChatbotApiKeysCardProps = {
  tenantId: string;
  keys: ChatbotApiKeySummary[];
  widgetEnabled?: boolean;
  onSecretCreated?: (secret: string) => void;
};

function formatWhen(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ChatbotApiKeysCard({
  tenantId,
  keys,
  widgetEnabled,
  onSecretCreated,
}: ChatbotApiKeysCardProps) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("Website widget");
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const activeKeys = keys.filter((k) => !k.revokedAt);

  const createKey = useMutation({
    mutationFn: () => chatbotApi.createApiKey(tenantId, label.trim() || "API key"),
    onSuccess: (data) => {
      setNewSecret(data.secret);
      onSecretCreated?.(data.secret);
      toast.success("API key created — copy it now; it won't be shown again");
      void queryClient.invalidateQueries({ queryKey: ["chatbot-config", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeKey = useMutation({
    mutationFn: (keyId: string) => chatbotApi.revokeApiKey(tenantId, keyId),
    onSuccess: () => {
      toast.success("API key revoked");
      setRevokeId(null);
      void queryClient.invalidateQueries({ queryKey: ["chatbot-config", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            API keys
          </CardTitle>
          <CardDescription>
            Issue keys for the embeddable widget or server-side integrations. Keys authenticate
            requests to <code className="text-xs">/api/v1/widget/*</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!widgetEnabled && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
              Enable the widget in Settings before keys will work on your site.
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="key-label">Key name</Label>
              <Input
                id="key-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Production website, Mobile app"
              />
            </div>
            <Button
              onClick={() => createKey.mutate()}
              disabled={createKey.isPending}
              className="shrink-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              {createKey.isPending ? "Creating…" : "Create API key"}
            </Button>
          </div>

          {newSecret && (
            <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium">Copy your new key — shown once only</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="flex-1 break-all rounded-lg bg-background px-3 py-2 text-xs font-mono ring-1 ring-border">
                  {newSecret}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(newSecret);
                    toast.success("API key copied");
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Active keys ({activeKeys.length})
            </p>
            {!activeKeys.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center rounded-lg border border-dashed">
                No API keys yet. Create one to embed the chatbot or call the widget API.
              </p>
            ) : (
              <ul className="divide-y rounded-xl border overflow-hidden">
                {activeKeys.map((k) => (
                  <li
                    key={k.id}
                    className="flex flex-col gap-2 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {k.keyPrefix}…
                        </Badge>
                        {k.label && (
                          <span className="text-sm font-medium truncate">{k.label}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Created {formatWhen(k.created_at)}
                        {k.lastUsedAt ? ` · Last used ${formatWhen(k.lastUsedAt)}` : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive shrink-0 self-end sm:self-center"
                      onClick={() => setRevokeId(k.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Use <code className="text-foreground">Authorization: Bearer pk_live_…</code> or{" "}
            <code className="text-foreground">data-key</code> in the embed snippet. See{" "}
            <strong>Integration examples</strong> below for cURL, JavaScript, and OpenAPI.
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(revokeId)} onOpenChange={(open) => !open && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
            <AlertDialogDescription>
              Any site or integration using this key will stop working immediately. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => revokeId && revokeKey.mutate(revokeId)}
            >
              {revokeKey.isPending ? "Revoking…" : "Revoke key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
