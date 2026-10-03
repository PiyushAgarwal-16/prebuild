import { MAX_STOREY_HEIGHT_M, MIN_STOREY_HEIGHT_M } from "../config.js";
import { overlapAreaM2, rangesOverlap, ringAreaM2 } from "../../geo.js";
import type { DerivedBuilding, Finding, ValidationReport } from "../types.js";

const CONTINUITY_TOLERANCE_M = 0.05;
const ENVELOPE_TOLERANCE_M = 0.5;
const MIN_SHARED_AREA_M2 = 0.5;

function ringIsDegenerate(ring: DerivedBuilding["ring"]): boolean {
  if (ring.length < 3) return true;
  return ringAreaM2(ring) < 1;
}

function selfIntersects(ring: DerivedBuilding["ring"]): boolean {
  const n = ring.length;
  if (n < 4) return false;
  const cross = (a: number[], b: number[], c: number[]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const hits = (p1: number[], q1: number[], p2: number[], q2: number[]) => {
    const d1 = cross(p1, q1, p2);
    const d2 = cross(p1, q1, q2);
    const d3 = cross(p2, q2, p1);
    const d4 = cross(p2, q2, q1);
    return d1 * d2 < 0 && d3 * d4 < 0;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (hits(ring[i], ring[(i + 1) % n], ring[j], ring[(j + 1) % n])) return true;
    }
  }
  return false;
}

export function validateBuilding(building: DerivedBuilding): Finding[] {
  const findings: Finding[] = [];
  const id = building.sourceId;

  if (building.verticalDatum === "undeclared") {
    findings.push({
      code: "datum-undeclared",
      severity: "critical",
      message: "No vertical datum resolved — every elevation on this building is unreferenced.",
      subjects: [id],
    });
  }

  if (ringIsDegenerate(building.ring)) {
    findings.push({
      code: "ring-degenerate",
      severity: "critical",
      message: "Footprint has fewer than three distinct corners or encloses no area.",
      subjects: [id],
    });
  } else if (selfIntersects(building.ring)) {
    findings.push({
      code: "ring-self-intersection",
      severity: "critical",
      message: "Footprint boundary crosses itself, so the extruded solid is not watertight.",
      subjects: [id],
    });
  }

  for (const volume of building.volumes) {
    if (volume.zMax <= volume.zMin) {
      findings.push({
        code: "inverted-extent",
        severity: "critical",
        message: `${volume.label} has a ceiling at or below its floor.`,
        subjects: [volume.ref],
      });
    }
    const height = volume.zMax - volume.zMin;
    if (volume.band === "F" && (height < MIN_STOREY_HEIGHT_M || height > MAX_STOREY_HEIGHT_M)) {
      findings.push({
        code: "implausible-storey",
        severity: "warning",
        message: `${volume.label} is ${height.toFixed(2)} m, outside the plausible storey range.`,
        subjects: [volume.ref],
      });
    }
  }

  const occupied = building.volumes.filter((v) => v.band === "G" || v.band === "F");

  for (let i = 0; i < occupied.length; i++) {
    for (let j = i + 1; j < occupied.length; j++) {
      const a = occupied[i];
      const b = occupied[j];
      const depth = rangesOverlap(a.zMin, a.zMax, b.zMin, b.zMax);
      if (depth <= CONTINUITY_TOLERANCE_M) continue;
      const shared = overlapAreaM2(a.footprint, b.footprint);
      if (shared <= MIN_SHARED_AREA_M2) continue;
      findings.push({
        code: "volume-overlap",
        severity: "critical",
        message: `${a.label} and ${b.label} share ${shared.toFixed(1)} m² of floor over ${depth.toFixed(2)} m of height.`,
        subjects: [a.ref, b.ref],
      });
    }
  }

  const levels = new Map<string, { label: string; zMin: number; zMax: number }>();
  for (const v of occupied) {
    const key = `${v.band}${v.level}`;
    const entry = levels.get(key);
    if (entry) {
      entry.zMin = Math.min(entry.zMin, v.zMin);
      entry.zMax = Math.max(entry.zMax, v.zMax);
    } else {
      levels.set(key, { label: `${v.band}${v.level}`, zMin: v.zMin, zMax: v.zMax });
    }
  }
  const stack = [...levels.values()].sort((a, b) => a.zMin - b.zMin);

  for (let i = 0; i < stack.length - 1; i++) {
    const gap = stack[i + 1].zMin - stack[i].zMax;
    if (Math.abs(gap) <= CONTINUITY_TOLERANCE_M) continue;
    findings.push({
      code: gap > 0 ? "vertical-gap" : "volume-overlap",
      severity: "critical",
      message:
        gap > 0
          ? `${gap.toFixed(2)} m of unassigned space between level ${stack[i].label} and ${stack[i + 1].label}.`
          : `Level ${stack[i].label} and ${stack[i + 1].label} overlap by ${Math.abs(gap).toFixed(2)} m.`,
      subjects: [stack[i].label, stack[i + 1].label],
    });
  }

  if (stack.length) {
    const top = stack[stack.length - 1].zMax;
    const shortfall = building.heightM - top;
    if (Math.abs(shortfall) > ENVELOPE_TOLERANCE_M) {
      findings.push({
        code: "envelope-mismatch",
        severity: "warning",
        message: `Stacked volumes reach ${top.toFixed(2)} m against a ${building.heightM.toFixed(2)} m envelope.`,
        subjects: [id],
      });
    }
  }

  if (building.heightSource === "assumed") {
    findings.push({
      code: "height-assumed",
      severity: "warning",
      message: "Neither height nor storey count is recorded in the source; a single storey was assumed.",
      subjects: [id],
    });
  }

  return findings;
}

export function validateAll(buildings: DerivedBuilding[]): ValidationReport {
  const findings = buildings.flatMap(validateBuilding);
  return {
    ok: !findings.some((f) => f.severity === "critical"),
    checked: buildings.length,
    findings,
  };
}
