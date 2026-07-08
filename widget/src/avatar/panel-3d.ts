import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { AvatarController } from './controller';
import type { AvatarState } from './types';

export type PanelAvatarOptions = {
  container: HTMLElement;
  modelUrl?: string;
  primaryColor: string;
  controller: AvatarController;
  onModelLoaded?: () => void;
};

const MORPH_KEYS = [
  'jawOpen',
  'mouthOpen',
  'viseme_aa',
  'viseme_O',
  'viseme_E',
  'mouthSmile',
];

let sharedDracoLoader: DRACOLoader | null = null;

function getDracoLoader(): DRACOLoader {
  if (!sharedDracoLoader) {
    sharedDracoLoader = new DRACOLoader();
    sharedDracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  }
  return sharedDracoLoader;
}

export function mountPanelAvatar(opts: PanelAvatarOptions): { destroy: () => void } {
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  opts.container.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'default',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 1000);

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(2, 4, 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8899ff, 0.35);
  fill.position.set(-2, 1, -1);
  scene.add(fill);

  const root = new THREE.Group();
  scene.add(root);

  const morphMeshes: THREE.Mesh[] = [];
  let proceduralMouth: THREE.Mesh | null = null;
  let modelReady = false;

  function frameCameraOnRoot(padding = 1.4): void {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const distV = (size.y / 2) / Math.tan(vFov / 2);
    const distH = (size.x / 2) / Math.tan(hFov / 2);
    const dist = Math.max(distV, distH) * padding;
    camera.position.set(center.x, center.y, center.z + dist);
    camera.near = Math.max(dist / 100, 0.01);
    camera.far = dist * 100;
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  }

  function resize(w: number, h: number): void {
    if (w < 1 || h < 1) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    if (modelReady) frameCameraOnRoot();
  }

  const resizeObserver = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect;
    if (!rect) return;
    resize(Math.round(rect.width), Math.round(rect.height));
  });
  resizeObserver.observe(opts.container);

  const initialW = opts.container.clientWidth;
  const initialH = opts.container.clientHeight;
  if (initialW > 0 && initialH > 0) {
    resize(initialW, initialH);
  }

  function collectMorphs(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh && child.morphTargetDictionary && child.morphTargetInfluences) {
        morphMeshes.push(child);
      }
    });
  }

  function placeModel(model: THREE.Object3D): void {
    root.clear();
    morphMeshes.length = 0;
    proceduralMouth = null;

    const wrapper = new THREE.Group();
    wrapper.add(model);

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    wrapper.scale.setScalar(1.75 / maxDim);
    root.add(wrapper);
    collectMorphs(model);
    modelReady = true;
    frameCameraOnRoot();
  }

  function addProceduralAvatar(color: string): void {
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.65 });

    const avatar = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.7, 8, 16), bodyMat);
    body.position.y = 0.85;
    avatar.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 24), skinMat);
    head.position.y = 1.55;
    avatar.add(head);

    const mouth = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0x8b4545 }),
    );
    mouth.position.set(0, 1.42, 0.34);
    mouth.scale.set(1.2, 0.35, 0.5);
    avatar.add(mouth);
    proceduralMouth = mouth;

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const eyeGeo = new THREE.SphereGeometry(0.045, 12, 12);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.12, 1.62, 0.3);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.12;
    avatar.add(eyeL, eyeR);

    placeModel(avatar);
  }

  function loadModel(url: string): void {
    const loader = new GLTFLoader();
    loader.setDRACOLoader(getDracoLoader());
    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        model.traverse((c) => {
          if (c instanceof THREE.Mesh) c.castShadow = true;
        });
        placeModel(model);
        opts.onModelLoaded?.();
      },
      undefined,
      () => {
        if (!modelReady) addProceduralAvatar(opts.primaryColor);
        opts.onModelLoaded?.();
      },
    );
  }

  if (opts.modelUrl) {
    addProceduralAvatar(opts.primaryColor);
    loadModel(opts.modelUrl);
  } else {
    addProceduralAvatar(opts.primaryColor);
    opts.onModelLoaded?.();
  }

  let state: AvatarState = opts.controller.getState();
  let mouthTarget = 0;
  let mouthCurrent = 0;
  let bobPhase = 0;

  const offState = opts.controller.onState((s) => {
    state = s;
  });
  const offLip = opts.controller.onLipSync((v) => {
    mouthTarget = v;
  });

  function setMorph(name: string, value: number): void {
    for (const mesh of morphMeshes) {
      const dict = mesh.morphTargetDictionary;
      const inf = mesh.morphTargetInfluences;
      if (!dict || !inf) continue;
      const idx = dict[name];
      if (idx !== undefined) inf[idx] = value;
    }
  }

  function applyMouth(open: number): void {
    if (proceduralMouth) {
      proceduralMouth.scale.y = 0.35 + open * 0.85;
      proceduralMouth.position.y = 1.42 - open * 0.04;
    }
    for (const key of MORPH_KEYS) {
      if (key === 'mouthSmile') continue;
      setMorph(key, open * (key.includes('viseme') ? 0.55 : 0.75));
    }
  }

  let raf = 0;
  const clock = new THREE.Clock();

  function animate(): void {
    raf = requestAnimationFrame(animate);
    const dt = clock.getDelta();
    bobPhase += dt;

    mouthCurrent = mouthCurrent * 0.7 + mouthTarget * 0.3;
    if (state === 'speaking') {
      applyMouth(mouthCurrent);
      root.rotation.y = Math.sin(bobPhase * 2.5) * 0.04;
      root.position.y = Math.sin(bobPhase * 8) * 0.015;
    } else {
      applyMouth(mouthCurrent * 0.3);
      root.position.y = 0;
      if (state === 'thinking') {
        root.rotation.y = Math.sin(bobPhase * 1.2) * 0.08;
        root.rotation.x = -0.06 + Math.sin(bobPhase * 2) * 0.03;
      } else if (state === 'listening') {
        root.rotation.y = Math.sin(bobPhase * 0.8) * 0.05;
        root.rotation.z = Math.sin(bobPhase * 1.5) * 0.02;
      } else {
        root.rotation.y = Math.sin(bobPhase * 0.5) * 0.03;
        root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, 0, 0.05);
        root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, 0, 0.05);
      }
    }

    renderer.render(scene, camera);
  }
  animate();

  return {
    destroy: () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      offState();
      offLip();
      renderer.dispose();
      canvas.remove();
    },
  };
}
