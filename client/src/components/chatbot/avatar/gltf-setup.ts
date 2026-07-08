import { useGLTF } from "@react-three/drei";

const DRACO_PATH = "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";

useGLTF.setDecoderPath(DRACO_PATH);

export { useGLTF };

export function preloadGltfAvatar(url: string): void {
  useGLTF.preload(url, true);
}
