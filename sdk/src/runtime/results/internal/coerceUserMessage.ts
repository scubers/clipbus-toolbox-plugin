export function coerceUserMessage(value: string | undefined | null): string | null {
  return value ?? null;
}
