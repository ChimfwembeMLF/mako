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
  const width = Math.max(opts.container.clientWidth || 72, 72);
  const height = Math.max(opts.container.clientHeight || 72, 72);
  const compact = width <= 80 && height <= 80;

  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.borderRadius = compact ? '50%' : '0';
  if (compact) {
    canvas.style.background = 'rgba(255,255,255,0.15)';
  }
  opts.container.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: !compact,
    powerPreference: compact ? 'low-power' : 'default',
  });
  renderer.setPixelRatio(compact ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  const aspect = width / height;
  const camera = new THREE.PerspectiveCamera(compact ? 35 : 28, aspect, 0.1, 100);
  camera.position.set(0, 1.45, compact ? 2.8 : 3.4);
  camera.lookAt(0, compact ? 1.2 : 1.0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
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
  let loaded = false;

  function addProceduralAvatar(color: string): void {
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });
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
    proceduralMouth = mouth;

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const eyeGeo = new THREE.SphereGeometry(0.045, 12, 12);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.12, 1.62, 0.3);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.12;
    root.add(eyeL, eyeR);
    loaded = true;
  }

  function collectMorphs(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh && child.morphTargetDictionary && child.morphTargetInfluences) {
        morphMeshes.push(child);
      }
    });
  }

  function loadModel(url: string): void {
    const loader = new GLTFLoader();
    loader.setDRACOLoader(getDracoLoader());
    loader.load(
      url,
      (gltf) => {
        root.clear();
        morphMeshes.length = 0;
        proceduralMouth = null;
        const model = gltf.scene;
        model.traverse((c) => {
          if (c instanceof THREE.Mesh) c.castShadow = true;
        });
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 1.6 / maxDim;
        model.scale.setScalar(scale);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center.multiplyScalar(scale));
        model.position.y += 0.1;
        root.add(model);
        collectMorphs(model);
        loaded = true;
        opts.onModelLoaded?.();
      },
      undefined,
      () => {
        if (!loaded) opts.onModelLoaded?.();
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
      offState();
      offLip();
      renderer.dispose();
      canvas.remove();
    },
  };
}
