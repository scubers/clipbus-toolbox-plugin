import { callHostSync } from '../internal/bridges.js';

export async function get(key: string): Promise<string | null> {
  const result = await callHostSync<{ value: string | null }>('settingsGet', { key });
  return result?.value ?? null;
}

export async function getAll(): Promise<Record<string, string>> {
  const result = await callHostSync<Record<string, string>>('settingsGetAll', {});
  return result ?? {};
}

export const settingsModule = {
  get,
  getAll,
};
