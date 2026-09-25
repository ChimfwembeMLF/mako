import { TourConfig } from "@/services/tour.service";

export const mediaLibraryTourConfig: TourConfig = {
  id: 'media_library',
  steps: [
    {
      element: '#tour-ml-header',
      popover: {
        title: 'Media Library',
        description: 'Manage all your brand assets here. They are stored securely in the cloud and accessible across your workspace.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '#tour-ml-upload',
      popover: {
        title: 'Upload Assets',
        description: 'Click here to upload images and videos. You can select multiple files at once.',
        side: 'bottom',
        align: 'end',
      },
    },
    {
      element: '#tour-ml-search',
      popover: {
        title: 'Search',
        description: 'Quickly find specific assets by typing their name or type (e.g. image, video).',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '#tour-ml-grid',
      popover: {
        title: 'Asset Grid',
        description: 'View all your uploaded media. Hover over an asset to delete it if you have the right permissions.',
        side: 'top',
        align: 'center',
      },
    },
  ],
};
