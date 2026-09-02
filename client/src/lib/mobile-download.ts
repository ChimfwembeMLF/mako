/** Public URL for the Android APK download (same-origin or CDN). */
export const MOBILE_APK_URL =
  (import.meta.env.VITE_MOBILE_APK_URL as string | undefined)?.trim() || '/downloads/mako.apk';

export const MOBILE_APK_VERSION =
  (import.meta.env.VITE_MOBILE_APK_VERSION as string | undefined)?.trim() || '1.0.0';
