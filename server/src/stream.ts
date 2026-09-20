import type { LiveFrame } from "./types.js";

type Listener = (frame: LiveFrame) => void;

const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publish(frame: LiveFrame): void {
  for (const listener of listeners) listener(frame);
}

export function clientCount(): number {
  return listeners.size;
}
