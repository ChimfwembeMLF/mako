import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import { systemSettingsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const API_KEY = "TRINOLUX_API_KEY";
const SENDER_ID = "TRINOLUX_SENDER_ID";

export function SmsSettings() {
  const { toast } = useToast();
  const [saved, setSaved] = useState<Record<string, string> | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [senderId, setSenderId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () =>
    systemSettingsApi
      .getIntegrations()
      .then(setSaved)
      .catch(() => setSaved({}));

  useEffect(() => {
    void load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Left blank means keep what's saved: stored values are never sent back to the browser.
    const updates: Record<string, string> = {};
    if (apiKey.trim()) updates[API_KEY] = apiKey.trim();
    if (senderId.trim()) updates[SENDER_ID] = senderId.trim();

    setSaving(true);
    try {
      await systemSettingsApi.updateIntegrations(updates);
      setApiKey("");
      setSenderId("");
      await load();
      toast({ title: "SMS settings saved" });
    } catch (err) {
      toast({
        title: "Couldn't save SMS settings",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!saved) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Trinolux SMS</CardTitle>
        <CardDescription>
          Used for messages Mako sends itself. Create the API key in Trinolux with the SendSMS scope.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-3 max-w-md" onSubmit={(e) => void handleSubmit(e)}>
          <div className="space-y-1.5">
            <Label htmlFor="sms-api-key">API key</Label>
            <Input
              id="sms-api-key"
              type="password"
              autoComplete="off"
              placeholder={saved[API_KEY] ? "Saved. Enter a new key to replace it" : "Paste your Trinolux API key"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sms-sender-id">Sender ID</Label>
            <Input
              id="sms-sender-id"
              autoComplete="off"
              placeholder={saved[SENDER_ID] ? "Saved. Enter a new Sender ID to replace it" : "Exactly as approved, for example Mako"}
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Sender IDs are case-sensitive.</p>
          </div>
          <Button type="submit" size="sm" className="gap-1.5" disabled={saving || (!apiKey.trim() && !senderId.trim())}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save SMS settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
