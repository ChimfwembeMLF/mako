import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Bot, FileText, ImagePlus, Key, MessageSquare, Settings2 } from "lucide-react";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { GradientColorPicker } from "@/components/chatbot/GradientColorPicker";
import { ChatbotApiKeysCard } from "@/components/chatbot/ChatbotApiKeysCard";
import { ChatbotIntegrationExamples } from "@/components/chatbot/ChatbotIntegrationExamples";
import { toast } from "sonner";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { P } from "@/lib/permissions";
import { chatbotApi, knowledgeApi, resolveApiBaseUrl, type ChatMessage, type ChatbotConfig } from "@/lib/api";
import { KNOWLEDGE_UPLOAD_ACCEPT, KNOWLEDGE_UPLOAD_HINT } from "@/lib/knowledge-upload";
import { preloadAvatarModel } from "@/lib/chat-avatar";
import { preloadGltfAvatar } from "@/components/chatbot/avatar/gltf-setup";
import { ChatPanel } from "@/components/chatbot/ChatPanel";
import { TtsVoiceSettings } from "@/components/chatbot/TtsVoiceSettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PermissionGate } from "@/components/PermissionGate";
import { Link } from "react-router-dom";

type WidgetThemeDraft = {
  avatarMode?: "image" | "3d" | "ar";
  avatarModelUrl?: string;
  arEnabled?: boolean;
  arMarkerUrl?: string;
  avatarUrl?: string;
  primaryColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  gradientAngle?: number;
};

export default function ChatbotPage() {
  const { tenant } = useTenant();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id ?? "";

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState<Partial<ChatbotConfig>>({});
  const [embedKeySecret, setEmbedKeySecret] = useState<string | null>(null);
  const avatarModelInputRef = useRef<HTMLInputElement>(null);

  const widgetTheme = (draft.widgetTheme ?? {}) as WidgetThemeDraft;
  const avatarUrl = widgetTheme.avatarUrl ?? "";
  const avatarMode = widgetTheme.avatarMode ?? "image";

  const patchTheme = (patch: Partial<WidgetThemeDraft>) =>
    setDraft((d) => ({
      ...d,
      widgetTheme: { ...(d.widgetTheme as object), ...patch },
    }));

  const configQuery = useQuery({
    queryKey: ["chatbot-config", tenantId],
    queryFn: () => chatbotApi.getConfig(tenantId),
    enabled: Boolean(tenantId) && can(P.chatbot.view),
  });

  useEffect(() => {
    if (configQuery.data?.config) {
      setDraft(configQuery.data.config);
    }
  }, [configQuery.data?.config]);

  useEffect(() => {
    if (avatarMode === "3d" || avatarMode === "ar") {
      const url = widgetTheme.avatarModelUrl?.trim();
      preloadAvatarModel(url);
      if (url) preloadGltfAvatar(url);
    }
  }, [avatarMode, widgetTheme.avatarModelUrl]);

  const startSession = useCallback(async () => {
    if (!tenantId || !can(P.chatbot.use)) return;
    const session = await chatbotApi.createSession(tenantId);
    setSessionId(session.id);
    const msgs = await chatbotApi.getMessages(tenantId, session.id);
    setMessages(msgs);
  }, [tenantId, can]);

  useEffect(() => {
    if (tenantId && can(P.chatbot.use) && !sessionId) {
      void startSession();
    }
  }, [tenantId, can, sessionId, startSession]);

  const saveConfig = useMutation({
    mutationFn: () => chatbotApi.updateConfig({ tenantId, ...draft }),
    onSuccess: () => {
      toast.success("Chatbot settings saved");
      void queryClient.invalidateQueries({ queryKey: ["chatbot-config", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => chatbotApi.uploadAvatar(file, tenantId),
    onSuccess: (config) => {
      setDraft(config);
      toast.success("Avatar updated");
      void queryClient.invalidateQueries({ queryKey: ["chatbot-config", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadKnowledge = useMutation({
    mutationFn: (file: File) => knowledgeApi.upload(file, tenantId),
    onSuccess: () => {
      toast.success("Document uploaded — indexing started");
      void queryClient.invalidateQueries({ queryKey: ["knowledge-docs", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadAvatarModel = useMutation({
    mutationFn: (file: File) => chatbotApi.uploadAvatarModel(file, tenantId),
    onSuccess: (config) => {
      setDraft(config);
      toast.success("3D avatar model uploaded");
      void queryClient.invalidateQueries({ queryKey: ["chatbot-config", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSend = async (content: string) => {
    if (!sessionId || !tenantId) return;
    setSending(true);
    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const res = await chatbotApi.sendMessage(tenantId, sessionId, content);
      const assistant: ChatMessage = {
        id: res.messageId,
        role: "assistant",
        content: res.content,
        citations: res.citations,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistant]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  if (!can(P.chatbot.view)) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        You don&apos;t have permission to view the chatbot.
      </div>
    );
  }

  const apiBase = resolveApiBaseUrl();
  const widgetSnippet = embedKeySecret
    ? `<script async src="${window.location.origin}/widget/v1/loader.js" data-key="${embedKeySecret}" data-api="${apiBase}"></script>`
    : `<script async src="${window.location.origin}/widget/v1/loader.js" data-key="pk_live_YOUR_KEY" data-api="${apiBase}"></script>`;

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl gradient-primary text-white">
          <Bot className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-semibold">AI Chatbot</h1>
          <p className="text-sm text-muted-foreground">
            Brand Brain–powered assistant with document knowledge
          </p>
        </div>
      </div>

      <Tabs defaultValue="playground">
        <TabsList>
          <TabsTrigger value="playground" className="gap-1.5">
            <MessageSquare className="h-4 w-4" /> Playground
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings2 className="h-4 w-4" /> Settings
          </TabsTrigger>
          <TabsTrigger value="embed" className="gap-1.5">
            <Key className="h-4 w-4" /> Embed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="playground" className="mt-4">
          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Test chat</CardTitle>
                <CardDescription>
                  Messages use Brand Brain + uploaded knowledge documents
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[480px]">
                <PermissionGate require={P.chatbot.use}>
                  <ChatPanel
                    messages={messages}
                    onSend={handleSend}
                    sending={sending}
                    emptyHint="Start a conversation to test your bot"
                    botName={draft.name ?? configQuery.data?.config.name ?? "Assistant"}
                    avatarTheme={widgetTheme}
                    ttsEnabled={draft.widgetTtsEnabled ?? configQuery.data?.config.widgetTtsEnabled}
                    onSpeak={
                      sessionId
                        ? (messageId) => chatbotApi.fetchSpeech(tenantId, sessionId, messageId)
                        : undefined
                    }
                  />
                </PermissionGate>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Knowledge</CardTitle>
                <CardDescription>
                  Quick upload while testing — manage all documents in the library
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <PermissionGate require={P.chatbot.manage}>
                  <FileDropzone
                    accept={KNOWLEDGE_UPLOAD_ACCEPT}
                    hint={KNOWLEDGE_UPLOAD_HINT}
                    loading={uploadKnowledge.isPending}
                    emptyIcon={<FileText className="h-5 w-5" />}
                    onFile={(file) => uploadKnowledge.mutate(file)}
                  />
                </PermissionGate>

                <Button asChild variant="outline" className="w-full" size="sm">
                  <Link to="/chatbot/knowledge" className="gap-2">
                    <BookOpen className="h-4 w-4" />
                    Manage in Knowledge Library
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <PermissionGate require={P.chatbot.manage}>
            <div className="space-y-4 max-w-2xl">
<Card>
                <CardHeader>
                  <CardTitle className="text-base">Appearance</CardTitle>
                  <CardDescription>Widget branding and launcher style</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Bot logo</Label>
                    <FileDropzone
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      hint="PNG, JPG, WebP or GIF · max 2 MB"
                      loading={uploadAvatar.isPending}
                      previewUrl={avatarUrl || undefined}
                      emptyIcon={<Bot className="h-5 w-5" />}
                      onFile={(file) => uploadAvatar.mutate(file)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Chatbot colors</Label>
                    <p className="text-xs text-muted-foreground">
                      Pick a gradient for the widget header, launcher, and user messages.
                    </p>
                    <GradientColorPicker
                      value={widgetTheme}
                      onChange={(colors) => patchTheme(colors)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">General</CardTitle>
                  <CardDescription>Display name and first message visitors see</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Bot name</Label>
                    <Input
                      value={draft.name ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Welcome message</Label>
                    <Textarea
                      value={draft.welcomeMessage ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, welcomeMessage: e.target.value }))}
                      rows={2}
                      placeholder="Hi! How can I help you today?"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">System message</CardTitle>
                  <CardDescription>
                    Core instructions for every reply — tone, policies, and what the bot should or
                    should not do. Combined with your Brand Brain and knowledge documents. All
                    tenants start with a sensible default; customize it here.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Label htmlFor="system-message" className="sr-only">
                    System message
                  </Label>
                  <Textarea
                    id="system-message"
                    value={draft.systemPromptExtra ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, systemPromptExtra: e.target.value }))
                    }
                    rows={8}
                    className="font-mono text-sm"
                    placeholder={`Example:\nYou are a helpful support agent for our company.\n- Be concise and friendly.\n- Never invent prices or policies — say you don't know if unsure.\n- For billing issues, ask the user to email support@company.com.\n- Do not provide medical or legal advice.`}
                  />
                  <p className="text-xs text-muted-foreground">
                    {(draft.systemPromptExtra ?? "").length.toLocaleString()} characters · Saved
                    when you click Save settings
                  </p>
                </CardContent>
              </Card>              

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Knowledge &amp; retrieval</CardTitle>
                  <CardDescription>How the bot finds answers in your documents</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label>RAG (document retrieval)</Label>
                      <p className="text-xs text-muted-foreground">
                        Self-hosted search over uploaded documents (default)
                      </p>
                    </div>
                    <Switch
                      checked={draft.ragEnabled ?? true}
                      onCheckedChange={(v) => setDraft((d) => ({ ...d, ragEnabled: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label>Mistral Document Library</Label>
                      <p className="text-xs text-muted-foreground">
                        Optional: Mistral hosts indexing and search (extra API cost). Self-hosted
                        RAG still runs when enabled.
                      </p>
                      {draft.useMistralLibrary && draft.mistralAgentId && (
                        <Badge variant="secondary" className="mt-1 text-xs font-normal">
                          Agent provisioned
                        </Badge>
                      )}
                    </div>
                    <Switch
                      checked={draft.useMistralLibrary ?? false}
                      onCheckedChange={(v) => setDraft((d) => ({ ...d, useMistralLibrary: v }))}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Embeddable widget</CardTitle>
                  <CardDescription>Public chat widget for your website</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Label>Widget enabled</Label>
                    <Switch
                      checked={draft.widgetEnabled ?? false}
                      onCheckedChange={(v) => setDraft((d) => ({ ...d, widgetEnabled: v }))}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">3D agent avatar</CardTitle>
                  <CardDescription>
                    Animated avatar in the playground, embed widget, and optional AR
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Avatar mode</Label>
                    <Select
                      value={avatarMode}
                      onValueChange={(v) =>
                        patchTheme({
                          avatarMode: v as WidgetThemeDraft["avatarMode"],
                          arEnabled: v === "ar" ? true : widgetTheme.arEnabled,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">Static image (default)</SelectItem>
                        <SelectItem value="3d">3D avatar in chat panel</SelectItem>
                        <SelectItem value="ar">3D avatar + AR view</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      3D/AR modes use a GLB model. Lip sync works with text-to-speech.
                    </p>
                  </div>
                  {(avatarMode === "3d" || avatarMode === "ar") && (
                    <div className="space-y-2">
                      <Label>3D model file</Label>
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          ref={avatarModelInputRef}
                          type="file"
                          accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadAvatarModel.mutate(file);
                            e.target.value = "";
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadAvatarModel.isPending}
                          onClick={() => avatarModelInputRef.current?.click()}
                        >
                          <ImagePlus className="h-4 w-4 mr-2" />
                          {uploadAvatarModel.isPending ? "Uploading…" : "Upload GLB"}
                        </Button>
                        {widgetTheme.avatarModelUrl ? (
                          <Badge variant="secondary" className="font-normal text-xs">
                            Model uploaded
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            GLB or GLTF · max 30 MB
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {(avatarMode === "ar" || widgetTheme.arEnabled) && (
                    <>
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <Label>AR view button</Label>
                          <p className="text-xs text-muted-foreground">
                            Lets visitors open the agent in camera AR (mobile, HTTPS)
                          </p>
                        </div>
                        <Switch
                          checked={widgetTheme.arEnabled ?? avatarMode === "ar"}
                          onCheckedChange={(v) => patchTheme({ arEnabled: v })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>AR marker image URL (optional)</Label>
                        <Input
                          value={widgetTheme.arMarkerUrl ?? ""}
                          onChange={(e) =>
                            patchTheme({ arMarkerUrl: e.target.value || undefined })
                          }
                          placeholder="NFT marker — leave blank for camera placement"
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Voice &amp; speech</CardTitle>
                  <CardDescription>Text-to-speech for widget and playground</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label>Text-to-speech</Label>
                      <p className="text-xs text-muted-foreground">
                        Read assistant replies aloud (Mistral Voxtral TTS)
                      </p>
                    </div>
                    <Switch
                      checked={draft.widgetTtsEnabled ?? false}
                      onCheckedChange={(v) => setDraft((d) => ({ ...d, widgetTtsEnabled: v }))}
                    />
                  </div>
                  {(draft.widgetTtsEnabled ?? false) && tenantId && (
                    <TtsVoiceSettings
                      tenantId={tenantId}
                      selectedVoiceId={draft.mistralVoiceId ?? ""}
                      onVoiceChange={(voiceId) =>
                        setDraft((d) => ({
                          ...d,
                          mistralVoiceId: voiceId === "" ? "" : voiceId,
                        }))
                      }
                    />
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end pb-4">
                <Button onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending}>
                  {saveConfig.isPending ? "Saving…" : "Save settings"}
                </Button>
              </div>
            </div>
          </PermissionGate>
        </TabsContent>

        <TabsContent value="embed" className="mt-4 space-y-4 max-w-2xl">
          <PermissionGate require={P.chatbot.manage}>
            <ChatbotApiKeysCard
              tenantId={tenantId}
              keys={configQuery.data?.keys ?? []}
              widgetEnabled={draft.widgetEnabled ?? configQuery.data?.config.widgetEnabled}
              onSecretCreated={setEmbedKeySecret}
            />
            <ChatbotIntegrationExamples
              apiBase={apiBase}
              apiKey={embedKeySecret}
              embedSnippet={widgetSnippet}
            />
          </PermissionGate>
        </TabsContent>
      </Tabs>
    </div>
  );
}
