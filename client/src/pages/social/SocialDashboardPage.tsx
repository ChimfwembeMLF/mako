import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  MessageCircle,
  Clock,
  TrendingUp,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { canAccessSocialShell } from '@/lib/social-shell';
import { analyticsApi, contentItemsApi, PlatformDashboardResponse } from '@/lib/api';
import { format, isSameDay, addDays, subDays } from 'date-fns';

type DashboardData = {
  dashboard: PlatformDashboardResponse | null;
  contentItems: any[];
};

export default function SocialDashboardPage() {
  const { canAny, loading: permsLoading } = usePermissions();
  const { activeWorkspace, workspaceVersion, loading: wsLoading } = useWorkspace();
  const { tenant } = useTenant();
  const { user } = useAuth();
  
  const allowed = permsLoading || canAccessSocialShell(canAny);
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    dashboard: null,
    contentItems: [],
  });

  const [currentDate, setCurrentDate] = useState(new Date());

  const loadData = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const [dashboardRes, contentRes] = await Promise.all([
        analyticsApi.getPlatformDashboard(tenant.id, activeWorkspace),
        contentItemsApi.findAll(tenant.id, { workspaceId: activeWorkspace, includeMedia: true }),
      ]);
      setData({
        dashboard: dashboardRes,
        contentItems: Array.isArray(contentRes) ? contentRes : (contentRes.items || []),
      });
    } catch (err) {
      console.error('Failed to load social dashboard', err);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, activeWorkspace, workspaceVersion]);

  useEffect(() => {
    if (tenant?.id && !wsLoading) {
      void loadData();
    }
  }, [loadData, tenant?.id, wsLoading]);

  if (!permsLoading && !allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  // --- Process Calendar Days ---
  const calendarDays = useMemo(() => {
    const days = [];
    for (let i = -2; i <= 4; i++) {
      const d = addDays(currentDate, i);
      days.push({
        dateObj: d,
        day: format(d, 'EEE').toUpperCase(),
        date: format(d, 'dd'),
        active: i === 0,
      });
    }
    return days;
  }, [currentDate]);

  // --- Process Content Items ---
  const { upcomingPosts, publishedPosts, calendarItems } = useMemo(() => {
    const scheduled = data.contentItems.filter(item => item.status === 'scheduled');
    const published = data.contentItems.filter(item => item.status === 'published');
    
    // Sort scheduled by date asc
    scheduled.sort((a, b) => new Date(a.scheduledDate || 0).getTime() - new Date(b.scheduledDate || 0).getTime());
    // Sort published by date desc
    published.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    // Filter items matching the selected calendar date
    const calendarScheduled = scheduled.filter(item => 
      item.scheduledDate && isSameDay(new Date(item.scheduledDate), currentDate)
    );

    return { 
      upcomingPosts: scheduled.slice(0, 4), 
      publishedPosts: published.slice(0, 5),
      calendarItems: calendarScheduled 
    };
  }, [data.contentItems, currentDate]);

  const totals = data.dashboard?.totals ?? {
    connectedPlatforms: 0,
    publishedPosts: 0,
    scheduledPosts: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    views: 0,
    engagementScore: 0,
    pendingReplies: 0,
    reach: 0,
    impressions: 0
  };

  const engagement = totals.likes + totals.comments + totals.shares;
  
  if (permsLoading || wsLoading || (loading && !data.dashboard)) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading dashboard...
      </div>
    );
  }

  const currentHour = new Date().getHours();
  let greeting = 'Good morning';
  if (currentHour >= 12 && currentHour < 17) {
    greeting = 'Good afternoon';
  } else if (currentHour >= 17) {
    greeting = 'Good evening';
  }

  return (
    <div
      className="w-full space-y-6 sm:space-y-8 pb-8 sm:pb-10 min-w-0"
      key={activeWorkspace ?? 'none'}
    >
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              {greeting}, {user?.firstName || 'Marketing Manager'} <span className="text-lg leading-none">👋</span>
            </p>
            <h1 className="text-2xl sm:text-[28px] font-display text-foreground tracking-tight mt-1.5 font-medium">
              Here's what's happening with your marketing.
            </h1>
          </div>
          <Button asChild className="rounded-full px-5 py-2.5 h-auto shadow-sm">
            <Link to="/content">
              <Plus className="w-4 h-4 mr-1.5" /> Create content
            </Link>
          </Button>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          
          {/* Left Column (2/3) */}
          <div className="lg:col-span-2 space-y-6 lg:space-y-8">
            
            {/* Content Calendar */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold font-display">Content calendar</h2>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium cursor-pointer hover:text-primary transition-colors" onClick={() => setCurrentDate(new Date())}>Today</span>
                  <div className="flex bg-card border border-border/50 rounded-lg overflow-hidden shadow-sm">
                    <button onClick={() => setCurrentDate(subDays(currentDate, 1))} className="px-2 py-1.5 hover:bg-muted/50 border-r border-border/50 transition-colors"><ChevronLeft className="w-4 h-4 text-muted-foreground" /></button>
                    <button onClick={() => setCurrentDate(addDays(currentDate, 1))} className="px-2 py-1.5 hover:bg-muted/50 transition-colors"><ChevronRight className="w-4 h-4 text-muted-foreground" /></button>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="text-sm font-medium hidden sm:flex">
                    <Link to="/scheduler">View all</Link>
                  </Button>
                </div>
              </div>
              
              <Card className="bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-6">
                {/* Days row */}
                <div className="flex justify-between items-center mb-8 px-2 sm:px-4">
                  {calendarDays.map((d) => (
                    <div key={d.dateObj.toISOString()} onClick={() => setCurrentDate(d.dateObj)} className="flex flex-col items-center gap-2 cursor-pointer group">
                      <span className="text-[11px] font-medium text-muted-foreground tracking-wider">{d.day}</span>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${d.active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground group-hover:bg-muted'}`}>
                        {d.date}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Calendar Items */}
                <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 snap-x scrollbar-hide min-h-[160px]">
                  {calendarItems.map((item, i) => (
                    <div key={item.id || i} className={`snap-start shrink-0 w-40 flex flex-col gap-2 p-2 rounded-xl transition-colors hover:bg-muted/30`}>
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          {item.scheduledDate ? format(new Date(item.scheduledDate), 'h:mm a') : 'TBD'}
                        </span>
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center bg-card shadow-sm text-foreground`}>
                           {item.platforms?.[0] === 'whatsapp' ? (
                             <MessageCircle className="w-2.5 h-2.5 fill-current text-green-500" />
                           ) : (
                             <div className="w-2.5 h-2.5 border-2 rounded-[3px] border-current text-pink-500" />
                           )}
                        </div>
                      </div>
                      <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                        {item.previewMedia ? (
                          <img src={item.previewMedia.url} alt={item.title || 'Post'} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary/40"><Eye className="w-6 h-6" /></div>
                        )}
                      </div>
                      <p className="text-xs font-medium line-clamp-2 leading-snug px-1" title={item.title || item.content}>{item.title || item.content || 'Untitled post'}</p>
                      <div className="px-1 mt-auto">
                        <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-sm">{item.status}</span>
                      </div>
                    </div>
                  ))}
                  
                  {/* Add content card */}
                  <Link to="/content" className="snap-start shrink-0 w-40 flex flex-col items-center justify-center gap-2 p-2 rounded-xl border border-dashed border-border/60 hover:bg-muted/30 cursor-pointer transition-colors text-muted-foreground">
                    <Plus className="w-6 h-6" />
                    <span className="text-xs font-medium">Add content</span>
                  </Link>
                </div>
              </Card>
            </section>

            {/* Upcoming Posts */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold font-display">Upcoming posts</h2>
                <Button asChild variant="ghost" size="sm" className="text-sm font-medium">
                  <Link to="/scheduler">View all posts</Link>
                </Button>
              </div>
              
              {upcomingPosts.length === 0 ? (
                 <Card className="bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-8 text-center text-muted-foreground text-sm">
                   No upcoming posts scheduled. Let's create some content!
                 </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {upcomingPosts.map((post, i) => (
                    <Card key={post.id || i} className="bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-5 flex flex-col h-full">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                           <div className={`w-5 h-5 rounded-full flex items-center justify-center bg-card shadow-sm`}>
                             {post.platforms?.[0] === 'whatsapp' ? (
                               <MessageCircle className="w-3 h-3 fill-current text-green-500" />
                             ) : (
                               <div className="w-3 h-3 border-2 rounded-[4px] border-current text-pink-500" />
                             )}
                          </div>
                          <span className="text-sm font-medium capitalize">{post.platforms?.[0] || 'Platform'}</span>
                          <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-sm ml-1">Scheduled</span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {post.scheduledDate ? format(new Date(post.scheduledDate), 'MMM d, h:mm a') : 'TBD'}
                        </div>
                      </div>
                      
                      <div className="flex gap-4 flex-1">
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-muted">
                          {post.previewMedia ? (
                            <img src={post.previewMedia.url} alt={post.title || 'Post'} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary/40"><Eye className="w-6 h-6" /></div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <h3 className="font-semibold text-sm leading-snug mb-1 line-clamp-2" title={post.title}>{post.title || 'Untitled Post'}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{post.content}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-5 pt-4 border-t border-border/40 text-xs text-muted-foreground font-medium">
                        <div className="ml-auto flex items-center gap-1.5"><Clock className="w-4 h-4" /> Pending Publication</div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>
            
          </div>

          {/* Right Column (1/3) */}
          <div className="space-y-6 lg:space-y-8">
            
            {/* Performance Overview */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold font-display">Performance overview</h2>
                <Link to="/analytics" className="text-xs font-medium text-muted-foreground flex items-center cursor-pointer hover:text-foreground transition-colors">
                  Full stats <ChevronRight className="w-3 h-3 ml-0.5" />
                </Link>
              </div>
              
              <Card className="bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-6">
                <div className="grid grid-cols-4 gap-2 mb-8">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Views</p>
                    <p className="text-lg sm:text-xl font-bold">{totals.views > 1000 ? `${(totals.views/1000).toFixed(1)}K` : totals.views}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Engaged</p>
                    <p className="text-lg sm:text-xl font-bold">{engagement > 1000 ? `${(engagement/1000).toFixed(1)}K` : engagement}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Posts</p>
                    <p className="text-lg sm:text-xl font-bold">{totals.publishedPosts}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Inbox</p>
                    <p className="text-lg sm:text-xl font-bold">{totals.pendingReplies}</p>
                  </div>
                </div>
                
                {/* Visual Chart Graphic (Decorative based on metrics) */}
                <div className="relative h-40 w-full mt-4">
                  <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-muted-foreground pb-6">
                    <span>{Math.max(10, Math.ceil(engagement * 1.5))}</span>
                    <span>{Math.max(8, Math.ceil(engagement * 1.2))}</span>
                    <span>{Math.max(5, Math.ceil(engagement * 0.8))}</span>
                    <span>{Math.max(3, Math.ceil(engagement * 0.5))}</span>
                    <span>0</span>
                  </div>
                  <div className="absolute bottom-0 left-8 right-0 flex justify-between text-[9px] text-muted-foreground">
                    <span>-6d</span><span>-5d</span><span>-4d</span><span>-3d</span><span>-2d</span><span>-1d</span><span>Today</span>
                  </div>
                  
                  {/* Chart Line & Fill Mock */}
                  <div className="absolute inset-0 ml-8 mb-6 overflow-hidden text-primary">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                      <path d="M0,80 C10,75 20,60 35,50 C50,40 60,45 75,30 C90,15 95,20 100,10 L100,100 L0,100 Z" fill="url(#gradient)" opacity="0.15" />
                      <path d="M0,80 C10,75 20,60 35,50 C50,40 60,45 75,30 C90,15 95,20 100,10" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                      
                      <defs>
                        <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="currentColor" />
                          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>
              </Card>
            </section>
            
            {/* Top Content */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold font-display">Recent content</h2>
              </div>
              
              <Card className="bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-6">
                {publishedPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No published content yet.</p>
                ) : (
                  <div className="space-y-5">
                    {publishedPosts.map((item, i) => (
                      <div key={item.id || i} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-muted">
                          {item.previewMedia ? (
                            <img src={item.previewMedia.url} alt="post" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary/40"><Eye className="w-4 h-4" /></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" title={item.title || item.content}>{item.title || item.content}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{item.platforms?.[0] || 'Unknown Platform'} • {item.publishedAt ? format(new Date(item.publishedAt), 'MMM d') : 'Recently'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="mt-6 pt-4 border-t border-border/40">
                  <Button asChild variant="ghost" className="w-full text-sm font-medium text-primary hover:bg-primary/5 justify-start px-0 -ml-2">
                    <Link to="/analytics">
                      View full analytics <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Link>
                  </Button>
                </div>
              </Card>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
