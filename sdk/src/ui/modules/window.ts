import { postMessage } from '../internal/bridges.js';

function getRendererID(): string {
  return (window as any).__PASTY_PLUGIN_BOOTSTRAP__?.rendererID ?? '';
}

export function setHeight(px: number): void {
  const rendererID = getRendererID();
  postMessage('pastyPluginSetHeight', { rendererID, height: typeof px === 'number' ? px : 0 });
}

export interface AutoFitOptions {
  min?: number;
  max?: number;
  target?: Element;
}

export function autoFit({ min = 0, max = Infinity, target }: AutoFitOptions = {}): () => void {
  const effectiveMax = max === Infinity ? 800 : max;
  const effectiveTarget = target ?? document.body;
  let lastReported = -1;

  function measure(): void {
    const h = Math.max(min, Math.min(effectiveMax, effectiveTarget.scrollHeight));
    if (h === lastReported) return;
    lastReported = h;
    setHeight(h);
  }

  const ro = new ResizeObserver(measure);
  ro.observe(effectiveTarget);

  let mo: MutationObserver | null = null;
  if (typeof MutationObserver === 'function') {
    mo = new MutationObserver(measure);
    mo.observe(effectiveTarget, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
  }

  return () => {
    ro.disconnect();
    if (mo) mo.disconnect();
  };
}

export const windowModule = {
  setHeight,
  autoFit,
};
