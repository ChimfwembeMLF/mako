import Logo from '@/components/Logo';
import { cn } from '@/lib/utils';

type AppPageLoaderProps = {
  message?: string;
  /** Cover the full viewport (hides nav, breadcrumbs, etc.) */
  fullscreen?: boolean;
  className?: string;
};

export function AppPageLoader({
  message,
  fullscreen = true,
  className,
}: AppPageLoaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center bg-background px-6 text-center',
        fullscreen ? 'fixed inset-0 z-[120]' : 'min-h-[40vh] w-full',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Logo className="h-24 w-auto sm:h-28 animate-pulse" />
      {message ? (
        <p className="mt-6 text-sm text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}
