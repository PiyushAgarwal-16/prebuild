import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import OpenAI from "openai";

const baseUrl = () => process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const visionModel = () => process.env.OPENAI_VISION_MODEL || "gpt-4o";

function readBody(req: import("http").IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(""));
  });
}

function json(res: import("http").ServerResponse, payload: unknown, code = 200) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function stripFences(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

function planBridge(): Plugin {
  return {
    name: "plan-extraction-bridge",
    configureServer(server) {
      server.middlewares.use("/api/plan-status", (_req, res) => {
        json(res, { ready: Boolean(process.env.OPENAI_API_KEY), model: visionModel() });
      });

      server.middlewares.use("/api/extract-plan", async (req, res) => {
        if (req.method !== "POST") return json(res, { ok: false, error: "POST required" }, 405);
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          return json(res, { ok: false, error: "OPENAI_API_KEY is not set for the dev server" }, 503);
        }

        let dataUrl = "";
        let prompt = "";
        try {
          const parsed = JSON.parse(await readBody(req));
          dataUrl = typeof parsed.dataUrl === "string" ? parsed.dataUrl : "";
          prompt = typeof parsed.prompt === "string" ? parsed.prompt : "";
        } catch {
          return json(res, { ok: false, error: "Malformed request body" }, 400);
        }
        if (!dataUrl.startsWith("data:image/")) {
          return json(res, { ok: false, error: "Expected an image data URL" }, 400);
        }

        try {
          const client = new OpenAI({ baseURL: baseUrl(), apiKey });
          const completion = await client.chat.completions.create({
            model: visionModel(),
            temperature: 0.1,
            max_tokens: 4096,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  { type: "image_url", image_url: { url: dataUrl } },
                ],
              },
            ],
          });
          const message = completion.choices?.[0]?.message as
            | { content?: string | null; reasoning_content?: string | null }
            | undefined;
          const text = message?.content?.trim() || message?.reasoning_content?.trim() || "";
          if (!text) return json(res, { ok: false, error: "Model returned an empty response" }, 502);
          try {
            return json(res, { ok: true, plan: JSON.parse(stripFences(text)) });
          } catch {
            return json(res, { ok: false, error: "Model response was not valid JSON" }, 502);
          }
        } catch (err) {
          const detail = err instanceof Error ? err.message : "Vision request failed";
          return json(res, { ok: false, error: detail.slice(0, 300) }, 502);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  const api = {
    target: `http://127.0.0.1:${process.env.LIVE_PORT || 5181}`,
    changeOrigin: true,
  };
  return {
    plugins: [react(), tailwindcss(), planBridge()],
    optimizeDeps: { exclude: ["maplibre-gl"] },
    server: {
      port: 5180,
      proxy: {
        "/api/live": api,
        "/api/pipeline": api,
        "/api/ai": api,
        "/api/registry": api,
      },
    },
  };
});
