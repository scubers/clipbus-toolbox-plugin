import { createTopic } from '../internal/topic.js';
import { callHostSync } from '../internal/bridges.js';
import type { PluginThemeTokenSnapshot } from '../../runtime/types/data.js';
import type { Unsubscribe } from '../../internal/shapes.js';

const DEFAULT_THEME: PluginThemeTokenSnapshot = { scheme: 'light', tokens: {} };

const _themeTopic = createTopic<PluginThemeTokenSnapshot>(DEFAULT_THEME);

// Listen to theme-updated events
if (typeof window !== 'undefined') {
  window.addEventListener('pasty-plugin-theme-updated', (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail?.tokenSnapshot) {
      _themeTopic.set({
        scheme: detail.scheme ?? 'light',
        tokens: detail.tokenSnapshot,
      });
    }
  });
}

export async function refreshTheme(): Promise<PluginThemeTokenSnapshot> {
  const result = await callHostSync<PluginThemeTokenSnapshot>('getThemeSnapshot', {});
  if (result) {
    _themeTopic.set(result);
    return result;
  }
  return _themeTopic.current();
}

export const themeModule = {
  current: () => _themeTopic.current(),
  on: (listener: (v: PluginThemeTokenSnapshot) => void): Unsubscribe => _themeTopic.on(listener),
  refresh: refreshTheme,
};
