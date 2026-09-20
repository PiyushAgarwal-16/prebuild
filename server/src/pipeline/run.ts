import { fetchBuildings } from "./sources/osmBuildings.js";
import { sampleTerrain } from "./sources/terrain.js";
import { centroidOf, deriveBuilding } from "./derive/volumes.js";
import { validateAll } from "./validate/topology.js";
import { applyInference, inferUnits, type UnitInference } from "./ai/units.js";
import { hasKey } from "./ai/openai.js";
import { MIN_BBOX_SPAN_DEG } from "./config.js";
import type { BoundingBox, DerivedBuilding, ValidationReport } from "./types.js";

export interface PipelineResult {
  bbox: BoundingBox;
  widened: boolean;
  buildings: DerivedBuilding[];
  report: ValidationReport;
  inference: { attempted: number; applied: number; model: string | null; error: string | null };
  sources: { buildings: string; terrain: string };
}

const MAX_INFERENCE_CALLS = 6;

function widen(bbox: BoundingBox): { bbox: BoundingBox; widened: boolean } {
  const latSpan = bbox.north - bbox.south;
  const lngSpan = bbox.east - bbox.west;
  if (latSpan >= MIN_BBOX_SPAN_DEG && lngSpan >= MIN_BBOX_SPAN_DEG) return { bbox, widened: false };
  const latPad = Math.max(0, (MIN_BBOX_SPAN_DEG - latSpan) / 2);
  const lngPad = Math.max(0, (MIN_BBOX_SPAN_DEG - lngSpan) / 2);
  return {
    bbox: {
      south: bbox.south - latPad,
      north: bbox.north + latPad,
      west: bbox.west - lngPad,
      east: bbox.east + lngPad,
    },
    widened: true,
  };
}

export async function runPipeline(
  input: BoundingBox,
  options: { infer: boolean } = { infer: false },
): Promise<PipelineResult> {
  const { bbox, widened } = widen(input);
  const sources = await fetchBuildings(bbox);
  const terrain = await sampleTerrain(sources.map(centroidOf));

  let buildings = sources.map((source, i) => deriveBuilding(source, terrain[i]));

  const inference = {
    attempted: 0,
    applied: 0,
    model: null as string | null,
    error: null as string | null,
  };

  if (options.infer && buildings.length) {
    if (!hasKey()) {
      inference.error = "OPENAI_API_KEY is not set for the pipeline server";
    } else {
      const targets = [...buildings]
        .map((b, index) => ({ b, index }))
        .filter(({ b }) => b.levels >= 2)
        .sort((a, b) => b.b.levels - a.b.levels)
        .slice(0, MAX_INFERENCE_CALLS);

      const next = [...buildings];
      inference.attempted = targets.length;

      const settled = await Promise.allSettled(
        targets.map(async ({ b, index }) => {
          const result: UnitInference = await inferUnits(b);
          return { index, b, result };
        }),
      );

      for (const outcome of settled) {
        if (outcome.status === "rejected") {
          inference.error =
            outcome.reason instanceof Error ? outcome.reason.message : "inference failed";
          continue;
        }
        const { index, b, result } = outcome.value;
        inference.model = result.model;
        if (result.levels.length) {
          next[index] = applyInference(b, result);
          inference.applied += 1;
        }
      }
      buildings = next;
    }
  }

  return {
    bbox,
    widened,
    buildings,
    report: validateAll(buildings),
    inference,
    sources: {
      buildings: sources[0]?.attribution ?? "© OpenStreetMap contributors (ODbL)",
      terrain: terrain[0]?.dataset ?? "none",
    },
  };
}

export function parseBBox(value: string | undefined): BoundingBox | null {
  if (!value) return null;
  const parts = value.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [south, west, north, east] = parts;
  if (south >= north || west >= east) return null;
  if (north - south > 0.08 || east - west > 0.08) return null;
  return { south, west, north, east };
}
