import type { FloorPlan, PlanUnit } from "./plan";

export type PlanFindingCode = "unit-degenerate" | "unit-outside" | "unit-overlap";

export interface PlanFinding {
  code: PlanFindingCode;
  severity: "critical" | "warning";
  message: string;
  units: number[];
}

export interface PlanReport {
  findings: PlanFinding[];
  invalid: Set<number>;
  ok: boolean;
  coverage: number;
}

const EPS = 0.01;
const MIN_SIDE = 0.2;

export function unitBounds(u: PlanUnit) {
  return {
    minX: u.x - u.w / 2,
    maxX: u.x + u.w / 2,
    minZ: u.z - u.d / 2,
    maxZ: u.z + u.d / 2,
  };
}

export function overlapArea(a: PlanUnit, b: PlanUnit): number {
  const ab = unitBounds(a);
  const bb = unitBounds(b);
  const w = Math.min(ab.maxX, bb.maxX) - Math.max(ab.minX, bb.minX);
  const d = Math.min(ab.maxZ, bb.maxZ) - Math.max(ab.minZ, bb.minZ);
  return w > EPS && d > EPS ? w * d : 0;
}

export function validatePlan(plan: FloorPlan): PlanReport {
  const findings: PlanFinding[] = [];
  const invalid = new Set<number>();
  const halfW = plan.buildingW / 2;
  const halfD = plan.buildingD / 2;

  plan.units.forEach((u, i) => {
    if (u.w < MIN_SIDE || u.d < MIN_SIDE) {
      findings.push({
        code: "unit-degenerate",
        severity: "critical",
        message: `${u.label} is smaller than ${MIN_SIDE} m on one side.`,
        units: [i],
      });
      invalid.add(i);
      return;
    }
    const b = unitBounds(u);
    if (b.minX < -halfW - EPS || b.maxX > halfW + EPS || b.minZ < -halfD - EPS || b.maxZ > halfD + EPS) {
      findings.push({
        code: "unit-outside",
        severity: "critical",
        message: `${u.label} extends beyond the building footprint.`,
        units: [i],
      });
      invalid.add(i);
    }
  });

  for (let i = 0; i < plan.units.length; i++) {
    for (let j = i + 1; j < plan.units.length; j++) {
      const area = overlapArea(plan.units[i], plan.units[j]);
      if (area <= EPS) continue;
      findings.push({
        code: "unit-overlap",
        severity: "critical",
        message: `${plan.units[i].label} overlaps ${plan.units[j].label} by ${area.toFixed(2)} m².`,
        units: [i, j],
      });
      invalid.add(i);
      invalid.add(j);
    }
  }

  const footprint = plan.buildingW * plan.buildingD;
  const assigned = plan.units.reduce((sum, u) => sum + u.w * u.d, 0);

  return {
    findings,
    invalid,
    ok: findings.every((f) => f.severity !== "critical"),
    coverage: footprint > 0 ? assigned / footprint : 0,
  };
}

export function clampToFootprint(unit: PlanUnit, plan: FloorPlan): PlanUnit {
  const halfW = plan.buildingW / 2;
  const halfD = plan.buildingD / 2;
  const w = Math.min(unit.w, plan.buildingW);
  const d = Math.min(unit.d, plan.buildingD);
  return {
    ...unit,
    w,
    d,
    x: Math.min(halfW - w / 2, Math.max(-halfW + w / 2, unit.x)),
    z: Math.min(halfD - d / 2, Math.max(-halfD + d / 2, unit.z)),
  };
}

export const snap = (v: number, step = 0.1) => Math.round(v / step) * step;
