import { confirmModal } from "@/components/ConfirmModal";
import { driver, DriveStep, Config } from 'driver.js';
import 'driver.js/dist/driver.css';
import { usersApi } from '@/lib/api';

export interface TourConfig {
  id: string; // e.g. 'dashboard', 'content_engine'
  steps: DriveStep[];
  driverConfig?: Partial<Config>;
}

export class TourService {
  private static activeTourId: string | null = null;

  /**
   * Starts a tour if it hasn't been completed yet.
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
