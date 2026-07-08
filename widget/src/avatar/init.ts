import { AvatarController } from './controller';
import { loadAvatarChunk } from './load-script';
import type { AvatarConfig } from './types';

export type AvatarRuntime = {
  controller: AvatarController;
  destroy: () => void;
};

type MountPanelAvatar = typeof import('./panel-3d').mountPanelAvatar;
type OpenArView = typeof import('./ar-view').openArView;

export async function initAvatarSystem(params: {
  config: AvatarConfig;
  headerEl: HTMLElement;
  chatBodyEl?: HTMLElement | null;
  onArButton?: (btn: HTMLButtonElement) => void;
}): Promise<AvatarRuntime | null> {
  const { config } = params;
  const use3d = config.mode === '3d' || config.mode === 'ar';
  const showAr = config.arEnabled || config.mode === 'ar';

  if (!use3d && !showAr) return null;

  const controller = new AvatarController();
  const cleanups: Array<() => void> = [];
  let arClose: (() => void) | null = null;

  if (use3d) {
    await loadAvatarChunk(config.widgetBase, 'avatar-3d');
    const mount = (window as unknown as { AutopilotAvatar3d?: MountPanelAvatar }).AutopilotAvatar3d;
    if (mount) {
      let slotHost: HTMLElement;
      if (params.chatBodyEl) {
        const wrap = document.createElement('div');
        wrap.className = 'ap-avatar-inline';
        slotHost = document.createElement('div');
        slotHost.className = 'ap-avatar-inline-slot';
        wrap.appendChild(slotHost);
        params.chatBodyEl.insertBefore(wrap, params.chatBodyEl.firstChild);
        cleanups.push(() => wrap.remove());
      } else {
        if (config.avatarUrl) {
          const logo = document.createElement('img');
          logo.src = config.avatarUrl;
          logo.alt = '';
          logo.className = 'ap-header-logo';
          params.headerEl.prepend(logo);
        }
        slotHost = document.createElement('div');
        slotHost.className = 'ap-avatar-3d-slot';
        params.headerEl.prepend(slotHost);
        cleanups.push(() => slotHost.remove());
      }
      const panel = mount({
        container: slotHost,
        modelUrl: config.modelUrl,
        primaryColor: config.primaryColor,
        controller,
      });
      cleanups.push(() => panel.destroy());
    }
  }

  if (showAr) {
    const arBtn = document.createElement('button');
    arBtn.type = 'button';
    arBtn.className = 'ap-ar-btn';
    arBtn.textContent = '◎ AR';
    arBtn.title = 'View agent in augmented reality';
    arBtn.setAttribute('aria-label', 'View agent in AR');
    params.headerEl.appendChild(arBtn);
    params.onArButton?.(arBtn);

    arBtn.addEventListener('click', () => {
      void (async () => {
        if (arClose) {
          arClose();
          arClose = null;
          return;
        }
        try {
          await loadAvatarChunk(config.widgetBase, 'ar-view');
          const open = (window as unknown as { AutopilotArView?: OpenArView }).AutopilotArView;
          if (!open) return;
          const view = await open({
            modelUrl: config.modelUrl,
            markerUrl: config.arMarkerUrl,
            primaryColor: config.primaryColor,
            controller,
          });
          arClose = () => {
            view.close();
            arClose = null;
            arBtn.textContent = '◎ AR';
          };
          arBtn.textContent = '✕ AR';
        } catch (e) {
          console.warn('[Mako] AR view failed', e);
        }
      })();
    });
    cleanups.push(() => {
      arClose?.();
      arBtn.remove();
    });
  }

  return {
    controller,
    destroy: () => {
      for (const fn of cleanups) fn();
      controller.destroy();
    },
  };
}
