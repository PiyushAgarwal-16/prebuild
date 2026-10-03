const BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

export const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export function hasKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function authHeaders(): Record<string, string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export async function listModels(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/models`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`model list failed with ${res.status}`);
  const payload = (await res.json()) as { data?: { id: string }[] };
  return (payload.data ?? []).map((m) => m.id).sort();
}

export async function completeJSON<T>(prompt: string, system: string, model = DEFAULT_MODEL): Promise<T> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`inference failed with ${res.status}: ${detail.slice(0, 240)}`);
  }

  const payload = (await res.json()) as {
    choices?: { message?: { content?: string | null; reasoning_content?: string | null } }[];
  };
  const message = payload.choices?.[0]?.message;
  const text = message?.content?.trim() || message?.reasoning_content?.trim() || "";
  if (!text) throw new Error("model returned an empty response");
  return JSON.parse(text) as T;
}
