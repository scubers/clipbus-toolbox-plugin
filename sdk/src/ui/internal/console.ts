// Patch console.log/warn/error to forward to pastyPluginConsole handler. Called once at module load.
let _patched = false;

export function patchConsole(): void {
  if (_patched) return;
  _patched = true;

  const handler = () => (window as any).webkit?.messageHandlers?.pastyPluginConsole;

  const wrap = (level: string, original: (...args: any[]) => void) => (...args: any[]) => {
    original(...args);
    const h = handler();
    if (h) {
      try {
        h.postMessage(JSON.stringify({ level, message: args.map(String).join(' ') }));
      } catch { /* ignore */ }
    }
  };

  console.log = wrap('log', console.log.bind(console));
  console.warn = wrap('warn', console.warn.bind(console));
  console.error = wrap('error', console.error.bind(console));
}
