// Listen to focus/composition events and post to pastyTextInputState handler. Called once at module load.
let _patched = false;

export function patchTextInputState(): void {
  if (_patched || typeof window === 'undefined') return;
  _patched = true;

  function post(active: boolean): void {
    const h = (window as any).webkit?.messageHandlers?.pastyTextInputState;
    if (h) {
      try {
        h.postMessage(JSON.stringify({ textInputActive: active }));
      } catch { /* ignore */ }
    }
  }

  document.addEventListener('focusin', () => post(true));
  document.addEventListener('focusout', () => post(false));
  document.addEventListener('compositionstart', () => post(true));
  document.addEventListener('compositionend', () => post(false));
}
