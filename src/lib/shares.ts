import type { Parcel, Stratum } from "../types";
import { ringAreaM2 } from "./geo";

export interface ShareBreakdown {
  parcelAreaM2: number;
  totalSaleableM2: number;
  totalCommonM2: number;
  sharePct: number;
  undividedLandShareM2: number;
  commonAreaShareM2: number;
  saleableUnits: number;
}

const COMMON_USES = new Set(["common", "structural"]);

export function isSaleable(s: Stratum): boolean {
  if (s.tenure === "common" || s.tenure === "government") return false;
  return !COMMON_USES.has(s.use);
}

export function isCommon(s: Stratum): boolean {
  return s.tenure === "common" || COMMON_USES.has(s.use);
}

/**
 * Undivided share of land, the standard Indian apartment convention: each saleable
 * unit holds a fraction of the parcel proportional to its built-up area, and the
 * same fraction of the building's common areas.
 */
export function shareFor(
  parcel: Parcel,
  strata: Stratum[],
  stratum: Stratum,
): ShareBreakdown | null {
  if (!isSaleable(stratum)) return null;

  const own = strata.filter((s) => s.parcelId === parcel.id);
  const saleable = own.filter(isSaleable);
  const totalSaleableM2 = saleable.reduce((sum, s) => sum + s.builtUpArea, 0);
  if (totalSaleableM2 <= 0) return null;

  const totalCommonM2 = own.filter(isCommon).reduce((sum, s) => sum + s.builtUpArea, 0);
  const parcelAreaM2 = ringAreaM2(parcel.ring);
  const fraction = stratum.builtUpArea / totalSaleableM2;

  return {
    parcelAreaM2: Number(parcelAreaM2.toFixed(1)),
    totalSaleableM2: Number(totalSaleableM2.toFixed(1)),
    totalCommonM2: Number(totalCommonM2.toFixed(1)),
    sharePct: Number((fraction * 100).toFixed(3)),
    undividedLandShareM2: Number((fraction * parcelAreaM2).toFixed(2)),
    commonAreaShareM2: Number((fraction * totalCommonM2).toFixed(2)),
    saleableUnits: saleable.length,
  };
}
