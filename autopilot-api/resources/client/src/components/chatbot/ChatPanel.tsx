import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send } from "lucide-react";
import type { ChatCitation, ChatMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ChatMarkdown } from "./ChatMarkdown";
import { MessageListenButton } from "./MessageListenButton";
import { ChatAvatarHeader } from "./ChatAvatarHeader";
import { ChatAvatarStage } from "./ChatAvatarStage";
import { is3dAvatarMode, type AvatarControllerHandle, type AvatarState, type ChatAvatarTheme } from "@/lib/chat-avatar";

type Props = {
  messages: ChatMessage[];
  onSend: (content: string) => Promise<void>;
  sending?: boolean;
  className?: string;
  emptyHint?: string;
  ttsEnabled?: boolean;
  onSpeak?: (messageId: string) => Promise<Blob>;
  botName?: string;
  avatarTheme?: ChatAvatarTheme;
};

export function ChatPanel({
  messages,
  onSend,
  sending,
  className,
  emptyHint,
  ttsEnabled,
  onSpeak,
  botName,
  avatarTheme,
}: Props) {
  const [input, setInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const avatarController = useRef<AvatarControllerHandle | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const showHeader = Boolean(botName && avatarTheme);
  const use3dAvatar = Boolean(avatarTheme && is3dAvatarMode(avatarTheme.avatarMode));

  const avatarState: AvatarState = speaking
    ? "speaking"
    : sending
      ? "thinking"
      : inputFocused && input.trim()
        ? "listening"
        : "idle";

  const handleControllerReady = useCallback((controller: AvatarControllerHandle | null) => {
    avatarController.current = controller;
  }, []);

  const handleSpeechAudio = useCallback((audio: HTMLAudioElement | null) => {
    const ctrl = avatarController.current;
    if (!ctrl) return;
    if (audio) {
      setSpeaking(true);
      ctrl.attachAudio(audio);
    } else {
      ctrl.detachAudio();
      setSpeaking(false);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    await onSend(text);
  };

  return (
    <div className={cn("flex flex-col h-full min-h-[320px]", className)}>
      {showHeader && (
        <ChatAvatarHeader
          botName={botName!}
          theme={avatarTheme!}
          className="-mx-1 -mt-1 mb-2"
        />
      )}
      <ScrollArea className="flex-1 pr-3">
        <div className="space-y-3 py-2">
          {showHeader && use3dAvatar && (
            <ChatAvatarStage
              theme={avatarTheme!}
              state={avatarState}
              onControllerReady={handleControllerReady}
            />
          )}
          {!messages.length && emptyHint && (
            <p className="text-sm text-muted-foreground text-center py-8">{emptyHint}</p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted rounded-bl-md",
                )}
              >
                {msg.role === "assistant" ? (
                  <ChatMarkdown content={msg.content} />
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {msg.citations.map((c, i) => (
                      <CitationChip key={`${c.documentId}-${i}`} citation={c} />
                    ))}
                  </div>
                )}
                {ttsEnabled && msg.role === "assistant" && onSpeak && !msg.id.startsWith("tmp-") && (
                  <MessageListenButton
                    messageId={msg.id}
                    onSpeak={onSpeak}
                    onSpeechAudio={use3dAvatar ? handleSpeechAudio : undefined}
                  />
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="flex gap-2 pt-3 border-t mt-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          rows={2}
          className="resize-none min-h-[44px]"
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <Button
          size="icon"
          className="shrink-0 self-end"
          disabled={!input.trim() || sending}
          onClick={() => void handleSend()}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function CitationChip({ citation }: { citation: ChatCitation }) {
  return (
    <Badge variant="secondary" className="text-[10px] font-normal max-w-full truncate" title={citation.excerpt}>
      {citation.title}
    </Badge>
  );
}
