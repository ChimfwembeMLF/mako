import { matchPath } from 'react-router-dom';
import { cn } from '@/lib/utils';

export type PageWidth = '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | 'lg' | 'full';

/** Explicit class strings so Tailwind always includes them (no dynamic lookup). */
export function pageWidthClass(width: PageWidth): string {
  switch (width) {
    case '2xl':
      return 'max-w-2xl';
    case '3xl':
      return 'max-w-3xl';
    case '4xl':
      return 'max-w-4xl';
    case '5xl':
      return 'max-w-5xl';
    case '6xl':
      return 'max-w-6xl';
    case 'lg':
      return 'max-w-lg';
    case 'full':
      return 'max-w-full';
    default:
      return 'max-w-5xl';
  }
}

/** Match dashboard routes to the same max-width their page content uses. */
const ROUTE_PAGE_WIDTH: { path: string; width: PageWidth }[] = [
  { path: '/templates/:id', width: '2xl' },
  { path: '/team/:userId/permissions', width: '3xl' },
  { path: '/approvals', width: '3xl' },
  { path: '/settings', width: '3xl' },
  { path: '/export', width: '3xl' },
  { path: '/admin/maker-checker', width: '3xl' },
  { path: '/admin/system', width: '3xl' },
  { path: '/brand-brain', width: '4xl' },
  { path: '/team', width: '4xl' },
  { path: '/billing', width: '4xl' },
  { path: '/ads', width: '4xl' },
  { path: '/content/:id', width: '4xl' },
  { path: '/chatbot/knowledge', width: '4xl' },
  { path: '/content', width: '6xl' },
  { path: '/media', width: '6xl' },
  { path: '/admin/roles', width: '6xl' },
  { path: '/admin/queues', width: '6xl' },
  { path: '/admin/backoffice', width: '6xl' },
  { path: '/chatbot/sessions', width: '6xl' },
  { path: '/chatbot', width: '6xl' },
].sort((a, b) => b.path.length - a.path.length);

export function resolvePageWidth(pathname: string): PageWidth {
  for (const { path, width } of ROUTE_PAGE_WIDTH) {
    if (matchPath({ path, end: true }, pathname)) return width;
  }
  return '5xl';
}

type PageContainerProps = {
  children: React.ReactNode;
  className?: string;
  /** @deprecated Width is controlled by DashboardLayout shell */
  size?: PageWidth;
};

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        'w-full min-w-0 space-y-5 sm:space-y-6 pb-8 sm:pb-10',
        className,
      )}
    >
      {children}
    </div>
  );
}
