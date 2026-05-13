import type { Topic, OptionalTopic, Stream, Unsubscribe } from '../../internal/shapes.js';

export interface MutableTopic<T> extends Topic<T> {
  set(value: T): void;
}

export interface MutableOptionalTopic<T> extends OptionalTopic<T> {
  set(value: T): void;
  activate(): void;
  isActive(): boolean;
}

export interface MutableStream<T> extends Stream<T> {
  emit(event: T): void;
}

export function createTopic<T>(initial: T): MutableTopic<T> {
  let value = initial;
  const listeners = new Set<(v: T) => void>();
  return {
    current: () => value,
    on(listener: (v: T) => void): Unsubscribe {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next: T): void {
      value = next;
      for (const l of listeners) {
        try { l(value); } catch { /* isolate listener errors */ }
      }
    },
  };
}

export function createOptionalTopic<T>(): MutableOptionalTopic<T> {
  let value: T | undefined;
  let active = false;
  const listeners = new Set<(v: T) => void>();
  return {
    current: () => value,
    on(listener: (v: T) => void): Unsubscribe {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next: T): void {
      value = next;
      for (const l of listeners) {
        try { l(value as T); } catch { /* isolate listener errors */ }
      }
    },
    activate(): void { active = true; },
    isActive(): boolean { return active; },
  };
}

export function createStream<T>(): MutableStream<T> {
  const listeners = new Set<(v: T) => void>();
  return {
    on(listener: (v: T) => void): Unsubscribe {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(event: T): void {
      for (const l of listeners) {
        try { l(event); } catch { /* isolate listener errors */ }
      }
    },
  };
}
