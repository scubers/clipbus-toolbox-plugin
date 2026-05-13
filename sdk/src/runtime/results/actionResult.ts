import { coerceUserMessage } from './internal/coerceUserMessage.js';

export interface ActionResultText {
  result: { resultKind: 'text'; text: string };
  userMessage: string | null;
}

export interface ActionResultNone {
  result: { resultKind: 'none'; text: null };
  userMessage: string | null;
}

export interface ActionResultImage {
  result: { resultKind: 'image'; imageTempPath: string; imageFormatHint: string | null };
  userMessage: string | null;
}

export const actionResult = {
  text(value: unknown, options: { userMessage?: string | null } = {}): ActionResultText {
    return {
      result: { resultKind: 'text', text: String(value ?? '') },
      userMessage: coerceUserMessage(options.userMessage),
    };
  },
  none(options: { userMessage?: string | null } = {}): ActionResultNone {
    return {
      result: { resultKind: 'none', text: null },
      userMessage: coerceUserMessage(options.userMessage),
    };
  },
  image(imageTempPath: string, options: { formatHint?: string; userMessage?: string | null } = {}): ActionResultImage {
    return {
      result: { resultKind: 'image', imageTempPath, imageFormatHint: options.formatHint ?? null },
      userMessage: coerceUserMessage(options.userMessage),
    };
  },
};

export function imageResult(imageTempPath: string, formatHint?: string): ActionResultImage['result'] {
  return { resultKind: 'image', imageTempPath, imageFormatHint: formatHint ?? null };
}
