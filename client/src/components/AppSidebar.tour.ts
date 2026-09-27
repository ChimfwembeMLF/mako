import { TourConfig } from '@/services/tour.service';

export const appSidebarTourConfig: TourConfig = {
  steps: [
    {
      element: '#tour-dashboard-nav',
      popover: {
        title: 'Main Navigation',
        description: 'Welcome to Mako! This sidebar is your central command center for everything marketing. Let\'s do a quick fly-by of all the sections.',
        side: 'right',
        align: 'start',
      },
    },
    // Core Tools
    {
      element: '#tour-nav-dashboard',
      popover: { title: 'Main Dashboard', description: 'Get a high-level overview of your entire workspace, recent activities, and system alerts.', side: 'right' },
    },
    {
      element: '#tour-nav-social',
      popover: { title: 'Social Dashboard', description: 'Your unified command center for all connected social media accounts and quick performance metrics.', side: 'right' },
    },
    {
      element: '#tour-nav-brand-brain',
      popover: { title: 'Brand Brain', description: 'Train our AI on your unique brand voice, style guidelines, and company knowledge.', side: 'right' },
    },
    {
      element: '#tour-nav-content',
      popover: { title: 'Content Engine', description: 'Use AI to generate, refine, and preview multi-platform posts in seconds.', side: 'right' },
    },
    {
      element: '#tour-nav-campaigns',
      popover: { title: 'Campaigns', description: 'Plan and execute large-scale, multi-channel marketing campaigns.', side: 'right' },
    },
    {
      element: '#tour-nav-scheduler',
      popover: { title: 'Scheduler', description: 'View your content calendar and schedule posts for automated publishing.', side: 'right' },
    },
    {
      element: '#tour-nav-publisher',
      popover: { title: 'Connections', description: 'Connect and authenticate your social media profiles and advertising accounts.', side: 'right' },
    },
    // Engagement
    {
      element: '#tour-nav-leads',
      popover: { title: 'Leads', description: 'Track incoming leads, view their status, and manage your pipeline.', side: 'right' },
    },
    {
      element: '#tour-nav-email',
      popover: { title: 'Email', description: 'Manage outbound email campaigns and newsletters.', side: 'right' },
    },
    {
      element: '#tour-nav-whatsapp',
      popover: { title: 'WhatsApp', description: 'Send and receive WhatsApp business messages directly from Mako.', side: 'right' },
    },
    {
      element: '#tour-nav-inbox',
      popover: { title: 'Social Inbox', description: 'A unified inbox to read and reply to comments and messages across all connected social platforms.', side: 'right' },
    },
    {
      element: '#tour-nav-analytics',
      popover: { title: 'Analytics', description: 'Deep dive into your performance metrics, engagement rates, and follower growth.', side: 'right' },
    },
    // Assets
    {
      element: '#tour-nav-media',
      popover: { title: 'Media Library', description: 'Store, organize, and generate images/videos. Integrates directly with Google Drive.', side: 'right' },
    },
    {
      element: '#tour-nav-templates',
      popover: { title: 'Post Templates', description: 'Save successful post formats and designs for quick reuse later.', side: 'right' },
    },
    {
      element: '#tour-nav-ads',
      popover: { title: 'Ads', description: 'Launch, manage, and monitor paid advertising campaigns (like Google Ads).', side: 'right' },
    },
    {
      element: '#tour-nav-workspaces',
      popover: { title: 'Workspaces', description: 'Switch between different client workspaces or team environments.', side: 'right' },
    },
    // Governance
    {
      element: '#tour-nav-approvals',
      popover: { title: 'Approvals', description: 'Review, approve, or reject content drafted by your team before it goes live.', side: 'right' },
    },
    {
      element: '#tour-nav-team',
      popover: { title: 'Team', description: 'Invite team members, assign roles, and manage access levels.', side: 'right' },
    },
    {
      element: '#tour-nav-audit',
      popover: { title: 'Audit Logs', description: 'View a complete, immutable history of all actions taken within this workspace.', side: 'right' },
    },
    // System Admin (Skipped in tour for normal users if they don't see it, but driver handles missing elements gracefully)
    {
      element: '#tour-nav-roles',
      popover: { title: 'Roles & Permissions', description: 'Configure granular access controls and define custom roles.', side: 'right' },
    },
    {
      element: '#tour-nav-maker-checker',
      popover: { title: 'Maker-Checker', description: 'Enforce strict approval workflows by requiring secondary authorization for key actions.', side: 'right' },
    },
  ],
  driverConfig: {
    animate: true,
    smoothScroll: true,
    showProgress: true,
    allowClose: true,
    stagePadding: 5,
  }
};
