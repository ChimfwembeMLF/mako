import { Brain, Pen, CalendarClock, MessageSquare, BarChart3, Zap, ArrowRight, Bot, BookOpen, History, Target, Link2, Megaphone, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { P, type PermissionKey } from "@/lib/permissions";
import { canAccessSocialShell } from "@/lib/social-shell";
import { cn } from "@/lib/utils";

type DashboardModule = {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  gradient: string;
  status: string;
  permission?: PermissionKey;
};

const modules: DashboardModule[] = [
  {
    title: "Brand Brain",
    description: "Define your company identity, audience, and voice",
    icon: Brain,
    href: "/brand-brain",
    gradient: "bg-primary",
    status: "Setup required",
  },
  {
    title: "Content Engine",
    description: "Auto-generate posts, emails, and ad copy",
    icon: Pen,
    href: "/content",
    gradient: "bg-surface-strong text-foreground",
    status: "Ready",
  },
  {
    title: "Scheduler",
    description: "Plan and publish across all channels",
    icon: CalendarClock,
    href: "/scheduler",
    gradient: "bg-primary",
    status: "Ready",
  },
  {
    title: "Connections",
    description: "Link social and ad accounts via OAuth",
    icon: Link2,
    href: "/publisher",
    gradient: "bg-surface-strong text-foreground",
    status: "Ready",
  },
  {
    title: "Ads",
    description: "Launch paid campaigns on Meta, Google, TikTok, LinkedIn, and more",
    icon: Target,
    href: "/ads",
    gradient: "bg-primary",
    status: "Ready",
  },
  {
    title: "Leads",
    description: "Qualify, reply, and book meetings automatically",
    icon: MessageSquare,
    href: "/leads",
    gradient: "bg-surface-strong text-foreground",
    status: "Ready",
  },
  {
    title: "Mail",
    description: "Gmail inbox, drafts, and auto-replies",
    icon: Mail,
    href: "/mail",
    gradient: "bg-primary",
    status: "Ready",
  },
  {
    title: "Chatbot",
    description: "Brand Brain–powered assistant with document knowledge",
    icon: Bot,
    href: "/chatbot",
    gradient: "bg-surface-strong text-foreground",
    status: "Ready",
    permission: P.chatbot.view,
  },
  {
    title: "Knowledge",
    description: "Upload PDFs and docs for chatbot retrieval",
    icon: BookOpen,
    href: "/chatbot/knowledge",
    gradient: "bg-primary",
    status: "Ready",
    permission: P.chatbot.view,
  },
  {
    title: "Chat History",
    description: "Review widget and playground chat transcripts",
    icon: History,
    href: "/chatbot/sessions",
    gradient: "bg-surface-strong text-foreground",
    status: "Ready",
    permission: P.chatbot.view,
  },
  {
    title: "Analytics",
    description: "Track performance and optimize automatically",
    icon: BarChart3,
    href: "/analytics",
    gradient: "bg-primary",
    status: "Ready",
  },
];

const Dashboard = () => {
  const { can, canAny, loading } = usePermissions();
  const visibleModules = loading
    ? modules
    : modules.filter((mod) => !mod.permission || can(mod.permission));
  const showSocialEntry = loading || canAccessSocialShell(canAny);

  return (
    <div className="w-full space-y-6 sm:space-y-8 pb-8 sm:pb-10 min-w-0">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-md bg-primary p-6 sm:p-8 shadow-elevated">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-5 w-5 text-primary-foreground" />
            <span className="text-primary-foreground/80 text-xs sm:text-sm font-medium uppercase tracking-wider">
              AI Marketing Mako
            </span>
          </div>
          <h1 className="text-display-xl text-primary-foreground mb-2">
            Welcome to Mako 
          </h1>
          <p className="text-primary-foreground/70 max-w-lg">
            Your autonomous marketing engine. Set up your Brand Brain first, then let AI handle content, publishing, leads, and optimization.
          </p>
        </div>
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-foreground/10 blur-2xl" />
        <div className="absolute -right-5 -bottom-10 h-32 w-32 rounded-full bg-primary-foreground/5 blur-xl" />
      </div>

      {showSocialEntry && (
        <Link to="/social" className="block">
          <Card className="border-0 bg-foreground text-background overflow-hidden group">
            <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">
                    Social media
                  </p>
                  <h2 className="font-display text-lg sm:text-xl font-semibold tracking-tight">
                    Open Social Dashboard
                  </h2>
                  <p className="text-sm text-background/70 mt-1 max-w-lg">
                    Focused home for content, scheduling, connections, and inbox — built for social operators.
                  </p>
                </div>
              </div>
              <Button className="shrink-0 rounded-xl min-h-12 self-start sm:self-center group-hover:translate-x-0.5 transition-transform">
                Go to Social <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Module cards */}
      <div>
        <h2 className="text-lg font-semibold font-display mb-3">Quick links</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleModules.map((mod) => (
          <Link key={mod.title} to={mod.href}>
            <Card className="group hover:shadow-card transition-all duration-200 border-border/50 hover:border-primary/30 h-full">
              <CardContent className="p-5 space-y-3">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-md ${mod.gradient}`}>
                  <mod.icon className={cn("h-5 w-5", mod.gradient.includes("surface-strong") ? "text-foreground" : "text-primary-foreground")} />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-card-foreground flex items-center gap-2">
                    {mod.title}
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">{mod.description}</p>
                </div>
                <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                  mod.status === "Setup required"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {mod.status}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      </div>
    </div>
  );
};

export default Dashboard;