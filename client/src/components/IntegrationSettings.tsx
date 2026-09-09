import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Key, Trash2, CheckCircle2 } from "lucide-react";
import { useTenantIntegrationConfigs, TenantIntegrationConfig } from "@/hooks/api/useTenantIntegrationConfigs";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface IntegrationSettingsProps {
  tenantId: string;
}

const AI_PROVIDERS = [
  { id: "MISTRAL", name: "Mistral AI" },
  { id: "OPENAI", name: "OpenAI" },
  { id: "GEMINI", name: "Google Gemini" },
];

export function IntegrationSettings({ tenantId }: IntegrationSettingsProps) {
  const { configs, isLoading, upsertConfig, isUpserting, deleteConfig, isDeleting } = useTenantIntegrationConfigs(tenantId);
  const { toast } = useToast();
  
  const [selectedProvider, setSelectedProvider] = useState<string>("MISTRAL");
  const [apiKey, setApiKey] = useState("");

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast({ title: "Error", description: "API Key is required", variant: "destructive" });
      return;
    }
    try {
      await upsertConfig({ provider: selectedProvider, apiKey });
      setApiKey("");
      toast({ title: "Success", description: "API Key saved successfully" });
    } catch (err: any) {
      toast({ title: "Failed to save API key", description: err?.response?.data?.message || err.message, variant: "destructive" });
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
          <div className="grid gap-4 md:grid-cols-[1fr_2fr_auto]">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {AI_PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder={`Enter ${AI_PROVIDERS.find(p => p.id === selectedProvider)?.name} API Key`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            
            <div className="flex items-end">
              <Button onClick={handleSave} disabled={isUpserting || !apiKey.trim()} className="w-full md:w-auto">
                {isUpserting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Key
              </Button>
            </div>
          </div>
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
