import { TourConfig } from "@/services/tour.service";

export const brandBrainTourConfig: TourConfig = {
  id: 'brand_brain',
  steps: [
    {
      element: '#tour-bb-header',
      popover: {
        title: 'Welcome to Brand Brain',
        description: 'Brand Brain is your central hub for defining your company identity, voice, and guardrails so the AI can sound exactly like you.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '#tour-bb-autofill',
      popover: {
        title: 'Auto-fill Data',
        description: 'Jumpstart your setup by pasting your website URL or uploading an existing brand document (like a PDF). We will automatically extract key information.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '#tour-bb-tabs',
      popover: {
        title: 'Define the Details',
        description: 'Navigate through these tabs to specify your audience, fine-tune your tone of voice, add current offers, and set negative guardrails (banned words/topics).',
        side: 'top',
        align: 'start',
      },
    },
  ],
};
