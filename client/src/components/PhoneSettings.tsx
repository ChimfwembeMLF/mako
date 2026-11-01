import { useEffect, useState } from "react";
import { authApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PhoneVerifyForm } from "@/components/PhoneVerifyForm";

type Status = Awaited<ReturnType<typeof authApi.phoneStatus>>;

export function PhoneSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [changing, setChanging] = useState(false);

  const load = () => authApi.phoneStatus().then(setStatus).catch(() => undefined);

  useEffect(() => {
    void load();
  }, []);

  if (!status?.available) return null;

  return (
    <div className="space-y-2">
      <Label>Phone number</Label>
      {status.verified && !changing ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>{status.phone}</span>
          <Badge variant="outline">Verified</Badge>
          <Button type="button" variant="ghost" size="sm" onClick={() => setChanging(true)}>
            Change
          </Button>
        </div>
      ) : (
        <PhoneVerifyForm
          onVerified={() => {
            setChanging(false);
            void load();
          }}
        />
      )}
      <p className="text-xs text-muted-foreground">Used to help you reset your password.</p>
    </div>
  );
}
