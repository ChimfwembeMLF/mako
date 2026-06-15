import { Suspense } from "react";
import { ContactShadows, Environment } from "@react-three/drei";
import type { AvatarController } from "@/lib/avatar-controller";
import type { AvatarState } from "@/lib/chat-avatar";
import { GltfAvatarModel } from "./GltfAvatarModel";
import { ProceduralAvatarModel } from "./ProceduralAvatarModel";

type Props = {
  modelUrl?: string;
  primaryColor: string;
  state: AvatarState;
  controller: AvatarController | null;
  onLoaded?: () => void;
};

export function AvatarScene({ modelUrl, primaryColor, state, controller, onLoaded }: Props) {
  const trimmed = modelUrl?.trim();

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 5, 4]} intensity={1.15} />
      <directionalLight position={[-3, 2, -2]} intensity={0.4} color="#8899ff" />
      <Environment preset="city" environmentIntensity={0.6} />
      <ContactShadows
        position={[0, -0.02, 0]}
        opacity={0.35}
        scale={8}
        blur={2.5}
        far={4}
        resolution={256}
      />
      <Suspense fallback={null}>
        {trimmed ? (
          <GltfAvatarModel
            url={trimmed}
            state={state}
            controller={controller}
            onLoaded={onLoaded}
          />
        ) : (
          <ProceduralAvatarModel
            primaryColor={primaryColor}
            state={state}
            controller={controller}
            onLoaded={onLoaded}
          />
        )}
      </Suspense>
    </>
  );
}
