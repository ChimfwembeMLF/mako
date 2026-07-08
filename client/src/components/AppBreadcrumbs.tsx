import { Fragment, useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { resolveBreadcrumbs, type BreadcrumbItem as Crumb } from '@/lib/breadcrumbs';
import { usePageBreadcrumbContext } from '@/hooks/usePageBreadcrumb';
import { cn } from '@/lib/utils';

type AppBreadcrumbsProps = {
  className?: string;
};

export function AppBreadcrumbs({ className }: AppBreadcrumbsProps) {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const { pageLabel } = usePageBreadcrumbContext() ?? {};

  const crumbs = useMemo(() => {
    const base = resolveBreadcrumbs(pathname);
    if (!base.length) return base;

    const next = [...base];
    if (pathname === '/auth') {
      const isSignup = searchParams.get('mode') === 'signup';
      next[next.length - 1] = {
        ...next[next.length - 1],
        label: isSignup ? 'Sign up' : 'Sign in',
      };
    }

    if (pageLabel) {
      next[next.length - 1] = { ...next[next.length - 1], label: pageLabel };
    }

    return next;
  }, [pathname, pageLabel, searchParams]);

  if (!crumbs.length) return null;

  return (
    <Breadcrumb className={cn('min-w-0 w-full', className)}>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => (
          <Fragment key={`${crumb.href ?? crumb.label}-${index}`}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              <CrumbNode crumb={crumb} isLast={index === crumbs.length - 1} />
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function CrumbNode({ crumb, isLast }: { crumb: Crumb; isLast: boolean }) {
  if (isLast || !crumb.href) {
    return <BreadcrumbPage className="truncate max-w-[12rem] sm:max-w-none">{crumb.label}</BreadcrumbPage>;
  }

  return (
    <BreadcrumbLink asChild>
      <Link to={crumb.href} className="truncate max-w-[8rem] sm:max-w-none">
        {crumb.label}
      </Link>
    </BreadcrumbLink>
  );
}
