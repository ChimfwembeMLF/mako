import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, Loader2 } from 'lucide-react';
import { useTenant } from '@/hooks/useTenant';
import { notificationsApi, type AppNotification } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export function NotificationBell() {
  const { tenant } = useTenant();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const [list, countRes] = await Promise.all([
        notificationsApi.list(tenant.id),
        notificationsApi.unreadCount(tenant.id),
      ]);
      setItems(list);
      setUnread(countRes.count);
    } catch {
      setItems([]);
      setUnread(0);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const markRead = async (n: AppNotification) => {
    if (!n.read) {
      await notificationsApi.markRead(n.id);
      void refresh();
    }
  };

  const markAllRead = async () => {
    if (!tenant?.id) return;
    await notificationsApi.markAllRead(tenant.id);
    void refresh();
  };

  return (
    <DropdownMenu onOpenChange={(open) => open && void refresh()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 shrink-0 rounded-full">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge
              className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center"
              variant="destructive"
            >
              {unread > 9 ? '9+' : unread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2">
          <span>Notifications</span>
          {unread > 0 && (
            <button
              type="button"
              className="text-xs font-normal text-primary hover:underline inline-flex items-center gap-1"
              onClick={() => void markAllRead()}
            >
              <Check className="h-3 w-3" /> Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-72 overflow-y-auto overscroll-contain">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-3">
              No notifications yet
            </p>
          ) : (
            items.slice(0, 12).map((n) => (
              <DropdownMenuItem key={n.id} asChild className="p-0 focus:bg-transparent">
                <Link
                  to={n.link ?? '/settings'}
                  onClick={() => void markRead(n)}
                  className={cn(
                    'flex w-full flex-col gap-1 px-3 py-2 hover:bg-muted/80 rounded-sm',
                    !n.read && 'bg-primary/5',
                  )}
                >
                  <span className="block text-sm font-medium leading-snug text-foreground line-clamp-1">
                    {n.title}
                  </span>
                  {n.body ? (
                    <span className="block text-xs leading-snug text-muted-foreground line-clamp-2">
                      {n.body}
                    </span>
                  ) : null}
                  <time
                    dateTime={n.created_at}
                    className="block text-[10px] text-muted-foreground/70"
                  >
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </time>
                </Link>
              </DropdownMenuItem>
            ))
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem asChild className="py-2">
          <Link to="/reports" className="w-full text-center text-xs text-primary">
            View reports
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
