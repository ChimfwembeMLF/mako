/**
 * Whether the first-run welcome is being checked, is open, or is out of the way.
 * Guided tours wait for this so a new person isn't shown a tour on top of the welcome.
 */
export type OnboardingGateState = 'checking' | 'open' | 'clear';

let state: OnboardingGateState = 'clear';
const listeners = new Set<() => void>();

export const onboardingGate = {
  get: (): OnboardingGateState => state,
  set(next: OnboardingGateState) {
    if (next === state) return;
    state = next;
    listeners.forEach((fn) => fn());
  },
  /** Resolves once the check is done (or after a timeout, so a tour is never stuck). */
  settled(timeoutMs = 8000): Promise<Exclude<OnboardingGateState, 'checking'>> {
    if (state !== 'checking') return Promise.resolve(state);
    return new Promise((resolve) => {
      const done = () => {
        if (state === 'checking') return;
        listeners.delete(done);
        clearTimeout(timer);
        resolve(state as Exclude<OnboardingGateState, 'checking'>);
      };
      const timer = setTimeout(() => {
        listeners.delete(done);
        resolve('clear');
      }, timeoutMs);
      listeners.add(done);
    });
  },
};

/** Fields only a person fills in. A new workspace's starter profile has a name and a default tone, not these. */
const DESCRIBED_FIELDS = ['description', 'services', 'targetAudience', 'uniqueSellingPoints', 'audiencePainPoints'] as const;

/** True once someone has actually described the business in Brand voice. */
export function isBrandVoiceStarted(profile: Record<string, unknown> | null | undefined): boolean {
  if (!profile) return false;
  return DESCRIBED_FIELDS.some((k) => typeof profile[k] === 'string' && (profile[k] as string).trim().length > 0);
}
