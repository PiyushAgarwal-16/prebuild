import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { PORT, SYNTHETIC } from "./config.js";
import { hello, snapshot, startEngine } from "./engine.js";
import { clientCount, subscribe } from "./stream.js";
import type { LiveFrame } from "./types.js";

const app = new Hono();

app.get("/api/live/health", (c) =>
  c.json({ ok: true, synthetic: SYNTHETIC, clients: clientCount(), serverTime: new Date().toISOString() }),
);

app.get("/api/live/snapshot", (c) => c.json(snapshot()));

app.get("/api/live/stream", (c) =>
  streamSSE(c, async (stream) => {
    const queue: LiveFrame[] = [];
    let wake: (() => void) | null = null;
    let open = true;

    stream.onAbort(() => {
      open = false;
      wake?.();
    });

    const unsubscribe = subscribe((frame) => {
      queue.push(frame);
      if (queue.length > 120) queue.splice(0, queue.length - 120);
      wake?.();
    });

    try {
      await stream.writeSSE({ event: "hello", data: JSON.stringify(hello()) });
      while (open) {
        while (queue.length && open) {
          const frame = queue.shift()!;
          await stream.writeSSE({ event: frame.event, data: JSON.stringify(frame.data) });
        }
        if (!open) break;
        await new Promise<void>((resolve) => {
          wake = resolve;
          setTimeout(resolve, 10000);
        });
        wake = null;
      }
    } finally {
      unsubscribe();
    }
  }),
);

startEngine();

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`ulpin-3d live feed on http://127.0.0.1:${info.port} (synthetic=${SYNTHETIC})`);
});
