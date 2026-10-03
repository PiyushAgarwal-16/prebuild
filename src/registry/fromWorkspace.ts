import type { Parcel, Stratum, StratumUse } from "../types";
import type { DerivedBuilding, DerivedVolume } from "../pipeline/types";

const KIND_BY_USE: Record<StratumUse, DerivedVolume["kind"]> = {
  residential: "unit",
  commercial: "unit",
  parking: "parking",
  utility: "plant",
  transport: "unit",
  airspace: "unit",
  common: "common",
  structural: "plant",
};

export function toDerivedBuilding(parcel: Parcel, strata: Stratum[]): DerivedBuilding {
  const own = strata.filter((s) => s.parcelId === parcel.id);
  const occupied = own.filter((s) => s.band === "G" || s.band === "F");
  const levels = new Set(occupied.map((s) => `${s.band}${s.level}`)).size;
  const heights = occupied.map((s) => s.zMax - s.zMin).filter((h) => h > 0);
  const storey = heights.length ? heights.reduce((a, b) => a + b, 0) / heights.length : 3.2;

  const volumes: DerivedVolume[] = own.map((s) => ({
    ref: s.ulpin,
    label: s.label,
    band: s.band,
    level: s.level,
    kind: KIND_BY_USE[s.use] ?? "unit",
    use: s.use,
    footprint: s.footprint,
    zMin: s.zMin,
    zMax: s.zMax,
    confidence: 1,
  }));

  return {
    sourceId: parcel.surveyNumber || parcel.ulpinBase,
    name: parcel.landUse || null,
    ring: parcel.ring,
    groundElevationM: parcel.groundElevation || null,
    verticalDatum: parcel.groundElevation ? `workspace datum ${parcel.groundElevation} m MSL` : "undeclared",
    storeyHeightM: Number(storey.toFixed(2)),
    heightM: Number(Math.max(0, ...own.map((s) => s.zMax)).toFixed(2)),
    levels: Math.max(levels, 1),
    levelsBelow: new Set(own.filter((s) => s.band === "B").map((s) => s.level)).size,
    heightSource: "levels",
    volumes,
    attribution: `ULPIN 3D workspace · parcel ${parcel.ulpinBase}`,
  };
}
