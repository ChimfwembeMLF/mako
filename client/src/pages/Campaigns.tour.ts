import { TourConfig } from '@/services/tour.service';

export const campaignsTourConfig: TourConfig = {
  id: 'campaigns',
  steps: [
    {
      element: '#tour-campaign-welcome',
      popover: {
        title: 'AI Campaigns',
        description: 'Generate a full multi-day content series from one theme. Let AI plan your posts across days and platforms.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '#tour-campaign-generator',
      popover: {
        title: 'Campaign Generator',
        description: 'Fill in the details for your campaign here. AI will use your Brand Brain to automatically generate a schedule of posts based on your goals.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '#tour-campaign-list',
      popover: {
        title: 'Your Campaigns',
        description: 'Once generated, your campaigns will appear here. You can expand them to see the scheduled posts and review them in the Scheduler.',
        side: 'left',
        align: 'start',
      },
    }
  ]
};
