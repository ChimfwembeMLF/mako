import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { API_BASE_URL } from "@/lib/api";

const WIDGET_KEY = import.meta.env.VITE_WIDGET_API_KEY as string | undefined;

/** Loads the embeddable chatbot widget (public sites / demo). */
export function ChatbotWidgetLoader() {
  const { pathname } = useLocation();

  useEffect(() => {
    const key = WIDGET_KEY?.trim();
    if (!key || pathname.startsWith("/chatbot")) return;

    const src = `${window.location.origin}/widget/v1/loader.js?v=5`;
    if (document.querySelector(`script[src="${src}"][data-key="${key}"]`)) return;

    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    script.setAttribute("data-key", key);
    script.setAttribute("data-api", API_BASE_URL);

    document.body.appendChild(script);

    return () => {
      document.getElementById("autopilot-widget-root")?.remove();
      script.remove();
    };
  }, [pathname]);

  return null;
}
