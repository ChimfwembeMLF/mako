import { Construction } from "lucide-react";
import { useLocation } from "react-router-dom";

const titles: Record<string, string> = {
  "/content": "Content Engine",
  "/scheduler": "Scheduler",
  "/leads": "Leads",
  "/analytics": "Analytics & Optimization",
  "/settings": "Settings",
};

const ComingSoon = () => {
  const location = useLocation();
  const title = titles[location.pathname] || "Module";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-strong text-foreground mb-6">
        <Construction className="h-8 w-8 text-secondary-foreground" />
      </div>
      <h1 className="text-2xl font-bold font-display mb-2">{title}</h1>
      <p className="text-muted-foreground max-w-md">
        This module is coming soon. Set up your Brand Brain first — it powers everything else.
      </p>
    </div>
  );
};

export default ComingSoon;