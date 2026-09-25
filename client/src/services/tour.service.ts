import { confirmModal } from "@/components/ConfirmModal";
import { driver, DriveStep, Config } from 'driver.js';
import 'driver.js/dist/driver.css';
import { usersApi, authApi } from '@/lib/api';

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

  /**
   * Automatically starts a tour if the user hasn't completed it.
   */
  static async autoStartTour(
    tourId: string,
    steps: DriveStep[],
    onComplete?: () => void,
    driverConfig?: Partial<Config>
  ) {
    try {
      const user = await authApi.getMe();
      if (user?.preferences?.tours?.[tourId]?.completed) {
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
          tourDriver.destroy();
          this.activeTourId = null;
          this.markTourCompleted(tourId).then(() => {
            if (onComplete) onComplete();
          });
          return;
        }

        const confirmed = await confirmModal("Are you sure you want to skip the rest of the tour?");
        if (confirmed) {
          tourDriver.destroy();
          this.activeTourId = null;
          // Mark as completed regardless of skip or finish
          this.markTourCompleted(tourId).then(() => {
            if (onComplete) onComplete();
          });
        }
      },
    });

    tourDriver.setSteps(steps);
    tourDriver.drive();
  }

  private static async markTourCompleted(tourId: string) {
    try {
      await usersApi.updatePreferences({
        tours: {
          [tourId]: {
            completed: true,
            completedAt: new Date().toISOString()
          }
        }
      });
    } catch (e) {
      console.error(`Failed to mark tour ${tourId} as completed`, e);
    }
  }
}
