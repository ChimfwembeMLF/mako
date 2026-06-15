import { useEffect, useMemo, useRef } from "react";
import { Bounds, Center, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { AvatarController } from "@/lib/avatar-controller";
import type { AvatarState } from "@/lib/chat-avatar";
import { useAvatarMotion } from "./useAvatarMotion";
import "./gltf-setup";

type Props = {
  url: string;
  state: AvatarState;
  controller: AvatarController | null;
  onLoaded?: () => void;
};

export function GltfAvatarModel({ url, state, controller, onLoaded }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url, true);
  const clone = useMemo(() => scene.clone(true), [scene]);

  useAvatarMotion(groupRef, state, controller);

  useEffect(() => {
    onLoaded?.();
  }, [clone, onLoaded]);

  return (
    <Bounds fit clip observe margin={1.35}>
      <group ref={groupRef}>
        <Center>
          <primitive object={clone} />
        </Center>
      </group>
    </Bounds>
  );
}
