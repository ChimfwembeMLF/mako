import { loadScript } from './load-script';
import type { AvatarController } from './controller';
import type { AvatarState } from './types';

const AFRAME_URL = 'https://aframe.io/releases/1.5.0/aframe.min.js';
const ARJS_URL = 'https://cdn.jsdelivr.net/gh/AR-js-org/AR.js@3.4.7/aframe/build/aframe-ar-nft.js';

export type ArViewOptions = {
  modelUrl?: string;
  markerUrl?: string;
  primaryColor: string;
  controller: AvatarController;
};

export async function openArView(opts: ArViewOptions): Promise<{ close: () => void }> {
  await loadScript(AFRAME_URL);
  await loadScript(ARJS_URL);

  const overlay = document.createElement('div');
  overlay.id = 'ap-ar-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:2147483646;background:#000;font-family:system-ui,sans-serif;';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '✕ Close AR';
  closeBtn.style.cssText =
    'position:absolute;top:16px;right:16px;z-index:10;padding:10px 16px;border:none;border-radius:10px;background:rgba(255,255,255,0.95);font-weight:600;cursor:pointer;';
  overlay.appendChild(closeBtn);

  const hint = document.createElement('div');
  hint.textContent = opts.markerUrl
    ? 'Point your camera at the marker image'
    : 'Move your phone to place the agent in view';
  hint.style.cssText =
    'position:absolute;bottom:24px;left:50%;transform:translateX(-50%);z-index:10;color:#fff;font-size:13px;background:rgba(0,0,0,0.55);padding:8px 14px;border-radius:999px;white-space:nowrap;';
  overlay.appendChild(hint);

  const sceneHtml = opts.markerUrl
    ? `
    <a-scene
      embedded
      arjs="sourceType: webcam; debugUIEnabled: false; detectionMode: mono_and_matrix; matrixCodeType: 3x3;"
      vr-mode-ui="enabled: false"
      renderer="alpha: true; antialias: true;"
      style="width:100%;height:100%;"
    >
      <a-nft
        type="nft"
        url="${escapeAttr(opts.markerUrl.replace(/\.(png|jpg|jpeg|webp)$/i, ''))}"
        smooth="true"
        smoothCount="10"
        smoothTolerance="0.01"
        smoothThreshold="5"
      >
        <a-entity id="ap-ar-avatar" position="0 0 0" scale="5 5 5"></a-entity>
      </a-nft>
      <a-entity camera></a-entity>
    </a-scene>`
    : `
    <a-scene
      embedded
      arjs="sourceType: webcam; debugUIEnabled: false;"
      vr-mode-ui="enabled: false"
      renderer="alpha: true; antialias: true;"
      style="width:100%;height:100%;"
    >
      <a-entity id="ap-ar-avatar" position="0 0 -1.2" scale="0.5 0.5 0.5"></a-entity>
      <a-entity camera></a-entity>
    </a-scene>`;

  overlay.insertAdjacentHTML('beforeend', sceneHtml);
  document.body.appendChild(overlay);

  const avatarEl = overlay.querySelector('#ap-ar-avatar') as HTMLElement & {
    setAttribute?: (k: string, v: string) => void;
    object3D?: { rotation: { y: number; x: number }; position: { y: number } };
  };

  if (opts.modelUrl && avatarEl?.setAttribute) {
    avatarEl.setAttribute('gltf-model', `url(${opts.modelUrl})`);
  } else if (avatarEl?.setAttribute) {
    avatarEl.setAttribute(
      'geometry',
      'primitive: box; width: 0.4; height: 0.8; depth: 0.3',
    );
    avatarEl.setAttribute('material', `color: ${opts.primaryColor}`);
    const head = document.createElement('a-sphere');
    head.setAttribute('radius', '0.22');
    head.setAttribute('position', '0 0.55 0');
    head.setAttribute('material', 'color: #ffdbac');
    avatarEl.appendChild(head);
  }

  let state: AvatarState = opts.controller.getState();
  let mouthOpen = 0;
  let phase = 0;

  const offState = opts.controller.onState((s) => {
    state = s;
  });
  const offLip = opts.controller.onLipSync((v) => {
    mouthOpen = v;
  });

  let raf = 0;
  function tick(): void {
    raf = requestAnimationFrame(tick);
    phase += 0.016;
    const el = avatarEl as { object3D?: { rotation: { y: number; x: number }; position: { y: number }; scale: { y: number } } };
    if (!el?.object3D) return;
    if (state === 'speaking') {
      el.object3D.rotation.y = Math.sin(phase * 2) * 0.1;
      el.object3D.position.y = Math.sin(phase * 10) * 0.02 * mouthOpen;
      el.object3D.scale.y = 1 + mouthOpen * 0.06;
    } else if (state === 'thinking') {
      el.object3D.rotation.x = -0.15 + Math.sin(phase) * 0.05;
      el.object3D.rotation.y = Math.sin(phase * 0.7) * 0.12;
    } else if (state === 'listening') {
      el.object3D.rotation.y = Math.sin(phase * 0.5) * 0.08;
    } else {
      el.object3D.rotation.y = Math.sin(phase * 0.35) * 0.05;
      el.object3D.rotation.x *= 0.95;
    }
  }
  tick();

  function close(): void {
    cancelAnimationFrame(raf);
    offState();
    offLip();
    overlay.remove();
  }

  closeBtn.addEventListener('click', close);

  return { close };
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
