import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { legalApi } from '@/lib/api';
import {
  DATA_PROTECTION_CONSENT_VERSION,
  getOrCreateVisitorId,
  hasLocalConsent,
  saveLocalConsent,
} from '@/lib/data-protection-consent';

export function DataProtectionBanner() {
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setVisible(!hasLocalConsent());
  }, []);

  async function accept() {
    setSubmitting(true);
    const visitorId = getOrCreateVisitorId();
    try {
      const result = await legalApi.recordConsent({
        visitorId,
        consentVersion: DATA_PROTECTION_CONSENT_VERSION,
      });
      saveLocalConsent({
        visitorId,
        consentVersion: DATA_PROTECTION_CONSENT_VERSION,
        acceptedAt: result.createdAt ?? new Date().toISOString(),
        consentId: result.id,
      });
      setVisible(false);
    } catch {
      saveLocalConsent({
        visitorId,
        consentVersion: DATA_PROTECTION_CONSENT_VERSION,
        acceptedAt: new Date().toISOString(),
      });
      setVisible(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Data protection notice"
      className="fixed bottom-0 inset-x-0 z-[100] p-4 sm:p-6 pointer-events-none"
    >
      <div className="mx-auto max-w-3xl pointer-events-auto rounded-xl border bg-background/95 backdrop-blur shadow-lg p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="flex gap-3 min-w-0">
          <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden />
          <div className="text-sm space-y-1">
            <p className="font-medium">Data protection</p>
            <p className="text-muted-foreground">
              We use cookies and process account data to run Mako . See our{' '}
              <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link to="/data-deletion" className="underline underline-offset-2 hover:text-foreground">
                data deletion
              </Link>{' '}
              options.
            </p>
          </div>
        </div>
        <Button className="shrink-0 w-full sm:w-auto" onClick={() => void accept()} disabled={submitting}>
          {submitting ? 'Saving…' : 'Accept'}
        </Button>
      </div>
    </div>
  );
}
