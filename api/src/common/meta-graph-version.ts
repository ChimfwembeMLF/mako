/**
 * The one Meta Graph API version used for Facebook, Instagram (via Facebook) and WhatsApp
 * calls. Meta retires each version about two years after release and then silently
 * upgrades calls, so keep this on a supported version and change it in one place.
 * Override with META_GRAPH_API_VERSION (e.g. "v25.0") without a code change.
 */
export const META_GRAPH_VERSION =
  process.env.META_GRAPH_API_VERSION?.trim().replace(/^(\d)/, 'v$1') || 'v24.0';
