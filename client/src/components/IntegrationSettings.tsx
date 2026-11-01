import { useState } from "react";
import { CheckCircle2, ExternalLink, Key, Loader2, XCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { confirmModal } from "@/components/ConfirmModal";
import { useTenantIntegrationConfigs } from "@/hooks/api/useTenantIntegrationConfigs";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { API_BASE_URL, getAuthToken, tenantIntegrationConfigsApi, tenantsApi } from "@/lib/api";
import { P } from "@/lib/permissions";

interface IntegrationSettingsProps {
  tenantId: string;
}

const MistralIcon = (props: any) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" {...props}>
    <path d="M4 18l3.5-12h3L7 18H4zm6.5 0l3.5-12h3L13.5 18h-3zm6.5 0l3.5-12h3L20 18h-3z" />
  </svg>
);

const OpenAIIcon = (props: any) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" {...props}>
    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 10.528 0a6.012 6.012 0 0 0-4.665 2.21 5.99 5.99 0 0 0-5.466 4.365 6.037 6.037 0 0 0 .52 4.909 6.046 6.046 0 0 0 6.51 2.9A6.065 6.065 0 0 0 12.164 16.5a6.012 6.012 0 0 0 4.665-2.21 5.99 5.99 0 0 0 5.467-4.364A5.985 5.985 0 0 0 22.282 9.82Zm-10.118 5.204a4.57 4.57 0 0 1-2.981-1.096l5.068-2.923v-1.125l-2.087-1.205v5.349Zm-6.26-2.127A4.57 4.57 0 0 1 4.793 10.3l5.067 2.926 1.044.603-2.088 1.205-2.912-2.136Zm8.196-8.986a4.57 4.57 0 0 1 2.98 1.096L12.012 7.931v1.125l2.087 1.205V4.912ZM20.301 10.3a4.57 4.57 0 0 1-1.111 2.598l-5.067-2.926-1.044-.603 2.088-1.205 2.912 2.136h2.222Zm-7.662 2.545-2.088 1.205v-2.41l2.088-1.205v2.41Zm-2.61-3.61l2.088-1.205v2.41l-2.088 1.205v-2.41Z" />
  </svg>
);

const GeminiIcon = (props: any) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" {...props}>
    <path d="M11.66 0C11.66 6.44 6.44 11.66 0 11.66c6.44 0 11.66 5.22 11.66 11.66 0-6.44 5.22-11.66 11.66-11.66-6.44 0-11.66-5.22-11.66-11.66Z" />
  </svg>
);

const DeepSeekIcon = (props: any) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" {...props}>
    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM8.5 14.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zm7 0c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
  </svg>
);

const GoogleDriveIcon = (props: any) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" {...props}>
    <path fill="#FFC107" d="M17.09 17.584L24 5.617H10.18L3.269 17.584h13.821z" />
    <path fill="#4CAF50" d="M10.18 5.617L3.27 17.584 0 11.967l6.91-11.967h6.911l-3.641 5.617z" />
    <path fill="#1976D2" d="M20.73 11.967l-6.91 11.967H0l6.91-11.967h13.82z" />
  </svg>
);

const DEFAULT_PROVIDER = "mistral";

type Provider = {
  id: string;
  name: string;
  icon: (props: any) => JSX.Element;
  note: string;
  keyUrl?: string;
};

const AI_PROVIDERS: Provider[] = [
  {
    id: "mistral",
    name: "Mistral AI",
    icon: MistralIcon,
    note: "Built in and included in your plan. Add your own key to use your Mistral account instead.",
    keyUrl: "https://console.mistral.ai/api-keys",
  },
  { id: "openai", name: "OpenAI", icon: OpenAIIcon, note: "Use your OpenAI account.", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "gemini", name: "Google Gemini", icon: GeminiIcon, note: "Use your Google AI account.", keyUrl: "https://aistudio.google.com/apikey" },
  { id: "deepseek", name: "DeepSeek", icon: DeepSeekIcon, note: "Use your DeepSeek account.", keyUrl: "https://platform.deepseek.com/api_keys" },
  {
    id: "self_hosted_parler",
    name: "Self-Hosted Parler",
    icon: MistralIcon,
    note: "Voice only, and no key needed. Text still runs on Mistral.",
  },
];

type TestState = { status: "testing" } | { status: "ok" } | { status: "failed"; message: string };

function TestResult({ state }: { state?: TestState }) {
  if (!state) return null;
  if (state.status === "testing") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Checking this key…
      </p>
    );
  }
  if (state.status === "ok") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-3.5 w-3.5" /> This key works.
      </p>
    );
  }
  return (
    <p className="flex items-start gap-1.5 text-xs text-destructive">
      <XCircle className="h-3.5 w-3.5 mt-px shrink-0" /> <span>This key didn't work: {state.message}</span>
    </p>
  );
}

export function IntegrationSettings({ tenantId }: IntegrationSettingsProps) {
  const { configs, isLoading, upsertConfig, deleteConfig, isDeleting } = useTenantIntegrationConfigs(tenantId);
  const { toast } = useToast();
  const { can, isSuperAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const canManage = isSuperAdmin || can(P.settings.billing);

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: () => tenantsApi.findOne(tenantId),
    enabled: !!tenantId,
  });

  const { mutateAsync: setActiveProvider, isPending: isUpdatingTenant } = useMutation({
    mutationFn: (preferredAiProvider: string) => tenantsApi.update(tenantId, { preferredAiProvider }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant", tenantId] }),
  });

  const [editing, setEditing] = useState<string | null>(null);
  const [draftKey, setDraftKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [connectingDrive, setConnectingDrive] = useState(false);
  const [tests, setTests] = useState<Record<string, TestState>>({});

  const activeId = tenant?.preferredAiProvider || DEFAULT_PROVIDER;
  const savedConfig = (id: string) => configs.find((c: { provider: string }) => c.provider === id);
  const driveConfig = savedConfig("google_drive");

  const showError = (title: string, err: unknown) =>
    toast({ title, description: err instanceof Error ? err.message : undefined, variant: "destructive" });

  const testKey = async (provider: string) => {
    setTests((prev) => ({ ...prev, [provider]: { status: "testing" } }));
    try {
      const result = await tenantIntegrationConfigsApi.testConfig(tenantId, provider);
      setTests((prev) => ({
        ...prev,
        [provider]: result.ok
          ? { status: "ok" }
          : { status: "failed", message: result.message ?? "The provider rejected it." },
      }));
    } catch (err) {
      setTests((prev) => ({
        ...prev,
        [provider]: { status: "failed", message: err instanceof Error ? err.message : "Try again." },
      }));
    }
  };

  const openEditor = (provider: string) => {
    setEditing(provider);
    setDraftKey("");
  };

  const saveKey = async (provider: string) => {
    setSaving(true);
    try {
      await upsertConfig({ provider: provider as never, apiKey: draftKey.trim() });
      setEditing(null);
      setDraftKey("");
      void testKey(provider);
    } catch (err) {
      showError("Couldn't save this key", err);
    } finally {
      setSaving(false);
    }
  };

  const removeKey = async (provider: Provider) => {
    const isActive = provider.id === activeId;
    const confirmed = await confirmModal(
      isActive
        ? "Mako is using this key now. Removing it switches your workspace back to Mistral AI, which is included in your plan."
        : `Your ${provider.name} key will be deleted from Mako.`,
      `Remove ${provider.name} key?`,
      "Remove key",
    );
    if (!confirmed) return;
    try {
      if (isActive && provider.id !== DEFAULT_PROVIDER) await setActiveProvider(DEFAULT_PROVIDER);
      await deleteConfig(provider.id);
      setTests(({ [provider.id]: _removed, ...rest }) => rest);
    } catch (err) {
      showError("Couldn't remove this key", err);
    }
  };

  const useProvider = async (provider: Provider) => {
    try {
      await setActiveProvider(provider.id);
      toast({ title: `Now using ${provider.name}` });
    } catch (err) {
      showError("Couldn't switch provider", err);
    }
  };

  const connectDrive = async () => {
    setConnectingDrive(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/integrations/google-drive/auth-url?tenantId=${tenantId}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) throw new Error("Google Drive isn't available right now.");
      const data = await res.json();
      window.location.href = data.url;
    } catch (err) {
      setConnectingDrive(false);
      showError("Couldn't connect Google Drive", err);
    }
  };

  const disconnectDrive = async () => {
    const confirmed = await confirmModal(
      "You won't be able to import media from Google Drive until you connect it again.",
      "Disconnect Google Drive?",
      "Disconnect",
    );
    if (!confirmed) return;
    try {
      await deleteConfig("google_drive");
    } catch (err) {
      showError("Couldn't disconnect Google Drive", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Key className="h-4 w-4" />
            AI provider
          </CardTitle>
          <CardDescription>
            Mistral AI is included in your plan. To use another provider, add your own API key. That provider bills
            you directly, and that usage doesn't count toward your plan's AI limit. Keys are encrypted and can't be
            viewed after saving.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!canManage && (
            <p className="text-sm text-muted-foreground">Only workspace owners and admins can change these settings.</p>
          )}
          {AI_PROVIDERS.map((provider) => {
            const Icon = provider.icon;
            const takesKey = Boolean(provider.keyUrl);
            const config = savedConfig(provider.id);
            const isActive = provider.id === activeId;
            const usable = Boolean(config) || !takesKey || provider.id === DEFAULT_PROVIDER;
            return (
              <div
                key={provider.id}
                className={`rounded-lg border p-4 space-y-3 ${isActive ? "border-primary bg-primary/5" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1 basis-48">
                    <div className="font-medium text-sm flex flex-wrap items-center gap-2">
                      {provider.name}
                      {isActive && <Badge>In use</Badge>}
                      {config && <Badge variant="outline">Your key</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {config ? `Key saved ${new Date(config.updatedAt).toLocaleDateString()}` : provider.note}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap items-center gap-2">
                      {takesKey && config && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={tests[provider.id]?.status === "testing"}
                            onClick={() => void testKey(provider.id)}
                          >
                            Test
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEditor(provider.id)}>
                            Replace
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={isDeleting}
                            onClick={() => void removeKey(provider)}
                          >
                            Remove
                          </Button>
                        </>
                      )}
                      {takesKey && !config && (
                        <Button size="sm" variant="outline" onClick={() => openEditor(provider.id)}>
                          Add key
                        </Button>
                      )}
                      {!isActive && usable && (
                        <Button size="sm" disabled={isUpdatingTenant} onClick={() => void useProvider(provider)}>
                          Use this
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <TestResult state={tests[provider.id]} />

                {editing === provider.id && (
                  <form
                    className="space-y-2 border-t pt-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveKey(provider.id);
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor={`key-${provider.id}`}>{provider.name} API key</Label>
                      <a
                        href={provider.keyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Get a key <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        id={`key-${provider.id}`}
                        type="password"
                        autoComplete="off"
                        autoFocus
                        placeholder="Paste your API key"
                        value={draftKey}
                        onChange={(e) => setDraftKey(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button type="submit" disabled={saving || !draftKey.trim()}>
                          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Save and test
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base font-display">Cloud storage</CardTitle>
          <CardDescription>Connect cloud storage to import media directly into Mako.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border p-4">
            <GoogleDriveIcon className="h-5 w-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1 basis-48">
              <div className="font-medium text-sm flex items-center gap-2">
                Google Drive
                {driveConfig && <Badge variant="outline">Connected</Badge>}
              </div>
            </div>
            {canManage &&
              (driveConfig ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={isDeleting}
                  onClick={() => void disconnectDrive()}
                >
                  Disconnect
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled={connectingDrive} onClick={() => void connectDrive()}>
                  {connectingDrive && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Connect
                </Button>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
