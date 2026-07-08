import { useEffect, useMemo, useRef } from "react";
import { Bounds, Center } from "@react-three/drei";
import * as THREE from "three";
import type { AvatarController } from "@/lib/avatar-controller";
import type { AvatarState } from "@/lib/chat-avatar";
import { useAvatarMotion } from "./useAvatarMotion";

type Props = {
  primaryColor: string;
  state: AvatarState;
  controller: AvatarController | null;
  onLoaded?: () => void;
};

export function ProceduralAvatarModel({ primaryColor, state, controller, onLoaded }: Props) {
  const groupRef = useRef<THREE.Group>(null);

  const avatar = useMemo(() => {
    const root = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: primaryColor,
      roughness: 0.55,
      metalness: 0.05,
    });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.65 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.7, 8, 16), bodyMat);
    body.position.y = 0.85;
    root.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 24), skinMat);
    head.position.y = 1.55;
    root.add(head);

    const mouth = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0x8b4545 }),
    );
    mouth.position.set(0, 1.42, 0.34);
    mouth.scale.set(1.2, 0.35, 0.5);
    root.add(mouth);

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const eyeGeo = new THREE.SphereGeometry(0.045, 12, 12);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.12, 1.62, 0.3);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.12;
    root.add(eyeL, eyeR);

    return { root, mouth };
  }, [primaryColor]);

  const proceduralMouth = useMemo(
    () => ({ mesh: avatar.mouth, baseY: 1.42 as number }),
    [avatar.mouth],
  );

  useAvatarMotion(groupRef, state, controller, proceduralMouth);

  useEffect(() => {
    onLoaded?.();
  }, [avatar, onLoaded]);

  return (
    <Bounds fit clip observe margin={1.35}>
      <group ref={groupRef}>
        <Center>
          <primitive object={avatar.root} />
        </Center>
      </group>
    </Bounds>
  );
}
