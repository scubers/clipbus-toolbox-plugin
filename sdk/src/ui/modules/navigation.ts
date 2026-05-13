import { callHostSync } from '../internal/bridges.js';

export async function openUrl(url: string): Promise<void> {
  await callHostSync('openUrl', { url });
}

export async function revealInFinder(path: string): Promise<void> {
  await callHostSync('revealInFinder', { path });
}

export async function openFilePath(path: string): Promise<void> {
  await callHostSync('openFilePath', { path });
}

export const navigationModule = {
  openUrl,
  revealInFinder,
  openFilePath,
};
