import { createOptionalTopic } from '../internal/topic.js';
import { postMessage } from '../internal/bridges.js';
import type { ActionSession, Draft } from '../../runtime/types/data.js';
import type { Unsubscribe } from '../../internal/shapes.js';

const _actionTopic = createOptionalTopic<ActionSession>();
const _draftTopic = createOptionalTopic<Draft>();

export function initActionFromBootstrap(bootstrap: any): void {
  if (!bootstrap) return;
  const session: ActionSession = {
    pluginID: bootstrap.pluginID ?? '',
    actionID: bootstrap.actionID ?? '',
    displayName: bootstrap.displayName ?? null,
    item: bootstrap.item,
    action: bootstrap.action ?? null,
    draft: bootstrap.draft ?? {},
    buttons: bootstrap.buttons ?? [],
    defaultButtonID: bootstrap.defaultButtonID ?? null,
  };
  _actionTopic.activate();
  _actionTopic.set(session);
  _draftTopic.activate();
  _draftTopic.set(session.draft);
}

// Listen for action bootstrap events
if (typeof window !== 'undefined') {
  window.addEventListener('pasty-plugin-action-bootstrap', (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail) initActionFromBootstrap(detail);
  });
}

export async function updateDraft(payload: {
  draft: Draft;
  disabledButtonIDs?: string[];
  defaultButtonID?: string | null;
}): Promise<void> {
  postMessage('pastyPluginActionDraft', {
    draft: payload.draft,
    disabledButtonIDs: payload.disabledButtonIDs ?? [],
    defaultButtonID: payload.defaultButtonID ?? null,
  });
  _draftTopic.set(payload.draft);
}

export async function invokeAction(buttonID: string, options: { draft?: Draft } = {}): Promise<void> {
  const session = _actionTopic.current();
  const buttonTitle = session?.buttons.find(b => b.id === buttonID)?.title ?? buttonID;
  postMessage('pastyPluginActionRun', {
    buttonID,
    buttonTitle,
    draft: options.draft ?? session?.draft ?? {},
  });
}

export const actionModule = {
  current: () => _actionTopic.current(),
  on: (listener: (v: ActionSession) => void): Unsubscribe => _actionTopic.on(listener),
  invoke: invokeAction,
  draft: {
    current: () => _draftTopic.current(),
    on: (listener: (v: Draft) => void): Unsubscribe => _draftTopic.on(listener),
    update: updateDraft,
  },
};
