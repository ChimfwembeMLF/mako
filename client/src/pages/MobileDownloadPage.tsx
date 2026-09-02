import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Smartphone, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';
import { MOBILE_APK_URL, MOBILE_APK_VERSION } from '@/lib/mobile-download';

export default function MobileDownloadPage() {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(MOBILE_APK_URL, { method: 'HEAD' })
      .then((res) => {
        if (!cancelled) setAvailable(res.ok);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 bg-card/80 backdrop-blur">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <Logo className="h-8" />
        </div>
      </header>

      <main className="max-w-[720px] mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="rounded-2xl border border-border/80 bg-card p-8 sm:p-10 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">Mako for Android</h1>
              <p className="text-sm text-muted-foreground mt-1">Version {MOBILE_APK_VERSION}</p>
            </div>
          </div>

          <p className="text-muted-foreground leading-relaxed mb-8">
            Install the Mako mobile app to manage content, schedule posts, reply in your social inbox, and connect
            channels — using the same account as the web workspace.
          </p>

          {available === null ? (
            <p className="text-sm text-muted-foreground mb-6">Checking download availability…</p>
          ) : available ? (
            <Button size="lg" className="w-full sm:w-auto min-h-12 rounded-xl" asChild>
              <a href={MOBILE_APK_URL} download="mako.apk">
                <Download className="mr-2 h-5 w-5" />
                Download APK
              </a>
            </Button>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 mb-6">
              <p className="font-semibold text-foreground">APK not published yet</p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                The install file will appear here after the next mobile release. Use the web app at{' '}
                <Link to="/auth" className="text-primary underline-offset-2 hover:underline">
                  mako.tekreminnovations.com
                </Link>{' '}
                in the meantime.
              </p>
            </div>
          )}

          <div className="mt-10 space-y-4 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <Shield className="h-5 w-5 shrink-0 text-positive-deep mt-0.5" />
              <p>
                <strong className="text-foreground font-semibold">Install note:</strong> Android may ask you to allow
                installs from your browser. Open Settings → Security → Install unknown apps, then enable your browser.
              </p>
            </div>
            <p>
              Requires Android 8+. Sign in with your Mako email or Google account. Production API:{' '}
              <span className="font-mono text-xs">mako.tekreminnovations.com</span>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          iOS (TestFlight) coming soon ·{' '}
          <Link to="/privacy" className="underline-offset-2 hover:underline">
            Privacy
          </Link>
        </p>
      </main>
    </div>
  );
}
