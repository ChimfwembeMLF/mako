import { useEffect, useState, type ReactNode } from "react";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { cn } from "@/lib/utils";

function workspaceInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) ?? "WS").toUpperCase();
}

type Props = {
  name: string;
  logoUrl?: string | null;
  /** Size and rounding, e.g. "h-8 w-8 rounded-md". */
  className?: string;
  /** Shown when there is no logo or it fails to load; defaults to the initials. */
  fallback?: ReactNode;
  /** Classes for the no-logo state (background and text colour). */
  fallbackClassName?: string;
};

/**
 * A workspace's logo, shown whole on a white tile so transparent and non-square logos
 * read correctly; falls back to initials when there is none or it can't load.
 */
export function WorkspaceLogo({ name, logoUrl, className, fallback, fallbackClassName }: Props) {
  const src = logoUrl?.trim() ? resolveMediaUrl(logoUrl.trim()) : "";
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <div className={cn("flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-inset ring-black/5", className)}>
        <img
          src={src}
          alt={`${name} logo`}
          className="h-full w-full object-contain p-[10%]"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden font-semibold",
        fallbackClassName ?? "bg-primary text-primary-foreground",
        className,
      )}
      aria-hidden
    >
      {fallback ?? workspaceInitials(name)}
    </div>
  );
}
