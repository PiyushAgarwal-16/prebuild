import {
  DEFAULT_BASEMENT_HEIGHT_M,
  DEFAULT_STOREY_HEIGHT_M,
  MAX_STOREY_HEIGHT_M,
  MIN_STOREY_HEIGHT_M,
} from "../config.js";
import { ringCentroid } from "../../geo.js";
import type { DerivedBuilding, DerivedVolume, SourceBuilding, TerrainSample } from "../types.js";

const USE_BY_TAG: Record<string, string> = {
  apartments: "residential",
  residential: "residential",
  house: "residential",
  commercial: "commercial",
  retail: "commercial",
  office: "commercial",
  industrial: "utility",
  warehouse: "utility",
  parking: "parking",
  garage: "parking",
  train_station: "transport",
  school: "common",
  college: "common",
  university: "common",
  hospital: "common",
};

function useForTag(tag: string): string {
  return USE_BY_TAG[tag] ?? "commercial";
}

function storeyHeight(heightM: number | null, levels: number | null): number {
  if (heightM && levels && levels > 0) {
    const derived = heightM / levels;
    if (derived >= MIN_STOREY_HEIGHT_M && derived <= MAX_STOREY_HEIGHT_M) return derived;
  }
  return DEFAULT_STOREY_HEIGHT_M;
}

export function deriveBuilding(
  source: SourceBuilding,
  terrain: TerrainSample | undefined,
): DerivedBuilding {
  const storey = storeyHeight(source.heightM, source.levels);
  const levels = source.levels ?? (source.heightM ? Math.max(1, Math.round(source.heightM / storey)) : 1);
  const heightM = source.heightM ?? levels * storey;
  const levelsBelow = source.levelsBelow ?? 0;
  const heightSource: DerivedBuilding["heightSource"] = source.heightM
    ? "tagged"
    : source.levels
      ? "levels"
      : "assumed";
  const confidence = heightSource === "tagged" ? 0.9 : heightSource === "levels" ? 0.7 : 0.35;
  const use = useForTag(source.buildingTag);

  const volumes: DerivedVolume[] = [];

  for (let b = levelsBelow; b >= 1; b--) {
    volumes.push({
      ref: `${source.sourceId}-B${b}`,
      label: `Basement level ${b}`,
      band: "B",
      level: b,
      kind: "parking",
      use: "parking",
      footprint: source.ring,
      zMin: -b * DEFAULT_BASEMENT_HEIGHT_M,
      zMax: -(b - 1) * DEFAULT_BASEMENT_HEIGHT_M,
      confidence: levelsBelow ? confidence : 0.3,
    });
  }

  for (let level = 0; level < levels; level++) {
    const zMin = level * storey;
    volumes.push({
      ref: `${source.sourceId}-L${level}`,
      label: level === 0 ? "Ground level" : `Level ${level}`,
      band: level === 0 ? "G" : "F",
      level,
      kind: "unit",
      use: level === 0 ? "commercial" : use,
      footprint: source.ring,
      zMin: Number(zMin.toFixed(2)),
      zMax: Number((zMin + storey).toFixed(2)),
      confidence,
    });
  }

  return {
    sourceId: source.sourceId,
    name: source.name,
    ring: source.ring,
    groundElevationM: terrain?.elevationM ?? null,
    verticalDatum: terrain?.elevationM == null ? "undeclared" : `${terrain.dataset} (EGM96 orthometric)`,
    storeyHeightM: Number(storey.toFixed(2)),
    heightM: Number(heightM.toFixed(2)),
    levels,
    levelsBelow,
    heightSource,
    volumes,
    attribution: source.attribution,
  };
}

export function centroidOf(source: SourceBuilding) {
  return ringCentroid(source.ring);
}
