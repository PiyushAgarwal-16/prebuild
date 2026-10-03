import { completeJSON, DEFAULT_MODEL } from "./openai.js";
import { ringAreaM2 } from "../../geo.js";
import type { DerivedBuilding, DerivedVolume } from "../types.js";

const SYSTEM = [
  "You are assisting an Indian vertical cadastre. Given a building envelope derived from map data,",
  "propose how the column divides into legally distinct volumes.",
  "Only infer what the evidence supports. Where you are guessing, lower the confidence.",
  "Never invent a storey count that contradicts the supplied one.",
  'Reply as JSON: {"levels":[{"level":number,"use":string,"kind":"unit"|"common"|"parking"|"plant",',
  '"units":number,"label":string,"confidence":number}],"notes":string}',
  "use must be one of: residential, commercial, parking, utility, transport, airspace, common, structural.",
].join(" ");

interface LevelProposal {
  level: number;
  use: string;
  kind: DerivedVolume["kind"];
  units: number;
  label: string;
  confidence: number;
}

export interface UnitInference {
  model: string;
  levels: LevelProposal[];
  notes: string;
}

const USES = new Set([
  "residential",
  "commercial",
  "parking",
  "utility",
  "transport",
  "airspace",
  "common",
  "structural",
]);

function describe(building: DerivedBuilding): string {
  const area = ringAreaM2(building.ring);
  return JSON.stringify({
    name: building.name ?? "unnamed",
    footprint_area_m2: Number(area.toFixed(0)),
    height_m: building.heightM,
    storeys_above_ground: building.levels,
    storeys_below_ground: building.levelsBelow,
    storey_height_m: building.storeyHeightM,
    height_source: building.heightSource,
    ground_elevation_m: building.groundElevationM,
    jurisdiction: "India",
  });
}

export async function inferUnits(building: DerivedBuilding): Promise<UnitInference> {
  const raw = await completeJSON<{ levels?: LevelProposal[]; notes?: string }>(
    describe(building),
    SYSTEM,
  );
  const levels = (raw.levels ?? [])
    .filter((l) => Number.isFinite(l.level) && l.level >= 0 && l.level < building.levels)
    .map((l) => ({
      level: Math.round(l.level),
      use: USES.has(l.use) ? l.use : "commercial",
      kind: (["unit", "common", "parking", "plant"] as const).includes(l.kind) ? l.kind : "unit",
      units: Math.max(0, Math.round(Number(l.units) || 0)),
      label: String(l.label || `Level ${l.level}`).slice(0, 80),
      confidence: Math.min(1, Math.max(0, Number(l.confidence) || 0)),
    }));
  return { model: DEFAULT_MODEL, levels, notes: String(raw.notes ?? "").slice(0, 400) };
}

export function applyInference(building: DerivedBuilding, inference: UnitInference): DerivedBuilding {
  const byLevel = new Map(inference.levels.map((l) => [l.level, l]));
  return {
    ...building,
    volumes: building.volumes.map((volume) => {
      if (volume.band !== "F" && volume.band !== "G") return volume;
      const proposal = byLevel.get(volume.level);
      if (!proposal) return volume;
      return {
        ...volume,
        label: proposal.label,
        use: proposal.use,
        kind: proposal.kind,
        confidence: Number(((volume.confidence + proposal.confidence) / 2).toFixed(2)),
      };
    }),
  };
}
