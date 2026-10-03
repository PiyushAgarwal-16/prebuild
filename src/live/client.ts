import { LIVE_SNAPSHOT_URL, LIVE_STREAM_URL } from "./endpoints";
import type { LiveHandlers, SnapshotPayload } from "./types";

const MAX_BACKOFF_MS = 8000;

export interface LiveConnection {
  close: () => void;
}

export async function fetchSnapshot(): Promise<SnapshotPayload | null> {
  try {
    const res = await fetch(LIVE_SNAPSHOT_URL);
    if (!res.ok) return null;
    return (await res.json()) as SnapshotPayload;
  } catch {
    return null;
  }
}

function parse<T>(event: MessageEvent): T | null {
  try {
    return JSON.parse(event.data) as T;
  } catch {
    return null;
  }
}

export function openLiveStream(handlers: LiveHandlers): LiveConnection {
  let source: EventSource | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let closed = false;

  const connect = () => {
    if (closed) return;
    source = new EventSource(LIVE_STREAM_URL);

    source.onopen = () => {
      attempt = 0;
      handlers.onOpen();
    };

    source.onerror = () => {
      handlers.onError();
      source?.close();
      source = null;
      if (closed) return;
      const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** attempt++);
      retry = setTimeout(connect, delay);
    };

    source.addEventListener("hello", (e) => {
      const frame = parse<Parameters<LiveHandlers["onHello"]>[0]>(e as MessageEvent);
      if (frame) handlers.onHello(frame);
    });
    source.addEventListener("gnss", (e) => {
      const frame = parse<{ stations: Parameters<LiveHandlers["onGnss"]>[0] }>(e as MessageEvent);
      if (frame) handlers.onGnss(frame.stations);
    });
    source.addEventListener("rover", (e) => {
      const frame = parse<{ rover: Parameters<LiveHandlers["onRover"]>[0] }>(e as MessageEvent);
      if (frame) handlers.onRover(frame.rover);
    });
    source.addEventListener("imagery", (e) => {
      const frame = parse<{ imagery: Parameters<LiveHandlers["onImagery"]>[0] }>(e as MessageEvent);
      if (frame) handlers.onImagery(frame.imagery);
    });
    source.addEventListener("tick", () => handlers.onTick());
  };

  connect();

  return {
    close: () => {
      closed = true;
      if (retry) clearTimeout(retry);
      source?.close();
      source = null;
    },
  };
}
