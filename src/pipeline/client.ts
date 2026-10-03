import type { ExtractMode, PipelineResult } from "./types";

export async function runPipeline(
  bbox: { south: number; west: number; north: number; east: number },
  infer: boolean,
  extract: ExtractMode,
): Promise<PipelineResult> {
  const query = `${bbox.south.toFixed(5)},${bbox.west.toFixed(5)},${bbox.north.toFixed(5)},${bbox.east.toFixed(5)}`;
  const res = await fetch(`/api/pipeline/run?bbox=${query}&infer=${infer ? 1 : 0}&extract=${extract === "add" ? "add" : extract === "report" ? 1 : 0}`);
  const payload = (await res.json()) as PipelineResult & { ok: boolean; error?: string };
  if (!res.ok || !payload.ok) throw new Error(payload.error || `Pipeline failed (${res.status})`);
  return payload;
}
