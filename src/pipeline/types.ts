import type { LngLat, Ring } from "../types";

export interface DerivedVolume {
  ref: string;
  label: string;
  band: "S" | "B" | "G" | "F" | "A" | "E";
  level: number;
  kind: "unit" | "common" | "parking" | "plant";
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

export interface Finding {
  code: string;
  severity: "critical" | "warning" | "info";
  message: string;
  subjects: string[];
}

export interface ValidationReport {
  ok: boolean;
  checked: number;
  findings: Finding[];
}

export interface Jurisdiction {
  stateCode: string;
  stateName: string;
  districtName: string;
  villageName: string;
  resolved: boolean;
}

export interface PipelineResult {
  bbox: { south: number; west: number; north: number; east: number };
  widened: boolean;
  buildings: DerivedBuilding[];
  report: ValidationReport;
  inference: { attempted: number; applied: number; model: string | null; error: string | null };
  sources: { buildings: string; terrain: string };
  jurisdiction: Jurisdiction;
}

export type BBox = [LngLat, LngLat];
