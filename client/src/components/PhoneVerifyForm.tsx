import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PhoneVerifyForm({ onVerified }: { onVerified: () => void }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const sendCode = (e?: FormEvent) => {
    e?.preventDefault();
    return run(async () => {
      await authApi.sendPhoneCode(phone);
      setCodeSent(true);
    });
  };

  const verify = (e: FormEvent) => {
    e.preventDefault();
    return run(async () => {
      await authApi.verifyPhoneCode(code);
      onVerified();
    });
  };

  if (!codeSent) {
    return (
      <form className="space-y-3" onSubmit={(e) => void sendCode(e)}>
        <div className="space-y-1.5">
          <Label htmlFor="verify-phone">Zambian mobile number</Label>
          <Input
            id="verify-phone"
            type="tel"
            autoComplete="tel"
            placeholder="0971234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="sm" disabled={busy || !phone.trim()}>
          {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Send code
        </Button>
      </form>
    );
  }

  return (
    <form className="space-y-3" onSubmit={(e) => void verify(e)}>
      <div className="space-y-1.5">
        <Label htmlFor="verify-code">6-digit code</Label>
        <Input
          id="verify-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
        <p className="text-xs text-muted-foreground">We texted a code to {phone}. It expires in 10 minutes.</p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy || code.length !== 6}>
          {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Verify
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void sendCode()}>
          Resend code
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setCodeSent(false);
            setCode("");
            setError("");
          }}
        >
          Change number
        </Button>
      </div>
    </form>
  );
}
