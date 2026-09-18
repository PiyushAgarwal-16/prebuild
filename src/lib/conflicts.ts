import type { Conflict, Parcel, Stratum, Tenure } from "../types";
import { overlapAreaM2, ringInsideRing, ringsOverlap } from "./geo";
import { validateUlpin } from "./ulpin";

const EXCLUSIVE: Tenure[] = ["freehold", "leasehold", "government", "air-rights"];

const isExclusive = (t: Tenure) => EXCLUSIVE.includes(t);

export function detectConflicts(parcels: Parcel[], strata: Stratum[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const seen = new Map<string, string>();

  for (const s of strata) {
    if (!validateUlpin(s.ulpin)) {
      conflicts.push({
        id: `invalid-${s.id}`,
        kind: "invalid-ulpin",
        severity: "critical",
        parcelId: s.parcelId,
        subjects: [s.id],
        message: `${s.label} carries a ULPIN that fails checksum validation.`,
      });
    }
    const prior = seen.get(s.ulpin);
    if (prior) {
      conflicts.push({
        id: `dup-${prior}-${s.id}`,
        kind: "duplicate-ulpin",
        severity: "critical",
        parcelId: s.parcelId,
        subjects: [prior, s.id],
        message: `Two volumes share ULPIN ${s.ulpin}.`,
      });
    } else {
      seen.set(s.ulpin, s.id);
    }

    if (s.zMax <= s.zMin) {
      conflicts.push({
        id: `extent-${s.id}`,
        kind: "inverted-extent",
        severity: "warning",
        parcelId: s.parcelId,
        subjects: [s.id],
        message: `${s.label} has a zero or inverted vertical extent.`,
      });
    }

    const parcel = parcels.find((p) => p.id === s.parcelId);
    if (parcel && !ringInsideRing(s.footprint, parcel.ring)) {
      conflicts.push({
        id: `outside-${s.id}`,
        kind: "outside-parcel",
        severity: "critical",
        parcelId: s.parcelId,
        subjects: [s.id],
        message: `${s.label} extends beyond the surface boundary of ${parcel.surveyNumber}.`,
      });
    }
  }

  for (let i = 0; i < strata.length; i++) {
    for (let j = i + 1; j < strata.length; j++) {
      const a = strata[i];
      const b = strata[j];
      if (a.parcelId !== b.parcelId) continue;
      const vertical = Math.min(a.zMax, b.zMax) - Math.max(a.zMin, b.zMin);
      if (vertical <= 0.01) continue;
      if (!ringsOverlap(a.footprint, b.footprint)) continue;
      const area = overlapAreaM2(a.footprint, b.footprint);
      if (area < 0.5) continue;
      const exclusiveClash = isExclusive(a.tenure) && isExclusive(b.tenure);
      conflicts.push({
        id: `overlap-${a.id}-${b.id}`,
        kind: "volume-overlap",
        severity: exclusiveClash ? "critical" : "warning",
        parcelId: a.parcelId,
        subjects: [a.id, b.id],
        message: exclusiveClash
          ? `${a.label} and ${b.label} claim the same ${area.toFixed(0)} m² over ${vertical.toFixed(2)} m of height under exclusive tenure.`
          : `${a.label} (${a.tenure}) overlaps ${b.label} (${b.tenure}) across ${area.toFixed(0)} m² — record as a servitude.`,
      });
    }
  }

  return conflicts;
}

export function conflictsFor(conflicts: Conflict[], stratumId: string): Conflict[] {
  return conflicts.filter((c) => c.subjects.includes(stratumId));
}
