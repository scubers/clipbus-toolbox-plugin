import type { ClipboardItem, AttachmentPayload, Draft, ActionButton, SetAttachmentsPayload, SetSearchExtensionPayload } from './data.js';

export interface HostCapabilities {
  canCopyText?: boolean;
  canOpenUrl?: boolean;
  canRevealInFinder?: boolean;
  canOpenFilePath?: boolean;
  canSetAttachment?: boolean;
  canSetTags?: boolean;
  canSetPinned?: boolean;
  canSetSearchExtension?: boolean;
  canReadExternalSettings?: boolean;
}

export interface HostClipboard {
  copyText(text: string): Promise<void>;
}

export interface HostNavigation {
  openUrl(url: string): Promise<void>;
  revealInFinder?(path: string): Promise<void>;
  openFilePath?(path: string): Promise<void>;
}

export interface HostItem {
  setTags(tags: string[]): Promise<void>;
  addTags?(tags: string[]): Promise<void>;
  removeTags?(tags: string[]): Promise<void>;
  setPinned(pinned: boolean): Promise<void>;
  setAttachments?(payload: SetAttachmentsPayload): Promise<void>;
  setSearchExtension?(payload: SetSearchExtensionPayload): Promise<void>;
  materializeImagePath(): Promise<string>;
  readAttachment(attachmentType: string, attachmentKey: string): Promise<string | null>;
}

export interface HostAction {
  allocateImageTempPath(formatHint?: string): Promise<string>;
}

export interface HostSettings {
  get(key: string): Promise<string | null | undefined>;
  getAll?(): Promise<Record<string, string>>;
}

export interface Host {
  capabilities: HostCapabilities;
  clipboard?: HostClipboard;
  navigation?: HostNavigation;
  item?: HostItem;
  action?: HostAction;
  settings?: HostSettings;
}

export interface PluginInitContext {
  pluginID: string;
}

// --- Content envelope types ---

export interface AttachmentRef {
  attachmentType: string;
  attachmentKey: string;
}

export interface TextContent {
  kind: 'text';
  payload: { text: string };
}
export interface ImageContent {
  kind: 'image';
  payload: { bytes: number; width: number; height: number; format: string };
}
export interface PathReferenceContent {
  kind: 'path_reference';
  payload: { entries: unknown[] };
}
export type ContentEnvelope = TextContent | ImageContent | PathReferenceContent;

export interface ItemContext {
  item: ClipboardItem;
  content: ContentEnvelope;
  attachments: AttachmentRef[];
}

// --- Detector ---

export interface DetectorInput extends ItemContext {
  // no extra fields beyond ItemContext
}

export interface DetectorArtifact {
  attachmentType: string;
  attachmentKey: string;
  payloadJson: string;
  searchProjection?: { scope: string; terms?: string[] };
}

export type DetectorResult = DetectorArtifact[];

export interface DetectorHandler {
  detect(input: DetectorInput, ctx?: { host?: Host }): Promise<DetectorResult>;
}

// --- Attachment Renderer ---

export interface ResolveAttachmentInput extends ItemContext {
  attachment: { payloadJson: string; historyID: string; owner: string; attachmentType: string; attachmentKey: string };
  declaredActions: ActionButton[];
}

export interface AttachmentResolveResult {
  displayName?: string;
  tintHex?: string;
  buttons?: ActionButton[];
}

export interface AttachmentOperationInput extends ItemContext {
  attachment: { payloadJson: string; historyID: string; owner: string; attachmentType: string; attachmentKey: string };
  buttonID: string;
  params: Record<string, unknown>;
  triggerSource: string;
}

export interface AttachmentOperationResult {
  success: boolean;
  userMessage: string | null;
}

export interface AttachmentRendererHandler {
  resolveAttachment(input: ResolveAttachmentInput, ctx?: { host?: Host }): Promise<AttachmentResolveResult>;
  invokeOperation(input: AttachmentOperationInput, ctx: { host: Host }): Promise<AttachmentOperationResult>;
}

// --- Action ---

export interface ActionSessionResolveInput extends ItemContext {
  action: { id: string; actionID: string; title: string; lifecycle: string; supportedItemTypes: string[]; keywords: string[]; uiEntry?: string; buttons: ActionButton[] };
}

export interface ActionResolveResult {
  displayName?: string;
  buttons: ActionButton[];
  initialDraft?: Draft;
  defaultButtonID?: string | null;
}

export interface ActionRunInput extends ItemContext {
  actionID: string;
  draft: Record<string, unknown>;
  buttonID: string | null;
  triggerSource?: string;
}

export interface ActionOperationResult {
  result: { resultKind: string; text?: string | null; imageTempPath?: string | null; imageFormatHint?: string | null };
  userMessage: string | null;
}

export interface ActionHandler {
  resolveSession(input: ActionSessionResolveInput, ctx?: { host?: Host }): Promise<ActionResolveResult>;
  invokeOperation(input: ActionRunInput, ctx: { host: Host; request?: unknown; plugin?: unknown; capability?: unknown }): Promise<ActionOperationResult>;
}

// --- Plugin Definition ---

export interface PluginDefinition {
  setup(ctx?: PluginInitContext): {
    detectors?: Record<string, DetectorHandler>;
    attachmentRenderers?: Record<string, AttachmentRendererHandler>;
    actions?: Record<string, ActionHandler>;
  };
}

export interface Ctx {
  host: Host;
}
