import { useEffect, useState } from "react";
import MarkdownPreview from "@uiw/react-markdown-preview";
import "@uiw/react-markdown-preview/markdown.css";
import { cn } from "@/lib/utils";

type Props = {
  content: string;
  className?: string;
};

function useColorMode(): "light" | "dark" {
  const [mode, setMode] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
      ? "dark"
      : "light",
  );

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setMode(root.classList.contains("dark") ? "dark" : "light");
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return mode;
}

export function ChatMarkdown({ content, className }: Props) {
  const colorMode = useColorMode();

  if (!content.trim()) return null;

  return (
    <div className={cn("chat-markdown min-w-0", className)}>
      <MarkdownPreview
        source={content}
        wrapperElement={{ "data-color-mode": colorMode }}
        style={{ backgroundColor: "transparent", color: "inherit", fontSize: "inherit" }}
      />
    </div>
  );
}
