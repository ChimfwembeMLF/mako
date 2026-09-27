import { TourConfig } from '@/services/tour.service';

export const schedulerTourConfig: TourConfig = {
  id: 'scheduler',
  steps: [
    {
      element: '#tour-scheduler-welcome',
      popover: {
        title: 'Scheduler',
        description: 'Welcome to the Scheduler! This is where you can view, edit, and manage all your upcoming social media posts in a calendar view.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '#tour-scheduler-calendar',
      popover: {
        title: 'Calendar View',
        description: 'Your posts are organized here by day and platform. You can see what is coming up and identify any gaps in your content strategy.',
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '#tour-scheduler-create',
      popover: {
        title: 'Create & Edit',
        description: 'Click on any empty slot or the New Post button to create content for a specific day, or click an existing post to review and edit it.',
        side: 'left',
        align: 'start',
      },
    }
  ]
};
