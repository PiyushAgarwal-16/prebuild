import type { LngLat } from "../types.js";

export type Ring = LngLat[];

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface SourceBuilding {
  sourceId: string;
  source: "osm";
  name: string | null;
  ring: Ring;
  levels: number | null;
  levelsBelow: number | null;
  heightM: number | null;
  buildingTag: string;
  amenity: string | null;
  attribution: string;
}

export interface TerrainSample {
  position: LngLat;
  elevationM: number | null;
  dataset: string;
}

export type VolumeKind = "unit" | "common" | "parking" | "plant";

export interface DerivedVolume {
  ref: string;
  label: string;
  band: "S" | "B" | "G" | "F" | "A" | "E";
  level: number;
  kind: VolumeKind;
  use: string;
  footprint: Ring;
  zMin: number;
  zMax: number;
  confidence: number;
}

export interface DerivedBuilding {
  sourceId: string;
  name: string | null;
  ring: Ring;
  groundElevationM: number | null;
  verticalDatum: string;
  storeyHeightM: number;
  heightM: number;
  levels: number;
  levelsBelow: number;
  heightSource: "tagged" | "levels" | "assumed";
  volumes: DerivedVolume[];
  attribution: string;
}

export type FindingSeverity = "critical" | "warning" | "info";

export interface Finding {
  code: string;
  severity: FindingSeverity;
  message: string;
  subjects: string[];
}

export interface ValidationReport {
  ok: boolean;
  checked: number;
  findings: Finding[];
}
