import * as THREE from "three";

const MORPH_KEYS = [
  "jawOpen",
  "mouthOpen",
  "viseme_aa",
  "viseme_O",
  "viseme_E",
  "mouthSmile",
];

export function applyMorphTargets(root: THREE.Object3D, open: number): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const dict = child.morphTargetDictionary;
    const inf = child.morphTargetInfluences;
    if (!dict || !inf) return;
    for (const key of MORPH_KEYS) {
      if (key === "mouthSmile") continue;
      const idx = dict[key];
      if (idx !== undefined) {
        inf[idx] = open * (key.includes("viseme") ? 0.55 : 0.75);
      }
    }
  });
}
