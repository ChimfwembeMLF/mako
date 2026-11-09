# Product screenshots for the landing page

WebP captures used by `LandingPage.tsx`. `ScreenshotFrame` shows each one inside a device
frame (`react-device-frameset`, see `components/landing/DeviceMockup.tsx`). If a file fails
to load, a drawn UI mock is shown instead.

| File | Device | Section |
|------|--------|---------|
| `mako-dashboard-desktop.webp` | Laptop | Hero backdrop, FAQ |
| `mako-brand-brain-tablet.webp` | Tablet | Brand Brain step |
| `mako-content-engine-desktop.webp` | Laptop | Content Engine step, FAQ |
| `mako-publishing-desktop.webp` | Laptop | Publishing step, FAQ |
| `mako-scheduler.webp` | Tablet | Scheduler step, FAQ |
| `mako-analytics-desktop.webp` | Laptop | Analytics step |
| `mako-inbox-phone.webp` | Phone | Inbox step |

Captured from the local app as the demo owner (`owner@brandpilot.test`) with fictional demo
content, never from a real customer workspace.

Capture each at its frame's screen shape, at 2× — the frames crop anything else:

- Laptop: 1440×900 viewport (16:10)
- Tablet: 1024×768 viewport (4:3 landscape). Portrait tablet widths currently squeeze the app's layout.
- Phone: 390×801 viewport (the Galaxy Note 8 frame's 400×822 screen)
