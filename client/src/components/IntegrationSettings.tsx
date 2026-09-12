import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Key, Trash2, CheckCircle2 } from "lucide-react";
import { useTenantIntegrationConfigs, TenantIntegrationConfig } from "@/hooks/api/useTenantIntegrationConfigs";
import { useToast } from "@/hooks/use-toast";

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

const AI_PROVIDERS = [
  { id: "mistral", name: "Mistral AI", icon: MistralIcon },
  { id: "openai", name: "OpenAI", icon: OpenAIIcon },
  { id: "gemini", name: "Google Gemini", icon: GeminiIcon },
  { id: "deepseek", name: "DeepSeek", icon: DeepSeekIcon },
];

export function IntegrationSettings({ tenantId }: IntegrationSettingsProps) {
  const { configs, isLoading, upsertConfig, isUpserting, deleteConfig, isDeleting } = useTenantIntegrationConfigs(tenantId);
  const { toast } = useToast();
  
  // Track API keys per provider in a simple object map
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  // Track which provider is currently being saved for loading spinner
  const [savingProvider, setSavingProvider] = useState<string | null>(null);

  const handleSave = async (provider: string) => {
    const key = apiKeys[provider] ?? "";
    if (!key.trim()) {
      toast({
        title: "Error",
        description: `API Key is required for ${provider}`,
        variant: "destructive",
      });
      return;
    }
    setSavingProvider(provider);
    try {
      const normalizedProvider = provider.toLowerCase();
      await upsertConfig({ provider: normalizedProvider as any, apiKey: key });
      setApiKeys((prev) => ({ ...prev, [provider]: "" }));
      toast({ title: "Success", description: `${provider} API Key saved successfully` });
    } catch (err: any) {
      toast({
        title: "Failed to save API key",
        description: err?.response?.data?.message || err.message,
        variant: "destructive",
      });
    } finally {
      setSavingProvider(null);
    }
  };

  const handleDelete = async (provider: string) => {
    try {
      await deleteConfig(provider);
      toast({ title: "Success", description: "API Key removed successfully" });
    } catch (err: any) {
      toast({ title: "Failed to remove API key", description: err?.response?.data?.message || err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Key className="h-4 w-4" />
            Bring Your Own Key (BYOK)
          </CardTitle>
          <CardDescription>
            Configure custom API keys for AI providers to bypass Mako's platform limits and use your own quotas. Your keys are encrypted at rest.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {AI_PROVIDERS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.id} className="grid gap-4 md:grid-cols-[1fr_2fr_auto] items-center border rounded-lg p-4">
                <div className="flex items-center gap-2 font-medium">
                  <p>{p.name}</p>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder={`Enter ${p.name} API Key`}
                    value={apiKeys[p.id] ?? ""}
                    onChange={(e) => setApiKeys((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => handleSave(p.id)}
                    disabled={(savingProvider !== null && savingProvider !== p.id) || !apiKeys[p.id]?.trim()}
                    className="w-full md:w-auto"
                  >
                    {savingProvider === p.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Key
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {configs.length > 0 && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-display">Configured Providers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {configs.map((config: TenantIntegrationConfig) => {
                const providerInfo = AI_PROVIDERS.find(p => p.id === config.provider);
                return (
                  <div key={config.id} className="flex items-center justify-between py-3 border-b last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium text-sm">{providerInfo ? providerInfo.name : config.provider}</p>
                        <p className="text-xs text-muted-foreground">
                          Last updated: {new Date(config.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive h-8 px-2"
                        disabled={isDeleting}
                        onClick={() => handleDelete(config.provider)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
