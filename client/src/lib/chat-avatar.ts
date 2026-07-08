export type AvatarState = "idle" | "listening" | "thinking" | "speaking";

export type AvatarControllerHandle = {
  setState: (state: AvatarState) => void;
  attachAudio: (audio: HTMLAudioElement) => void;
  detachAudio: () => void;
};

export { createAvatarController } from "./avatar-controller";

export function preloadAvatarModel(url?: string): void {
  const trimmed = url?.trim();
  if (!trimmed || typeof window === "undefined") return;
  if (document.querySelector(`link[rel="prefetch"][href="${trimmed}"]`)) return;
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = trimmed;
  link.as = "fetch";
  document.head.appendChild(link);
}

export type ChatAvatarTheme = {
  avatarMode?: "image" | "3d" | "ar";
  avatarModelUrl?: string;
  avatarUrl?: string;
  primaryColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  gradientAngle?: number;
};

export function is3dAvatarMode(mode?: string): boolean {
  return mode === "3d" || mode === "ar";
}

export function preloadAvatarGltf(url?: string): void {
  preloadAvatarModel(url);
}
