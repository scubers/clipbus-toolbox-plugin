import { createTopic, createOptionalTopic, createStream } from '../internal/topic.js';
import { postMessage, callHostSync } from '../internal/bridges.js';
import type { ClipboardItem, AttachmentPayload, SetAttachmentsPayload, SetSearchExtensionPayload } from '../../runtime/types/data.js';
import type { Unsubscribe } from '../../internal/shapes.js';

// --- Topics ---
const _itemTopic = createTopic<ClipboardItem>({ id: '', type: 'text', tags: [], sourceAppID: '' });
const _attachmentTopic = createOptionalTopic<AttachmentPayload>();
const _searchTopic = createOptionalTopic<string[]>();

// onHostInvoke Stream
const _hostInvokeStream = createStream<{ actionID: string; [key: string]: unknown }>();

// Bootstrap initialization
export function initFromBootstrap(bootstrap: any): void {
  if (!bootstrap) return;
  if (bootstrap.item) _itemTopic.set(bootstrap.item);
  if (bootstrap.attachment) {
    _attachmentTopic.activate();
    _attachmentTopic.set(bootstrap.attachment);
  }
}

// Event listeners
if (typeof window !== 'undefined') {
  window.addEventListener('pasty-plugin-attachment-updated', (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail?.item) _itemTopic.set(detail.item);
    if (detail?.attachment != null) {
      _attachmentTopic.activate();
      _attachmentTopic.set(detail.attachment);
    }
  });

  window.addEventListener('pasty-plugin-search-updated', (event: Event) => {
    const detail = (event as CustomEvent).detail;
    const terms = Array.isArray(detail?.searchTerms) ? detail.searchTerms : [];
    _searchTopic.set(terms);
  });

  window.addEventListener('pasty-plugin-renderer-action', (event: Event) => {
    const detail = (event as CustomEvent).detail ?? {};
    _hostInvokeStream.emit(detail);
  });
}

// --- Verbs ---
function createTagMutationVerb(method: string) {
  return async (tags: string[]): Promise<string[]> => {
    const result = await callHostSync<{ tags: string[] }>(method, { tags });
    return result?.tags ?? tags;
  };
}

export const setTags = createTagMutationVerb('setTags');
export const addTags = createTagMutationVerb('addTags');
export const removeTags = createTagMutationVerb('removeTags');

export async function setPinned(pinned: boolean): Promise<void> {
  await callHostSync('setPinned', { pinned });
}

export async function setAttachments(payload: SetAttachmentsPayload): Promise<void> {
  await callHostSync('setAttachments', payload);
}

export async function setSearchExtension(payload: SetSearchExtensionPayload): Promise<void> {
  await callHostSync('setSearchExtension', payload);
}

export function invokeAttachmentAction(buttonID: string, params: Record<string, unknown> = {}): void {
  postMessage('pastyPluginAction', { actionID: buttonID, params });
}

export const itemModule = {
  current: () => _itemTopic.current(),
  on: (listener: (v: ClipboardItem) => void): Unsubscribe => _itemTopic.on(listener),
  setTags,
  addTags,
  removeTags,
  setPinned,
  setAttachments,
  setSearchExtension,
  attachment: {
    current: () => _attachmentTopic.current(),
    on: (listener: (v: AttachmentPayload) => void): Unsubscribe => _attachmentTopic.on(listener),
    invoke: invokeAttachmentAction,
    onHostInvoke: (listener: (v: { actionID: string; [key: string]: unknown }) => void): Unsubscribe =>
      _hostInvokeStream.on(listener),
  },
  search: {
    current: () => _searchTopic.current(),
    on: (listener: (v: string[]) => void): Unsubscribe => _searchTopic.on(listener),
  },
};
