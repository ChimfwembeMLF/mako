import { confirmModal } from "@/components/ConfirmModal";
import { driver, DriveStep, Config } from 'driver.js';
import 'driver.js/dist/driver.css';
import { usersApi, authApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

export interface TourCompletionState {
  completed: boolean;
  completedAt: string;
}

export interface TourConfig {
  id: string; // e.g. 'dashboard', 'content_engine'
  steps: DriveStep[];
  driverConfig?: Partial<Config>;
}

export class TourService {
  private static activeTourId: string | null = null;
  private static completedToursLocalCache: Set<string> = new Set();

  /**
   * Automatically starts a tour if the user hasn't completed it.
   */
  static async autoStartTour(
    tourId: string,
    steps: DriveStep[],
    onComplete?: () => void,
    driverConfig?: Partial<Config>
  ) {
    if (this.completedToursLocalCache.has(tourId)) {
      return;
    }

    try {
      // Add a timestamp cache buster to ensure we don't get a browser-cached response
      const user = await authApi.getMe().catch(() => null);
      if (user?.preferences?.tours?.[tourId]?.completed) {
        this.completedToursLocalCache.add(tourId);
        return;
      }
      this.startTour(tourId, steps, onComplete, driverConfig);
    } catch (e) {
      console.error('Failed to check tour preferences for auto-start', e);
    }
  }

  /**
   * Starts a tour unconditionally.
   */
  static async startTour(
    tourId: string,
    steps: DriveStep[],
    onComplete?: () => void,
    driverConfig?: Partial<Config>
  ) {
    if (this.activeTourId === tourId) return;
    this.activeTourId = tourId;

    const tourDriver = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      doneBtnText: 'Finish',
      nextBtnText: 'Next',
      prevBtnText: 'Previous',
      ...driverConfig,
      onHighlightStarted: (el, step, options) => {
        if (driverConfig?.onHighlightStarted) {
          driverConfig.onHighlightStarted(el, step, options);
        }
        if (!el && typeof step?.element === 'string') {
          const selector = step.element;
          let attempts = 0;
          const interval = setInterval(() => {
            attempts++;
            if (document.querySelector(selector)) {
              clearInterval(interval);
              const activeIndex = tourDriver.getActiveIndex();
              if (activeIndex !== undefined) tourDriver.drive(activeIndex);
            } else if (attempts >= 30) {
              clearInterval(interval);
            }
          }, 100);
        }
      },
      onDestroyStarted: async () => {
        const hasNext = tourDriver.hasNextStep();
        if (!hasNext) {
          // Last step — finish normally
          tourDriver.destroy();
          this.activeTourId = null;
          this.markTourCompleted(tourId).then(() => {
            if (onComplete) onComplete();
          });
          return;
        }

        // Save current step index BEFORE destroying
        const currentIndex = tourDriver.getActiveIndex() ?? 0;

        // Destroy tour first — this removes driver.js's overlay so our
        // dialog's pointer events are no longer blocked.
        tourDriver.destroy();
        this.activeTourId = null;

        const confirmed = await confirmModal("Are you sure you want to skip the rest of the tour?");
        if (confirmed) {
          this.markTourCompleted(tourId).then(() => {
            if (onComplete) onComplete();
          });
        } else {
          // User wants to stay — relaunch from the same step
          this._launchDriver(tourId, steps, currentIndex, onComplete, driverConfig);
        }
      },
    });

    tourDriver.setSteps(steps);
    tourDriver.drive();
  }

  /**
   * Internal helper to launch a driver instance starting at a specific step.
   */
  private static _launchDriver(
    tourId: string,
    steps: DriveStep[],
    startIndex: number,
    onComplete?: () => void,
    driverConfig?: Partial<Config>
  ) {
    if (this.activeTourId === tourId) return;
    this.activeTourId = tourId;

    const d = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      doneBtnText: 'Finish',
      nextBtnText: 'Next',
      prevBtnText: 'Previous',
      ...driverConfig,
      onDestroyStarted: async () => {
        const hasNext = d.hasNextStep();
        if (!hasNext) {
          d.destroy();
          this.activeTourId = null;
          this.markTourCompleted(tourId).then(() => { if (onComplete) onComplete(); });
          return;
        }
        const idx = d.getActiveIndex() ?? 0;
        d.destroy();
        this.activeTourId = null;
        const confirmed = await confirmModal("Are you sure you want to skip the rest of the tour?");
        if (confirmed) {
          this.markTourCompleted(tourId).then(() => { if (onComplete) onComplete(); });
        } else {
          this._launchDriver(tourId, steps, idx, onComplete, driverConfig);
        }
      },
    });

    d.setSteps(steps);
    d.drive(startIndex);
  }

  private static async markTourCompleted(tourId: string) {
    this.completedToursLocalCache.add(tourId);
    try {
      await usersApi.updatePreferences({
        tours: {
          [tourId]: {
            completed: true,
            completedAt: new Date().toISOString()
          }
        }
      });
      toast({
        title: '✅ Tour complete!',
        description: "You won't see this guide again. You can re-run tours from Settings.",
        duration: 4000,
      });
    } catch (e) {
      console.error(`Failed to mark tour ${tourId} as completed`, e);
      toast({
        title: 'Tour progress not saved',
        description: 'There was a problem saving your progress. The tour may reappear next visit.',
        variant: 'destructive',
        duration: 5000,
      });
    }
  }
}
