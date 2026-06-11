import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  createAvatarController,
  is3dAvatarMode,
  loadAvatar3dScript,
  mountAvatar3d,
  type AvatarControllerHandle,
  type AvatarState,
  type ChatAvatarTheme,
} from "@/lib/chat-avatar";
import { resolveWidgetColors } from "@/lib/widget-theme";
import { cn } from "@/lib/utils";

type ChatAvatarStageProps = {
  theme: ChatAvatarTheme;
  state?: AvatarState;
  onControllerReady?: (controller: AvatarControllerHandle | null) => void;
  className?: string;
};

export function ChatAvatarStage({
  theme,
  state = "idle",
  onControllerReady,
  className,
}: ChatAvatarStageProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AvatarControllerHandle | null>(null);
  const onReadyRef = useRef(onControllerReady);
  onReadyRef.current = onControllerReady;
  const [loading, setLoading] = useState(true);
  const { primary } = resolveWidgetColors(theme);

  useEffect(() => {
    if (!is3dAvatarMode(theme.avatarMode) || !slotRef.current) {
      controllerRef.current = null;
      onReadyRef.current?.(null);
      setLoading(false);
      return;
    }

    let destroyed = false;
    let cleanup: (() => void) | null = null;
    setLoading(true);

    void loadAvatar3dScript().then(() => {
      if (destroyed || !slotRef.current) return;
      const controller = createAvatarController();
      if (!controller) {
        setLoading(false);
        return;
      }
      controllerRef.current = controller;
      onReadyRef.current?.(controller);
      cleanup = mountAvatar3d({
        container: slotRef.current,
        modelUrl: theme.avatarModelUrl?.trim() || undefined,
        primaryColor: primary,
        controller,
      });
      controller.setState(state);
      setLoading(false);
    });

    return () => {
      destroyed = true;
      cleanup?.();
      controllerRef.current = null;
      onReadyRef.current?.(null);
      setLoading(false);
    };
  }, [theme.avatarMode, theme.avatarModelUrl, primary]);

  useEffect(() => {
    controllerRef.current?.setState(state);
  }, [state]);

  if (!is3dAvatarMode(theme.avatarMode)) return null;

  return (
    <div className={cn("flex justify-start", className)}>
      <div className="relative h-14 w-14 shrink-0 rounded-full overflow-hidden bg-muted/50 ring-1 ring-border/60">
        <div ref={slotRef} className="h-full w-full" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/70">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
