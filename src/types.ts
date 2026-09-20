export type LngLat = [number, number];
export type Ring = LngLat[];
export type Vec3 = [number, number, number];
export type BasemapId = "street" | "satellite";
export type UlpinSource = "generated" | "declared";

export type LevelBand = "S" | "B" | "G" | "F" | "A" | "E";

export type StratumUse =
  | "residential"
  | "commercial"
  | "parking"
  | "utility"
  | "transport"
  | "airspace"
  | "common"
  | "structural";

export type Tenure =
  | "freehold"
  | "leasehold"
  | "easement"
  | "air-rights"
  | "government"
  | "common";

export interface Jurisdiction {
  stateCode: string;
  stateName: string;
  districtCode: string;
  districtName: string;
  villageCode: string;
  villageName: string;
}

export interface Parcel {
  id: string;
  ulpinBase: string;
  ulpinSource: UlpinSource;
  ring: Ring;
  surveyNumber: string;
  jurisdiction: Jurisdiction;
  groundElevation: number;
  landUse: string;
  holder: string;
  registeredOn: string;
}

export interface Stratum {
  id: string;
  parcelId: string;
  ulpin: string;
  label: string;
  band: LevelBand;
  level: number;
  unit: string;
  footprint: Ring;
  zMin: number;
  zMax: number;
  use: StratumUse;
  tenure: Tenure;
  holder: string;
  carpetArea: number;
  builtUpArea: number;
  registeredOn: string;
  encumbrance?: string;
}

export type ConflictKind =
  | "volume-overlap"
  | "outside-parcel"
  | "duplicate-ulpin"
  | "invalid-ulpin"
  | "inverted-extent";

export interface Conflict {
  id: string;
  kind: ConflictKind;
  severity: "critical" | "warning";
  parcelId: string;
  subjects: string[];
  message: string;
}

export interface UlpinParts {
  base: string;
  band: LevelBand;
  level: number;
  unit: string;
  check: string;
}
