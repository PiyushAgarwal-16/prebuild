import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { PORT, SYNTHETIC } from "./config.js";
import { hello, snapshot, startEngine } from "./engine.js";
import { clientCount, subscribe } from "./stream.js";
import type { LiveFrame } from "./types.js";
import { parseBBox, runPipeline } from "./pipeline/run.js";
import { registryRoutes } from "./registry/routes.js";
import { hasKey, listModels, DEFAULT_MODEL } from "./pipeline/ai/openai.js";

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

app.get("/api/ai/health", async (c) => {
  if (!hasKey()) return c.json({ ok: false, model: DEFAULT_MODEL, error: "OPENAI_API_KEY is not set" }, 503);
  try {
    const models = await listModels();
    return c.json({
      ok: true,
      model: DEFAULT_MODEL,
      modelAvailable: models.includes(DEFAULT_MODEL),
      count: models.length,
      sample: models.filter((m) => m.startsWith("gpt") || m.startsWith("o")).slice(0, 25),
    });
  } catch (err) {
    return c.json({ ok: false, model: DEFAULT_MODEL, error: err instanceof Error ? err.message : "failed" }, 502);
  }
});

app.get("/api/pipeline/run", async (c) => {
  const bbox = parseBBox(c.req.query("bbox"));
  if (!bbox) {
    return c.json({ ok: false, error: "bbox=south,west,north,east required, at most 0.08 deg per side" }, 400);
  }
  const infer = c.req.query("infer") === "1";
  try {
    const result = await runPipeline(bbox, { infer });
    return c.json({ ok: true, ...result });
  } catch (err) {
    return c.json({ ok: false, error: err instanceof Error ? err.message : "pipeline failed" }, 502);
  }
});

app.route("/api/registry", registryRoutes);

startEngine();

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`ulpin-3d live feed on http://127.0.0.1:${info.port} (synthetic=${SYNTHETIC})`);
});
