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
        description: 'Upload images and videos here, or drag files anywhere onto the page. You can add several at once.',
        side: 'bottom',
        align: 'end',
      },
    },
    {
      element: '#tour-ml-search',
      popover: {
        title: 'Search',
        description: 'Find a file by name. Use the Images and Videos filters and the sort menu to narrow things down.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '#tour-ml-grid',
      popover: {
        title: 'Asset Grid',
        description: 'Click a file to preview it, copy its link or delete it. Tick the circle on several files to delete them together.',
        side: 'top',
        align: 'center',
      },
    },
  ],
};
