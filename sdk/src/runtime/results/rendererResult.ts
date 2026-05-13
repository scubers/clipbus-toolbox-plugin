import { coerceUserMessage } from './internal/coerceUserMessage.js';

export interface RendererResultSuccess {
  success: true;
  userMessage: string | null;
}

export interface RendererResultFailure {
  success: false;
  userMessage: string | null;
}

export const rendererResult = {
  success(options: { userMessage?: string | null } = {}): RendererResultSuccess {
    return {
      success: true,
      userMessage: coerceUserMessage(options.userMessage),
    };
  },
  failure(userMessage: string | null | undefined): RendererResultFailure {
    return {
      success: false,
      userMessage: userMessage ?? null,
    };
  },
};
