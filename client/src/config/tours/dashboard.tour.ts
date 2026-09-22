import { TourConfig } from '@/services/tour.service';

export const dashboardTourConfig: TourConfig = {
  id: 'dashboard',
  steps: [
    {
      element: '#tour-dashboard-welcome',
      popover: {
        title: 'Welcome to Mako!',
        description: 'Let us show you around your new dashboard.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '#tour-dashboard-nav',
      popover: {
        title: 'Navigation',
        description: 'Use the sidebar to navigate between your Brand Brain, Content Engine, and Settings.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '#tour-dashboard-stats',
      popover: {
        title: 'Quick Stats',
        description: "Get a quick overview of your brand's performance and content generation metrics here.",
        side: 'bottom',
        align: 'center',
      },
    }
  ]
};
