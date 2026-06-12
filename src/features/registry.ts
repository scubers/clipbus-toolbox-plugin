import type {
  PluginAttachmentRendererHandler,
  PluginAutoRunActionHandler,
  PluginDetectorHandler,
} from "@clipbus/plugin-sdk/runtime";

// The SDK runtime entry re-exports the handler types but not `PluginRegistry`
// or `MessageHandler`, so this mirrors the registry shape locally. Message
// handlers read `request`/`ctx` as unknown and narrow internally (or use
// defineMessage); this loose shape stays assignable to the SDK's MessageHandler.
type MessageHandler = (request: unknown, ctx: unknown) => unknown;

export interface PluginFeature {
  attachmentRenderers?: Record<string, PluginAttachmentRendererHandler>;
  detectors?: Record<string, PluginDetectorHandler>;
  actions?: Record<string, PluginAutoRunActionHandler>;
  messageHandlers?: Record<string, MessageHandler>;
}

function assignUnique<T>(
  target: Record<string, T>,
  source: Record<string, T> | undefined,
  slot: string,
): void {
  if (!source) {
    return;
  }
  for (const [id, handler] of Object.entries(source)) {
    if (id in target) {
      throw new Error(`Duplicate ${slot} id "${id}" registered across features`);
    }
    target[id] = handler;
  }
}

// Fold every feature's contributions into one registry, failing loudly on id
// collisions. Empty slots are omitted so the result matches what the host
// expects (e.g. no `actions` key when no feature ships an action).
export function mergeFeatures(features: PluginFeature[]): PluginFeature {
  const attachmentRenderers: Record<string, PluginAttachmentRendererHandler> = {};
  const detectors: Record<string, PluginDetectorHandler> = {};
  const actions: Record<string, PluginAutoRunActionHandler> = {};
  const messageHandlers: Record<string, MessageHandler> = {};

  for (const feature of features) {
    assignUnique(attachmentRenderers, feature.attachmentRenderers, "attachmentRenderers");
    assignUnique(detectors, feature.detectors, "detectors");
    assignUnique(actions, feature.actions, "actions");
    assignUnique(messageHandlers, feature.messageHandlers, "messageHandlers");
  }

  const registry: PluginFeature = {};
  if (Object.keys(attachmentRenderers).length > 0) {
    registry.attachmentRenderers = attachmentRenderers;
  }
  if (Object.keys(detectors).length > 0) {
    registry.detectors = detectors;
  }
  if (Object.keys(actions).length > 0) {
    registry.actions = actions;
  }
  if (Object.keys(messageHandlers).length > 0) {
    registry.messageHandlers = messageHandlers;
  }
  return registry;
}
