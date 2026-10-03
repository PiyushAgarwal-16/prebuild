import { VISION_TIMEOUT_MS, VISION_URL } from "../config.js";
import type { BoundingBox, ExtractedFootprint, ExtractionScene } from "../types.js";

interface SceneResponse {
  backend: string;
  footprints: { ring: [number, number][]; area_m2: number; confidence: number }[];
  note: string;
  classifier: ExtractionScene["classifier"];
  zoom: number;
  gsd_m: number;
  scene_px: [number, number];
  candidates: number;
  tile_source: string;
  elapsed_s: number;
  detail?: string;
}

export async function extractFootprints(bbox: BoundingBox): Promise<ExtractionScene> {
  let res: Response;
  try {
    res = await fetch(`${VISION_URL}/extract/scene`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bbox, classify: true }),
      signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err instanceof Error && err.name === "TimeoutError" ? "timed out" : "is not reachable";
    throw new Error(`Vision service ${reason} at ${VISION_URL}`);
  }

  const payload = (await res.json().catch(() => null)) as SceneResponse | null;
  if (!res.ok || !payload) {
    throw new Error(payload?.detail ?? `Vision service returned ${res.status}`);
  }

  const footprints: ExtractedFootprint[] = payload.footprints.map((f) => ({
    ring: f.ring,
    areaM2: f.area_m2,
    confidence: f.confidence,
  }));

  return {
    backend: payload.backend,
    footprints,
    note: payload.note,
    classifier: payload.classifier,
    zoom: payload.zoom,
    gsdM: payload.gsd_m,
    tileSource: payload.tile_source,
    elapsedS: payload.elapsed_s,
  };
}
