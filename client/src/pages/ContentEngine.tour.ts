import { TourConfig } from '@/services/tour.service';

export const contentEngineTourConfig: TourConfig = {
  id: 'content_engine',
  steps: [
    {
      element: '#tour-ce-header',
      popover: {
        title: 'Posts',
        description: 'Welcome to the Posts! Here you can automatically generate and schedule your marketing content.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '#tour-ce-controls',
      popover: {
        title: 'Start a post',
        description: 'Write a post yourself, or give Mako a theme and it drafts one in your Brand voice.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '#tour-ce-results',
      popover: {
        title: 'All your posts',
        description: 'Every post lives here. Filter by status, then publish, edit or repurpose it from its row.',
        side: 'top',
        align: 'center',
      },
    }
  ]
};
