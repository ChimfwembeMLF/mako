export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(el);
  });
}

export function loadAvatarChunk(widgetBase: string, name: 'avatar-3d' | 'ar-view'): Promise<void> {
  const key = name === 'avatar-3d' ? 'AutopilotAvatar3d' : 'AutopilotArView';
  if ((window as unknown as Record<string, unknown>)[key]) {
    return Promise.resolve();
  }
  return loadScript(`${widgetBase}/${name}.js`);
}
