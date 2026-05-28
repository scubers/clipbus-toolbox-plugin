import type {
  PluginActionButton,
  PluginAttachmentRendererHandler,
  PluginAttachmentResolveResult,
  PluginResolveAttachmentInput,
} from "@pasty/plugin-sdk/runtime";
import { decodeDecodePayload, encodingLabel, type DecodePayload } from "./payload.ts";

export function buttonsFor(payload: DecodePayload): PluginActionButton[] {
  const isJson = payload.encoding === "jwt" || payload.decodedIsJSON === true;
  const buttons: PluginActionButton[] = [
    { id: "copy-decoded", title: isJson ? "Copy minified" : "Copy", isEnabled: true },
  ];
  if (isJson) {
    buttons.push({ id: "copy-json", title: "Copy pretty", isEnabled: true });
  }
  buttons.push({
    id: "toggle-expand",
    title: payload.expanded === true ? "Show Less" : "Show More",
    isEnabled: true,
  });
  return buttons;
}

export function resolveAttachment(input: PluginResolveAttachmentInput): PluginAttachmentResolveResult {
  const payload = decodeDecodePayload(input?.attachment?.payloadJson);
  if (!payload) {
    return {
      displayName: "Decoded Preview",
      buttons: [],
      shouldDisplay: false,
    };
  }

  return {
    displayName: `Decoded Preview - ${encodingLabel(payload.encoding)}`,
    buttons: buttonsFor(payload),
  };
}

export function createDecodeRenderer(): PluginAttachmentRendererHandler {
  return {
    async resolveAttachment(input: PluginResolveAttachmentInput): Promise<PluginAttachmentResolveResult> {
      return resolveAttachment(input);
    },
  };
}
