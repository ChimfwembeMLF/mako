import { Bot } from "lucide-react";
import { type ChatAvatarTheme } from "@/lib/chat-avatar";
import { resolveWidgetColors } from "@/lib/widget-theme";
import { cn } from "@/lib/utils";

type ChatAvatarHeaderProps = {
  botName: string;
  theme: ChatAvatarTheme;
  className?: string;
};

export function ChatAvatarHeader({ botName, theme, className }: ChatAvatarHeaderProps) {
  const { gradient } = resolveWidgetColors(theme);
  const avatarUrl = theme.avatarUrl?.trim();

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-t-xl px-4 py-3 text-white shrink-0",
        className,
      )}
      style={{ background: gradient }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-10 w-10 rounded-full object-cover ring-2 ring-white/25 shrink-0"
        />
      ) : (
        <div className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center shrink-0">
          <Bot className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm truncate">{botName}</p>
        <p className="text-xs text-white/80 truncate">Assistant</p>
      </div>
    </div>
  );
}
