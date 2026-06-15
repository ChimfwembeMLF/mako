import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AvatarController } from "@/lib/avatar-controller";
import type { AvatarState } from "@/lib/chat-avatar";
import { applyMorphTargets } from "./apply-mouth-morphs";

type ProceduralMouth = {
  mesh: THREE.Mesh;
  baseY: number;
};

export function useAvatarMotion(
  rootRef: React.RefObject<THREE.Group | null>,
  state: AvatarState,
  controller: AvatarController | null,
  proceduralMouth?: ProceduralMouth | null,
) {
  const mouthOpen = useRef(0);
  const bobPhase = useRef(0);

  useEffect(() => {
    if (!controller) return;
    return controller.onLipSync((v) => {
      mouthOpen.current = v;
    });
  }, [controller]);

  useFrame((_, delta) => {
    const root = rootRef.current;
    if (!root) return;

    bobPhase.current += delta;
    const open =
      state === "speaking"
        ? mouthOpen.current
        : mouthOpen.current * 0.3;

    if (proceduralMouth) {
      proceduralMouth.mesh.scale.y = 0.35 + open * 0.85;
      proceduralMouth.mesh.position.y = proceduralMouth.baseY - open * 0.04;
    } else {
      applyMorphTargets(root, open);
    }

    if (state === "speaking") {
      root.rotation.y = Math.sin(bobPhase.current * 2.5) * 0.04;
      root.position.y = Math.sin(bobPhase.current * 8) * 0.015;
    } else {
      root.position.y = 0;
      if (state === "thinking") {
        root.rotation.y = Math.sin(bobPhase.current * 1.2) * 0.08;
        root.rotation.x = -0.06 + Math.sin(bobPhase.current * 2) * 0.03;
      } else if (state === "listening") {
        root.rotation.y = Math.sin(bobPhase.current * 0.8) * 0.05;
        root.rotation.z = Math.sin(bobPhase.current * 1.5) * 0.02;
      } else {
        root.rotation.y = Math.sin(bobPhase.current * 0.5) * 0.03;
        root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, 0, 0.05);
        root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, 0, 0.05);
      }
    }
  });
}
