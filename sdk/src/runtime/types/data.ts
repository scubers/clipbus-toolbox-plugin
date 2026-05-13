export interface ClipboardItem {
  id: string;
  type: string;
  tags: string[];
  sourceAppID: string;
  createdAt?: string;
  pinnedAt?: string | null;
}

export interface AttachmentPayload {
  rendererID: string;
  attachmentType: string;
  attachmentKey: string;
  payloadJson: string;
  item: ClipboardItem;
  buttons: Array<{ id: string; title: string; systemImage?: string; tintHex?: string }>;
}

export interface Draft {
  [key: string]: unknown;
}

export interface ActionButton {
  id: string;
  title: string;
  systemImage?: string;
  tintHex?: string;
}

export interface ActionDescriptor {
  id: string;
  actionID: string;
  title: string;
  lifecycle: 'auto-run' | 'draft';
  supportedItemTypes: string[];
  keywords: string[];
  uiEntry: string | null;
  buttons: ActionButton[];
}

export interface ActionSession {
  pluginID: string;
  actionID: string;
  displayName: string | null;
  item: ClipboardItem;
  action: ActionDescriptor | null;
  draft: Draft;
  buttons: ActionButton[];
  defaultButtonID: string | null;
}

export interface PluginThemeTokenSnapshot {
  scheme: 'light' | 'dark';
  tokens: Record<string, string>;
}

export type SetAttachmentsPayload = { attachments: unknown[] };
export type SetSearchExtensionPayload = { scope: string; terms: string[] };
