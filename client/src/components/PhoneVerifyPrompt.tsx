import { useEffect, useState } from "react";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PhoneVerifyForm } from "@/components/PhoneVerifyForm";
import { useToast } from "@/hooks/use-toast";

const DISMISSED_KEY = "mako_phone_prompt_dismissed";

function wasDismissed() {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Asks again each session. It never blocks: Trinolux is Zambia-only and SMS can be down. */
export function PhoneVerifyPrompt() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (wasDismissed()) return;
    let active = true;
    authApi
      .phoneStatus()
      .then(({ available, verified }) => {
        if (active && available && !verified) setOpen(true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const remindLater = () => {
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* it will just ask again */
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && remindLater()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add your phone number</DialogTitle>
          <DialogDescription>
            We'll use it to help you get back into your account if you forget your password.
          </DialogDescription>
        </DialogHeader>
        <PhoneVerifyForm
          onVerified={() => {
            setOpen(false);
            toast({ title: "Phone number verified" });
          }}
        />
        <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={remindLater}>
          Remind me later
        </Button>
      </DialogContent>
    </Dialog>
  );
}
