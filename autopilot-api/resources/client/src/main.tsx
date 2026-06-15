import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/** Drop legacy SW that intercepted /api OAuth navigations (pre-2026-06 deploy). */
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      void registration.unregister();
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
