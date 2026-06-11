export type AvatarState = "idle" | "listening" | "thinking" | "speaking";

export type AvatarControllerHandle = {
  setState: (state: AvatarState) => void;
  attachAudio: (audio: HTMLAudioElement) => void;
  detachAudio: () => void;
};

type MountPanelAvatar = (opts: {
  container: HTMLElement;
  modelUrl?: string;
  primaryColor: string;
  controller: AvatarControllerHandle;
  onModelLoaded?: () => void;
}) => { destroy: () => void };

type AvatarControllerCtor = new () => AvatarControllerHandle;

const WIDGET_SCRIPT = "/widget/v1/avatar-3d.js";

let scriptPromise: Promise<void> | null = null;

/** Warm the Three.js avatar chunk before the chat panel mounts. */
export function preloadAvatar3dScript(): void {
  if (typeof window === "undefined") return;
  void loadAvatar3dScript();
  if (!document.querySelector(`link[rel="prefetch"][href="${WIDGET_SCRIPT}"]`)) {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = WIDGET_SCRIPT;
    link.as = "script";
    document.head.appendChild(link);
  }
}

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

export function loadAvatar3dScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as unknown as { AutopilotAvatar3d?: MountPanelAvatar }).AutopilotAvatar3d) {
    return Promise.resolve();
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${WIDGET_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load avatar script")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src = WIDGET_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load avatar script"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export function createAvatarController(): AvatarControllerHandle | null {
  const Ctor = (window as unknown as { AutopilotAvatarController?: AvatarControllerCtor })
    .AutopilotAvatarController;
  return Ctor ? new Ctor() : null;
}

export function mountAvatar3d(opts: {
  container: HTMLElement;
  modelUrl?: string;
  primaryColor: string;
  controller: AvatarControllerHandle;
  onModelLoaded?: () => void;
}): (() => void) | null {
  const mount = (window as unknown as { AutopilotAvatar3d?: MountPanelAvatar }).AutopilotAvatar3d;
  if (!mount) return null;
  const panel = mount(opts);
  return () => panel.destroy();
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
