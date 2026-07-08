import { WidgetApi } from './api';
import { mountWidget } from './widget';

const VISITOR_KEY = 'ap_visitor';

function getScript(): HTMLScriptElement | null {
  const current = document.currentScript;
  if (current instanceof HTMLScriptElement) return current;
  return document.querySelector('script[data-key]');
}

function getVisitorId(): string {
  try {
    const stored = localStorage.getItem(VISITOR_KEY);
    if (stored) return stored;
    const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

async function init() {
  const script = getScript();
  if (!script) return;

  const apiKey = script.getAttribute('data-key');
  if (!apiKey || apiKey.includes('YOUR_KEY')) {
    console.warn('[Mako] Widget: invalid data-key');
    return;
  }

  const apiBase =
    script.getAttribute('data-api')?.replace(/\/$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  const position = script.getAttribute('data-position') || 'bottom-right';
  const widgetBase = script.src.replace(/\/[^/]*$/, '');
  const api = new WidgetApi(apiBase, apiKey);

  try {
    const config = await api.getConfig();
    const visitorId = getVisitorId();
    const session = await api.createSession(visitorId);

    const host = document.createElement('div');
    host.id = 'autopilot-widget-root';
    document.body.appendChild(host);

    mountWidget({
      api,
      config,
      sessionId: session.sessionId,
      visitorId: session.visitorId || visitorId,
      welcomeMessageId: session.welcomeMessageId,
      widgetBase,
      host,
      position,
    });
  } catch (err) {
    console.error('[Mako] Widget failed to load', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void init());
} else {
  void init();
}
