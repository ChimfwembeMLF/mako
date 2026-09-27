import { TourConfig } from '@/services/tour.service';

export const publisherConnectTourConfig: TourConfig = {
  id: 'connections',
  steps: [
    {
      element: '#tour-connections-welcome',
      popover: {
        title: 'Platform Connections',
        description: 'Connect your social media accounts and publishing platforms here. Mako will use these connections to publish your content automatically.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '#tour-connections-list',
      popover: {
        title: 'Manage Connections',
        description: 'Click Connect on any platform to authorize Mako. Once connected, you can review the connection status and disconnect if needed.',
        side: 'right',
        align: 'start',
      },
    }
  ]
};
