import type { AvatarState } from './types';

type StateListener = (state: AvatarState) => void;
type LipSyncListener = (mouthOpen: number) => void;

export class AvatarController {
  private state: AvatarState = 'idle';
  private readonly stateListeners = new Set<StateListener>();
  private readonly lipListeners = new Set<LipSyncListener>();
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private connectedAudio: HTMLAudioElement | null = null;
  private rafId = 0;
  private readonly freqData = new Uint8Array(32);
  private mouthOpen = 0;

  getState(): AvatarState {
    return this.state;
  }

  setState(next: AvatarState): void {
    if (this.state === next) return;
    this.state = next;
    for (const fn of this.stateListeners) fn(next);
    if (next !== 'speaking') {
      this.mouthOpen = 0;
      this.emitLip(0);
    }
  }

  onState(fn: StateListener): () => void {
    this.stateListeners.add(fn);
    fn(this.state);
    return () => this.stateListeners.delete(fn);
  }

  onLipSync(fn: LipSyncListener): () => void {
    this.lipListeners.add(fn);
    fn(this.mouthOpen);
    return () => this.lipListeners.delete(fn);
  }

  attachAudio(audio: HTMLAudioElement): void {
    this.detachAudio();
    this.connectedAudio = audio;
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.65;
      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      this.audioContext = ctx;
      this.analyser = analyser;
      this.sourceNode = source;
      void ctx.resume();
      this.startLipLoop();
    } catch {
      /* autoplay / CORS — fall back to animated mouth without analyser */
      this.startFakeLipLoop();
    }
  }

  detachAudio(): void {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.analyser = null;
    this.sourceNode = null;
    this.connectedAudio = null;
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }
    this.mouthOpen = 0;
    this.emitLip(0);
  }

  destroy(): void {
    this.detachAudio();
    this.stateListeners.clear();
    this.lipListeners.clear();
  }

  private startLipLoop(): void {
    const tick = () => {
      if (!this.analyser) return;
      this.analyser.getByteFrequencyData(this.freqData);
      let sum = 0;
      for (let i = 0; i < this.freqData.length; i++) sum += this.freqData[i]!;
      const avg = sum / this.freqData.length / 255;
      this.mouthOpen = this.mouthOpen * 0.55 + avg * 0.45;
      this.emitLip(Math.min(1, this.mouthOpen * 2.2));
      this.rafId = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(tick);
  }

  private startFakeLipLoop(): void {
    const start = performance.now();
    const tick = () => {
      if (this.state !== 'speaking' || !this.connectedAudio || this.connectedAudio.paused) {
        this.mouthOpen = 0;
        this.emitLip(0);
        return;
      }
      const t = (performance.now() - start) / 1000;
      const v = (Math.sin(t * 14) + 1) * 0.22 + 0.08;
      this.emitLip(v);
      this.rafId = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(tick);
  }

  private emitLip(v: number): void {
    for (const fn of this.lipListeners) fn(v);
  }
}
