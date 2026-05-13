import { callHostSync } from '../internal/bridges.js';

export async function copyText(text: string): Promise<void> {
  await callHostSync('copyText', { text });
}

export const clipboardModule = {
  copyText,
};
