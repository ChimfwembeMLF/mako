import { TourConfig } from '@/services/tour.service';

export const contentEngineTourConfig: TourConfig = {
  id: 'content_engine',
  steps: [
    {
      element: '#tour-ce-header',
      popover: {
        title: 'Content Engine',
        description: 'Welcome to the Content Engine! Here you can automatically generate and schedule your marketing content.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '#tour-ce-controls',
      popover: {
        title: 'Generation Controls',
        description: 'Select your target networks, platforms, and provide any custom prompts or images before generating.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '#tour-ce-results',
      popover: {
        title: 'Generated Content',
        description: 'Your AI-generated content will appear here. You can edit, approve, or schedule it directly.',
        side: 'top',
        align: 'center',
      },
    }
  ]
};
