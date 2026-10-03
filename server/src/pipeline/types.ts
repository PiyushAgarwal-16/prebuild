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
  source: "osm" | "imagery";
  name: string | null;
  ring: Ring;
  levels: number | null;
  levelsBelow: number | null;
  heightM: number | null;
  buildingTag: string;
  amenity: string | null;
  attribution: string;
}

export interface ExtractedFootprint {
  ring: Ring;
  areaM2: number;
  confidence: number;
}

export interface ExtractionClassifier {
  model: string | null;
  attempted: number;
  kept: number;
  dropped: number;
  error: string | null;
}

export interface ExtractionScene {
  backend: string;
  footprints: ExtractedFootprint[];
  note: string;
  classifier: ExtractionClassifier;
  zoom: number;
  gsdM: number;
  tileSource: string;
  elapsedS: number;
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
