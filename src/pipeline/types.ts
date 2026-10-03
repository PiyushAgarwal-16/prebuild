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

export interface ExtractionAccuracy {
  extracted: number;
  reference: number;
  matched: number;
  precision: number;
  recall: number;
  meanIou: number;
  inside: number;
  insideRate: number;
  coverageRecall: number;
  referenceComplete: boolean;
}

export interface ExtractionClassifier {
  model: string | null;
  attempted: number;
  kept: number;
  dropped: number;
  error: string | null;
}

export interface ExtractionReport {
  attempted: boolean;
  backend: string | null;
  tileSource: string | null;
  gsdM: number | null;
  elapsedS: number | null;
  footprints: number;
  added: number;
  accuracy: ExtractionAccuracy | null;
  classifier: ExtractionClassifier | null;
  note: string | null;
  error: string | null;
}

export type ExtractMode = "off" | "report" | "add";

export interface PipelineResult {
  bbox: { south: number; west: number; north: number; east: number };
  widened: boolean;
  buildings: DerivedBuilding[];
  report: ValidationReport;
  inference: { attempted: number; applied: number; model: string | null; error: string | null };
  extraction: ExtractionReport;
  sources: { buildings: string; terrain: string };
  jurisdiction: Jurisdiction;
}

export type BBox = [LngLat, LngLat];
