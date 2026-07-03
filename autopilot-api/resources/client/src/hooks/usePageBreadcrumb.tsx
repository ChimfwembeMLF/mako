import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type PageBreadcrumbContextValue = {
  pageLabel: string | null;
  setPageLabel: (label: string | null) => void;
};

const PageBreadcrumbContext = createContext<PageBreadcrumbContextValue | null>(null);

export function PageBreadcrumbProvider({ children }: { children: ReactNode }) {
  const [pageLabel, setPageLabelState] = useState<string | null>(null);
  const setPageLabel = useCallback((label: string | null) => {
    setPageLabelState(label?.trim() || null);
  }, []);

  const value = useMemo(
    () => ({ pageLabel, setPageLabel }),
    [pageLabel, setPageLabel],
  );

  return (
    <PageBreadcrumbContext.Provider value={value}>
      {children}
    </PageBreadcrumbContext.Provider>
  );
}

export function usePageBreadcrumbContext() {
  return useContext(PageBreadcrumbContext);
}

/** Override the last breadcrumb segment (e.g. content title on detail pages). */
export function usePageBreadcrumb(label?: string | null) {
  const ctx = usePageBreadcrumbContext();

  useEffect(() => {
    if (!ctx) return;
    if (label?.trim()) {
      ctx.setPageLabel(label.trim());
    } else {
      ctx.setPageLabel(null);
    }
    return () => ctx.setPageLabel(null);
  }, [label, ctx]);
}
