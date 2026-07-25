import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  Link2,
  Megaphone,
  MessageSquareReply,
  LayoutGrid,
} from 'lucide-react';
import { SocialOverview } from '@/components/dashboard/SocialOverview';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { useWorkspace } from '@/hooks/useWorkspace';
import { canAccessSocialShell } from '@/lib/social-shell';
import { cn } from '@/lib/utils';

const quickLinks = [
  {
    title: 'Content Engine',
    description: 'Write and generate posts',
    href: '/content',
    icon: Megaphone,
  },
  {
    title: 'Scheduler',
    description: 'Calendar, queue & publish',
    href: '/scheduler',
    icon: CalendarClock,
  },
  {
    title: 'Connections',
    description: 'Link social accounts',
    href: '/publisher',
    icon: Link2,
  },
  {
    title: 'Social Inbox',
    description: 'Comments, DMs & chats',
    href: '/replies',
    icon: MessageSquareReply,
  },
];

export default function SocialDashboardPage() {
  const { canAny, loading } = usePermissions();
  const { activeWorkspace } = useWorkspace();
  const allowed = loading || canAccessSocialShell(canAny);

  if (!loading && !allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div
      className="w-full space-y-6 sm:space-y-8 pb-8 sm:pb-10 min-w-0"
      key={activeWorkspace ?? 'none'}
    >
      <div className="relative overflow-hidden rounded-xl bg-foreground p-6 sm:p-8">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2 max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Social workspace
            </p>
            <h1 className="font-display text-display-md text-background tracking-tight">
              Publish. Engage. Measure.
            </h1>
            <p className="text-sm text-background/70 leading-relaxed">
              Content, scheduling, connections, and inbox — without the rest of the marketing suite
              crowding your nav.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="min-h-12 rounded-xl">
              <Link to="/content">
                Create post <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="min-h-12 rounded-xl border-background/30 bg-transparent text-background hover:bg-background/10"
            >
              <Link to="/dashboard">
                <LayoutGrid className="mr-1.5 h-4 w-4" />
                Main app
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <SocialOverview />

      <div>
        <h2 className="text-lg font-semibold font-display mb-3">Social quick links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickLinks.map((item) => (
            <Link key={item.href} to={item.href}>
              <Card className="group h-full border-0 bg-card hover:bg-primary-pale/40 transition-colors">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-foreground">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm flex items-center gap-1">
                      {item.title}
                      <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                    </p>
                    <p className={cn('text-xs text-muted-foreground mt-0.5')}>{item.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
