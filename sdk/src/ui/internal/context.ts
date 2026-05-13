export type PluginContext = 'attachment' | 'action' | 'unknown';

export class PluginContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PluginContextError';
  }
}

let _context: PluginContext = 'unknown';

export function getContext(): PluginContext { return _context; }
export function setContext(ctx: PluginContext): void { _context = ctx; }

export function detectContext(): PluginContext {
  if (typeof window === 'undefined') return 'unknown';
  if ((window as any).__PASTY_PLUGIN_BOOTSTRAP__) return 'attachment';
  if ((window as any).__PASTY_PLUGIN_ACTION_BOOTSTRAP__) return 'action';
  return 'unknown';
}

export function withContextGuard<A extends unknown[], R>(
  requiredContext: PluginContext,
  verb: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return (...args: A): Promise<R> => {
    if (_context !== requiredContext) {
      return Promise.reject(new PluginContextError(
        `This verb is not available in the current plugin context (expected: ${requiredContext}, got: ${_context})`
      ));
    }
    return verb(...args);
  };
}
