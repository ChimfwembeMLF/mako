import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log(`[BOOT] React Frontend mounted at ${new Date().toISOString()}`);

createRoot(document.getElementById("root")!).render(<App />);
