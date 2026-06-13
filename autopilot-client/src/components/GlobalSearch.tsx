import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, Loader2, Pen, MessageSquare, LayoutTemplate, BookOpen,
  ClipboardList, ArrowRight, Search,
} from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandShortcut,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { searchApi, type SearchResult } from "@/lib/api";
import { allNavItems, matchNavItems, type NavItem } from "@/lib/nav-config";
import { cn } from "@/lib/utils";

const TYPE_META: Record<
  SearchResult["type"],
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  content: { label: "Content", icon: Pen },
  lead: { label: "Leads", icon: MessageSquare },
  template: { label: "Templates", icon: LayoutTemplate },
  knowledge: { label: "Knowledge", icon: BookOpen },
  audit: { label: "Audit", icon: ClipboardList },
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

type GlobalSearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const { canAny, isSuperAdmin, loading: permsLoading } = usePermissions();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<{ answer: string; links: Array<{ title: string; url: string }> } | null>(null);

  const debouncedQuery = useDebouncedValue(query, 280);

  const navItems = useMemo(
    () => allNavItems(canAny, isSuperAdmin, permsLoading),
    [canAny, isSuperAdmin, permsLoading],
  );

  const pageMatches = useMemo(
    () => matchNavItems(navItems, debouncedQuery),
    [navItems, debouncedQuery],
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setAiMode(false);
      setAiAnswer(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !tenant?.id || debouncedQuery.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);

    searchApi
      .query({ tenantId: tenant.id, q: debouncedQuery.trim() })
      .then((items) => {
        if (!cancelled) setResults(items);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, tenant?.id, debouncedQuery]);

  const go = useCallback(
    (url: string) => {
      onOpenChange(false);
      navigate(url);
    },
    [navigate, onOpenChange],
  );

  const runAsk = useCallback(async () => {
    const q = query.trim();
    if (!tenant?.id || q.length < 3) return;
    setAiMode(true);
    setAiLoading(true);
    setAiAnswer(null);
    try {
      const answer = await searchApi.ask({ tenantId: tenant.id, q });
      setAiAnswer(answer);
    } catch {
      setAiAnswer({
        answer: "Could not reach the AI assistant. Check your connection and try again.",
        links: [],
      });
    } finally {
      setAiLoading(false);
    }
  }, [query, tenant?.id]);

  const groupedResults = useMemo(() => {
    const groups: Partial<Record<SearchResult["type"], SearchResult[]>> = {};
    for (const r of results) {
      (groups[r.type] ??= []).push(r);
    }
    return groups;
  }, [results]);

  const showAsk = query.trim().length >= 3;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search pages, content, leads… or ask a question"
        value={query}
        onValueChange={(v) => {
          setQuery(v);
          setAiMode(false);
          setAiAnswer(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && showAsk) {
            e.preventDefault();
            void runAsk();
          }
        }}
      />

      {aiMode ? (
        <div className="px-4 py-4 space-y-3 max-h-[360px] overflow-y-auto border-t">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            AI assistant
          </div>
          {aiLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking…
            </div>
          ) : aiAnswer ? (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{aiAnswer.answer}</p>
              {aiAnswer.links.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {aiAnswer.links.map((link) => (
                    <Button
                      key={link.url}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => go(link.url)}
                    >
                      {link.title}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setAiMode(false)}>
            ← Back to search results
          </Button>
        </div>
      ) : (
        <CommandList className="max-h-[360px]">
          <CommandEmpty>
            {searching ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </span>
            ) : query.trim().length < 2 ? (
              "Type to search your workspace"
            ) : (
              "No results — try Ask AI below"
            )}
          </CommandEmpty>

          {showAsk && (
            <CommandGroup heading="AI assistant">
              <CommandItem
                value={`ask-ai-${query}`}
                onSelect={() => void runAsk()}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Ask AI: &ldquo;{query.trim()}&rdquo;</span>
                <CommandShortcut>⌘↵</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          )}

          {pageMatches.length > 0 && (
            <CommandGroup heading="Pages">
              {pageMatches.map((item: NavItem) => (
                <CommandItem
                  key={item.url}
                  value={`page-${item.url}-${item.title}`}
                  onSelect={() => go(item.url)}
                  className="gap-2"
                >
                  <item.icon className="h-4 w-4 shrink-0 opacity-70" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {(Object.keys(groupedResults) as SearchResult["type"][]).map((type) => {
            const meta = TYPE_META[type];
            const items = groupedResults[type] ?? [];
            if (!items.length) return null;
            return (
              <CommandGroup key={type} heading={meta.label}>
                {items.map((item) => (
                  <CommandItem
                    key={`${type}-${item.id}`}
                    value={`${type}-${item.id}-${item.title}`}
                    onSelect={() => go(item.url)}
                    className="gap-2"
                  >
                    <meta.icon className="h-4 w-4 shrink-0 opacity-70" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{item.title}</p>
                      {item.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}

          {searching && query.trim().length >= 2 && (
            <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Searching workspace…
            </div>
          )}
        </CommandList>
      )}

      <div className="border-t px-3 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="hidden sm:inline">Navigate with ↑↓ · Open with ↵</span>
        <div className="flex items-center gap-2 ml-auto">
          {showAsk && !aiMode && (
            <Badge variant="secondary" className="text-[10px] font-normal">
              ⌘↵ Ask AI
            </Badge>
          )}
          <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px]">
            esc
          </kbd>
        </div>
      </div>
    </CommandDialog>
  );
}

export function GlobalSearchTrigger({
  className,
  onClick,
}: {
  className?: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        "hidden md:inline-flex h-9 w-full max-w-[220px] justify-start gap-2 text-muted-foreground font-normal",
        className,
      )}
      onClick={onClick}
    >
      <Search className="h-4 w-4 shrink-0 opacity-60" />
      <span className="truncate flex-1 text-left">Search…</span>
      <kbd className="pointer-events-none hidden lg:inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] opacity-80">
        ⌘K
      </kbd>
    </Button>
  );
}

export function useGlobalSearchShortcut(onOpen: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onOpen]);
}
