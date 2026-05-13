export type Unsubscribe = () => void;

export interface Stream<T> {
  on(listener: (event: T) => void): Unsubscribe;
}

export interface Topic<T> extends Stream<T> {
  current(): T;
}

export interface OptionalTopic<T> {
  current(): T | undefined;
  on(listener: (event: T) => void): Unsubscribe;
}

export type Verb<Args = void, Result = void> = Args extends void
  ? () => Promise<Result>
  : (args: Args) => Promise<Result>;
