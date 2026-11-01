import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { backofficeApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MAX_LENGTH = 160;

export function SmsTestForm() {
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("Mako SMS test");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const { status } = await backofficeApi.sendTestSms({ to, message });
      setResult({ ok: true, text: `Trinolux accepted it (${status}). Check the phone to confirm delivery.` });
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : "Could not send the test." });
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Send a test SMS</CardTitle>
        <CardDescription>
          Save your Trinolux settings first. This sends a real message and uses your SMS balance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-3 max-w-md" onSubmit={(e) => void handleSubmit(e)}>
          <div className="space-y-1.5">
            <Label htmlFor="sms-test-to">Zambian mobile number</Label>
            <Input id="sms-test-to" placeholder="0971234567" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sms-test-message">Message</Label>
            <Textarea
              id="sms-test-message"
              rows={3}
              maxLength={MAX_LENGTH}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{message.length}/{MAX_LENGTH}</p>
          </div>
          <Button type="submit" size="sm" disabled={sending || !to.trim() || !message.trim()}>
            {sending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Send test
          </Button>
          {result && (
            <p role="status" className={`text-sm ${result.ok ? "text-muted-foreground" : "text-destructive"}`}>
              {result.text}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
