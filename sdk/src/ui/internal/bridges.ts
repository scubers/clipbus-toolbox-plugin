type MessageHandlerName =
  | 'pastyPluginAction'
  | 'pastyPluginActionDraft'
  | 'pastyPluginActionRun'
  | 'pastyPluginHostSync'
  | 'pastyPluginSetHeight'
  | 'pastyPluginConsole'
  | 'pastyTextInputState';

function getHandler(name: MessageHandlerName): any {
  return (window as any).webkit?.messageHandlers?.[name];
}

export function postMessage(name: MessageHandlerName, payload: unknown): void {
  const handler = getHandler(name);
  if (!handler) {
    console.warn(`[pasty-sdk] messageHandler ${name} unavailable (dev mode?)`);
    return;
  }
  handler.postMessage(typeof payload === 'string' ? payload : JSON.stringify(payload));
}

export async function callHostSync<T>(method: string, payload: unknown = {}): Promise<T | null> {
  const handler = getHandler('pastyPluginHostSync');
  if (!handler) return null;
  try {
    const raw = await handler.postMessage(JSON.stringify({ method, payloadJson: JSON.stringify(payload) }));
    if (raw == null) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw as T;
  } catch {
    return null;
  }
}
