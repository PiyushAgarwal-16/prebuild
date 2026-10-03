import { fetchBuildings } from "./sources/osmBuildings.js";
import { sampleTerrain } from "./sources/terrain.js";
import { centroidOf, deriveBuilding } from "./derive/volumes.js";
import { validateAll } from "./validate/topology.js";
import { applyInference, inferUnits, type UnitInference } from "./ai/units.js";
import { hasKey } from "./ai/openai.js";
import { resolveJurisdiction, UNRESOLVED, type Jurisdiction } from "./sources/jurisdiction.js";
import { extractFootprints } from "./sources/extraction.js";
import { compareToReference } from "./validate/extraction.js";
import { EXTRACT_MIN_CONFIDENCE, MAX_BUILDINGS_PER_RUN, MIN_BBOX_SPAN_DEG } from "./config.js";
import type {
  BoundingBox,
  DerivedBuilding,
  ExtractionReport,
  SourceBuilding,
  ValidationReport,
} from "./types.js";

export interface PipelineResult {
  bbox: BoundingBox;
  widened: boolean;
  buildings: DerivedBuilding[];
  report: ValidationReport;
  inference: { attempted: number; applied: number; model: string | null; error: string | null };
  extraction: ExtractionReport;
  sources: { buildings: string; terrain: string };
  jurisdiction: Jurisdiction;
}

const NO_EXTRACTION: ExtractionReport = {
  attempted: false,
  backend: null,
  tileSource: null,
  gsdM: null,
  elapsedS: null,
  footprints: 0,
  added: 0,
  accuracy: null,
  classifier: null,
  note: null,
  error: null,
};

async function withExtraction(
  bbox: BoundingBox,
  osm: SourceBuilding[],
  addCandidates: boolean,
): Promise<{ sources: SourceBuilding[]; report: ExtractionReport }> {
  try {
    const scene = await extractFootprints(bbox);
    const referenceComplete = osm.length < MAX_BUILDINGS_PER_RUN;
    const { accuracy, novel } = compareToReference(scene.footprints, osm, referenceComplete);
    const additions: SourceBuilding[] = referenceComplete && addCandidates
      ? novel
          .filter((f) => f.confidence >= EXTRACT_MIN_CONFIDENCE)
          .map((f, i) => ({
            sourceId: `img-${bbox.south.toFixed(4)}-${bbox.west.toFixed(4)}-${i}`,
            source: "imagery" as const,
            name: null,
            ring: f.ring,
            levels: null,
            levelsBelow: null,
            heightM: null,
            buildingTag: "yes",
            amenity: null,
            attribution: `${scene.tileSource} — SAM extraction, ${scene.classifier.model ?? "unclassified"}`,
          }))
      : [];
    return {
      sources: [...osm, ...additions],
      report: {
        attempted: true,
        backend: scene.backend,
        tileSource: scene.tileSource,
        gsdM: scene.gsdM,
        elapsedS: scene.elapsedS,
        footprints: scene.footprints.length,
        added: additions.length,
        accuracy,
        classifier: scene.classifier,
        note: scene.note,
        error: null,
      },
    };
  } catch (err) {
    return {
      sources: osm,
      report: {
        ...NO_EXTRACTION,
        attempted: true,
        error: err instanceof Error ? err.message : "extraction failed",
      },
    };
  }
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
  options: { infer: boolean; extract?: "report" | "add" | null } = { infer: false },
): Promise<PipelineResult> {
  const { bbox, widened } = widen(input);
  const centre: [number, number] = [(bbox.west + bbox.east) / 2, (bbox.south + bbox.north) / 2];
  const [osm, jurisdiction] = await Promise.all([
    fetchBuildings(bbox),
    resolveJurisdiction(centre).catch(() => UNRESOLVED),
  ]);
  const { sources, report: extraction } = options.extract
    ? await withExtraction(bbox, osm, options.extract === "add")
    : { sources: osm, report: NO_EXTRACTION };
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
    extraction,
    jurisdiction,
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
