import type { LevelBand, LngLat, Parcel, Ring, StratumUse, Tenure } from "../types";
import type { StratumInput } from "../store/registry";
import { outsideAreaM2, project, ringAreaM2, ringCentroid, unproject } from "./geo";

export type PlanUnitKind =
  | "apartment"
  | "commercial"
  | "common"
  | "circulation"
  | "service"
  | "parking";

export interface PlanUnit {
  label: string;
  kind: PlanUnitKind;
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface FloorPlan {
  buildingW: number;
  buildingD: number;
  storeyHeight: number;
  units: PlanUnit[];
}

export interface PlacementOptions {
  band: LevelBand;
  level: number;
  rotationDeg: number;
  zMin: number;
  scale: number;
  holder: string;
}

const KIND_MAPPING: Record<PlanUnitKind, { use: StratumUse; tenure: Tenure }> = {
  apartment: { use: "residential", tenure: "freehold" },
  commercial: { use: "commercial", tenure: "leasehold" },
  common: { use: "common", tenure: "common" },
  circulation: { use: "common", tenure: "common" },
  service: { use: "utility", tenure: "common" },
  parking: { use: "parking", tenure: "common" },
};

const KINDS = Object.keys(KIND_MAPPING) as PlanUnitKind[];

export const EXTRACTION_PROMPT = `You are a cadastral surveyor digitising a building floor plan for a 3D land register.

Identify every separately owned or separately managed space on this floor: apartments, shops, offices, lift and stair cores, corridors, service rooms, parking bays.

COORDINATE SYSTEM: metres, origin at the CENTRE of the building footprint, +X east (right in the image), +Z south (down in the image). Report each space as an axis-aligned rectangle by its centre and size.

Respond with STRICT JSON only, no prose and no code fences:
{
  "buildingW": <overall width in metres>,
  "buildingD": <overall depth in metres>,
  "storeyHeight": <floor-to-floor height in metres, 3.2 if unknown>,
  "units": [
    { "label": "Flat 1A", "kind": "apartment|commercial|common|circulation|service|parking", "x": n, "z": n, "w": n, "d": n }
  ]
}

Rules: every unit rectangle must lie inside the building footprint; units must not overlap each other; use the labels printed on the plan where legible, otherwise number them sequentially.`;

function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && isFinite(n) ? n : fallback;
}

export function normalizePlan(raw: unknown): FloorPlan {
  const src = (raw ?? {}) as Record<string, unknown>;
  const rawUnits = Array.isArray(src.units) ? src.units : [];
  const units: PlanUnit[] = [];

  rawUnits.forEach((entry, i) => {
    const u = (entry ?? {}) as Record<string, unknown>;
    const w = Math.abs(num(u.w, 0));
    const d = Math.abs(num(u.d, 0));
    if (w < 0.3 || d < 0.3) return;
    const kind = typeof u.kind === "string" && KINDS.includes(u.kind as PlanUnitKind)
      ? (u.kind as PlanUnitKind)
      : "apartment";
    const label = typeof u.label === "string" && u.label.trim() ? u.label.trim() : `Unit ${i + 1}`;
    units.push({ label, kind, x: num(u.x, 0), z: num(u.z, 0), w, d });
  });

  const spanW = units.reduce((m, u) => Math.max(m, Math.abs(u.x) + u.w / 2), 0) * 2;
  const spanD = units.reduce((m, u) => Math.max(m, Math.abs(u.z) + u.d / 2), 0) * 2;

  return {
    buildingW: Math.max(num(src.buildingW, 0), spanW, 1),
    buildingD: Math.max(num(src.buildingD, 0), spanD, 1),
    storeyHeight: Math.min(Math.max(num(src.storeyHeight, 3.2), 2), 12),
    units,
  };
}

export function placeOnParcel(centre: LngLat, x: number, z: number, rotationDeg: number): LngLat {
  const t = (rotationDeg * Math.PI) / 180;
  return unproject(centre, x * Math.cos(t) - z * Math.sin(t), x * Math.sin(t) + z * Math.cos(t));
}

export function unitRing(
  centre: LngLat,
  unit: PlanUnit,
  { rotationDeg, scale }: { rotationDeg: number; scale: number },
): Ring {
  const hw = (unit.w * scale) / 2;
  const hd = (unit.d * scale) / 2;
  const cx = unit.x * scale;
  const cz = unit.z * scale;
  return [
    [cx - hw, cz - hd],
    [cx + hw, cz - hd],
    [cx + hw, cz + hd],
    [cx - hw, cz + hd],
  ].map(([x, z]) => placeOnParcel(centre, x, z, rotationDeg));
}

export function fitScale(plan: FloorPlan, parcel: Parcel): number {
  const centre = ringCentroid(parcel.ring);
  const flat = parcel.ring.map((p) => project(centre, p));
  const width = Math.max(...flat.map((p) => p[0])) - Math.min(...flat.map((p) => p[0]));
  const depth = Math.max(...flat.map((p) => p[1])) - Math.min(...flat.map((p) => p[1]));
  const margin = 0.88;
  return Math.min((width * margin) / plan.buildingW, (depth * margin) / plan.buildingD, 1);
}

export function planToStrata(
  plan: FloorPlan,
  parcel: Parcel,
  opts: PlacementOptions,
): { inputs: StratumInput[]; outside: number } {
  const centre = ringCentroid(parcel.ring);
  const height = plan.storeyHeight;
  let outside = 0;

  const inputs = plan.units.map((unit) => {
    const footprint = unitRing(centre, unit, opts);
    if (outsideAreaM2(footprint, parcel.ring) > Math.max(1, ringAreaM2(footprint) * 0.01)) outside++;
    const mapping = KIND_MAPPING[unit.kind];
    return {
      parcelId: parcel.id,
      label: unit.label,
      band: opts.band,
      level: opts.level,
      footprint,
      zMin: opts.zMin,
      zMax: opts.zMin + height,
      use: mapping.use,
      tenure: mapping.tenure,
      holder: opts.holder,
    } satisfies StratumInput;
  });

  return { inputs, outside };
}

export const SAMPLE_PLAN: FloorPlan = {
  buildingW: 34,
  buildingD: 26,
  storeyHeight: 3.2,
  units: [
    { label: "Flat A", kind: "apartment", x: -10.5, z: -6.5, w: 14, d: 12 },
    { label: "Flat B", kind: "apartment", x: 10.5, z: -6.5, w: 14, d: 12 },
    { label: "Flat C", kind: "apartment", x: -10.5, z: 6.5, w: 14, d: 12 },
    { label: "Flat D", kind: "apartment", x: 10.5, z: 6.5, w: 14, d: 12 },
    { label: "Lift & stair core", kind: "circulation", x: 0, z: 0, w: 5, d: 9 },
    { label: "Services duct", kind: "service", x: 0, z: -9.5, w: 5, d: 4 },
  ],
};
