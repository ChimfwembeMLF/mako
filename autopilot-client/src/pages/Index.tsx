import { Brain, Pen, CalendarClock, MessageSquare, BarChart3, Zap, ArrowRight, Bot, BookOpen, History } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { usePermissions } from "@/hooks/usePermissions";
import { P, type PermissionKey } from "@/lib/permissions";

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
    gradient: "gradient-primary",
    status: "Setup required",
  },
  {
    title: "Content Engine",
    description: "Auto-generate posts, emails, and ad copy",
    icon: Pen,
    href: "/content",
    gradient: "gradient-secondary",
    status: "Ready",
  },
  {
    title: "Scheduler",
    description: "Plan and publish across all channels",
    icon: CalendarClock,
    href: "/scheduler",
    gradient: "gradient-accent",
    status: "Ready",
  },
  {
    title: "Lead Agent",
    description: "Qualify, reply, and book meetings automatically",
    icon: MessageSquare,
    href: "/leads",
    gradient: "gradient-secondary",
    status: "Ready",
  },
  {
    title: "AI Chatbot",
    description: "Brand Brain–powered assistant with document knowledge",
    icon: Bot,
    href: "/chatbot",
    gradient: "gradient-accent",
    status: "Ready",
    permission: P.chatbot.view,
  },
  {
    title: "Knowledge Library",
    description: "Upload PDFs and docs for chatbot retrieval",
    icon: BookOpen,
    href: "/chatbot/knowledge",
    gradient: "gradient-primary",
    status: "Ready",
    permission: P.chatbot.view,
  },
  {
    title: "Conversation Log",
    description: "Review widget and playground chat transcripts",
    icon: History,
    href: "/chatbot/sessions",
    gradient: "gradient-secondary",
    status: "Ready",
    permission: P.chatbot.view,
  },
  {
    title: "Analytics",
    description: "Track performance and optimize automatically",
    icon: BarChart3,
    href: "/analytics",
    gradient: "gradient-primary",
    status: "Ready",
  },
];

const Dashboard = () => {
  const { can, loading } = usePermissions();
  const visibleModules = loading
    ? modules
    : modules.filter((mod) => !mod.permission || can(mod.permission));

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl gradient-primary p-8 shadow-glow">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-5 w-5 text-primary-foreground" />
            <span className="text-primary-foreground/80 text-sm font-medium uppercase tracking-wider">
              AI Marketing Mako
            </span>
          </div>
          <h1 className="text-3xl font-bold font-display text-primary-foreground mb-2">
            Welcome to Mako Co-pilot
          </h1>
          <p className="text-primary-foreground/70 max-w-lg">
            Your autonomous marketing engine. Set up your Brand Brain first, then let AI handle content, publishing, leads, and optimization.
          </p>
        </div>
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-foreground/10 blur-2xl" />
        <div className="absolute -right-5 -bottom-10 h-32 w-32 rounded-full bg-primary-foreground/5 blur-xl" />
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleModules.map((mod) => (
          <Link key={mod.title} to={mod.href}>
            <Card className="group hover:shadow-card transition-all duration-200 border-border/50 hover:border-primary/30 h-full">
              <CardContent className="p-5 space-y-3">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${mod.gradient}`}>
                  <mod.icon className="h-5 w-5 text-primary-foreground" />
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
  );
};

export default Dashboard;