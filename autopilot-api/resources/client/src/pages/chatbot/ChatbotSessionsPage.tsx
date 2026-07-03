import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, MessageSquare } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { useWorkspace } from "@/hooks/useWorkspace";
import { usePermissions } from "@/hooks/usePermissions";
import { P } from "@/lib/permissions";
import { chatbotApi } from "@/lib/api";
import { ChatPanel } from "@/components/chatbot/ChatPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function ChatbotSessionsPage() {
  const { tenant } = useTenant();
  const { activeWorkspace } = useWorkspace();
  const { can } = usePermissions();
  const tenantId = tenant?.id ?? "";
  const workspaceId = activeWorkspace ?? undefined;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["chatbot-sessions", tenantId, activeWorkspace],
    queryFn: () => chatbotApi.listSessions(tenantId, undefined, workspaceId),
    enabled: Boolean(tenantId && activeWorkspace) && can(P.chatbot.view),
  });

  const messagesQuery = useQuery({
    queryKey: ["chatbot-messages", tenantId, activeWorkspace, selectedId],
    queryFn: () => chatbotApi.getMessages(tenantId, selectedId!, workspaceId),
    enabled: Boolean(tenantId && activeWorkspace && selectedId),
  });

  if (!can(P.chatbot.view)) {
    return <div className="p-8 text-center text-muted-foreground">Access denied</div>;
  }

  return (
    <div className="w-full py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl gradient-primary text-white">
          <History className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-semibold">Conversation log</h1>
          <p className="text-sm text-muted-foreground">Admin and widget chat history</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[520px] overflow-y-auto">
            {!sessionsQuery.data?.length && (
              <p className="text-sm text-muted-foreground py-4 text-center">No sessions yet</p>
            )}
            {sessionsQuery.data?.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  "w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors",
                  selectedId === s.id && "border-primary bg-muted/30",
                )}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium truncate">
                    {s.title || "Untitled"}
                  </span>
                </div>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px]">{s.channel}</Badge>
                  {s.lastMessageAt && (
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(s.lastMessageAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Transcript</CardTitle>
          </CardHeader>
          <CardContent className="h-[480px]">
            {selectedId ? (
              <ChatPanel
                messages={messagesQuery.data ?? []}
                onSend={async () => {}}
                emptyHint="No messages"
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-16">
                Select a session to view messages
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
