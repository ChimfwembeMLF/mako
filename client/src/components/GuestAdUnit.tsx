import { useEffect } from 'react';

type GuestAdUnitProps = {
  slotId?: string;
  className?: string;
};

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>> & {
      push: (config: Record<string, unknown>) => number;
    };
  }
}

export function GuestAdUnit({ slotId, className = '' }: GuestAdUnitProps) {
  const publisherId = import.meta.env.VITE_ADSENSE_PUBLISHER_ID as string | undefined;

  useEffect(() => {
    if (!publisherId || !slotId) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Ad blockers and unavailable AdSense scripts are safe no-op cases.
    }
  }, [publisherId, slotId]);

  if (!publisherId || !slotId) return null;

  return (
    <div className={`w-full max-w-full overflow-hidden ${className}`.trim()}>
      <ins
        className="adsbygoogle block max-w-full"
        style={{ display: 'block' }}
        data-ad-client={publisherId}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
