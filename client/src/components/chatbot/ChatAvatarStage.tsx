import { Suspense, useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Loader2 } from "lucide-react";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { createAvatarController, type AvatarController } from "@/lib/avatar-controller";
import {
  is3dAvatarMode,
  type AvatarControllerHandle,
  type AvatarState,
  type ChatAvatarTheme,
} from "@/lib/chat-avatar";
import { resolveWidgetColors } from "@/lib/widget-theme";
import { cn } from "@/lib/utils";
import { AvatarScene } from "./avatar/AvatarScene";

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
  const [controller, setController] = useState<AvatarController | null>(null);
  const [loading, setLoading] = useState(true);
  const { primary } = resolveWidgetColors(theme);
  const modelUrl = theme.avatarModelUrl?.trim();

  useEffect(() => {
    const c = createAvatarController();
    setController(c);
    onControllerReady?.(c);
    return () => {
      c.destroy();
      setController(null);
      onControllerReady?.(null);
    };
  }, [onControllerReady]);

  useEffect(() => {
    controller?.setState(state);
  }, [controller, state]);

  useEffect(() => {
    setLoading(true);
  }, [modelUrl]);

  const handleLoaded = useCallback(() => {
    setLoading(false);
  }, []);

  if (!is3dAvatarMode(theme.avatarMode)) return null;

  return (
    <div className={cn("w-full", className)}>
      <div className="relative w-full h-28 shrink-0 overflow-hidden rounded-lg bg-gradient-to-b from-muted/30 to-muted/10">
        <Canvas
          className="absolute inset-0"
          dpr={[1, 2]}
          gl={{
            antialias: true,
            alpha: true,
            toneMapping: ACESFilmicToneMapping,
            outputColorSpace: SRGBColorSpace,
          }}
          camera={{ fov: 32, near: 0.01, far: 1000, position: [0, 1.2, 3] }}
        >
          <Suspense fallback={null}>
            <AvatarScene
              modelUrl={modelUrl}
              primaryColor={primary}
              state={state}
              controller={controller}
              onLoaded={handleLoaded}
            />
          </Suspense>
        </Canvas>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/30 pointer-events-none">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
