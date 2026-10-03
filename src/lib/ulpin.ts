export { BASE_LENGTH, checkChar, composeUlpin, generateBase, levelCode } from "../../shared/ulpin-core";
import { BASE_LENGTH, checkChar } from "../../shared/ulpin-core";
import type { LevelBand, LngLat, UlpinParts } from "../types";
import { geohashDecode } from "./geo";


export const BAND_LABEL: Record<LevelBand, string> = {
  S: "Subsurface",
  B: "Basement",
  G: "Ground",
  F: "Floor",
  A: "Airspace",
  E: "Elevated",
};

export const BAND_ORDER: LevelBand[] = ["S", "B", "G", "F", "A", "E"];




export function validateBase(base: string): boolean {
  const clean = base.trim().toUpperCase();
  if (clean.length !== BASE_LENGTH) return false;
  if (!/^[0-9A-Z]+$/.test(clean)) return false;
  return checkChar(clean.slice(0, BASE_LENGTH - 1)) === clean[BASE_LENGTH - 1];
}

export function baseCentroid(base: string): LngLat | null {
  if (!validateBase(base)) return null;
  return geohashDecode(base.slice(2, BASE_LENGTH - 1));
}


export function unitCode(index: number): string {
  const n = Math.max(0, Math.min(46655, Math.round(index)));
  return n.toString(36).toUpperCase().padStart(3, "0");
}


export function parseUlpin(value: string): UlpinParts | null {
  const clean = value.trim().toUpperCase();
  const match = /^([0-9A-Z]{14})-([SBGFAE])(\d{2})-([0-9A-Z]{3})-([0-9A-Z])$/.exec(clean);
  if (!match) return null;
  return {
    base: match[1],
    band: match[2] as LevelBand,
    level: Number(match[3]),
    unit: match[4],
    check: match[5],
  };
}

export function validateUlpin(value: string): boolean {
  const parts = parseUlpin(value);
  if (!parts) return false;
  if (!validateBase(parts.base)) return false;
  const payload = value.trim().toUpperCase().slice(0, -2);
  return checkChar(payload) === parts.check;
}

export function describeLevel(band: LevelBand, level: number): string {
  if (band === "G") return "Ground level";
  if (band === "F") return `Floor ${level}`;
  if (band === "B") return `Basement ${level}`;
  if (band === "S") return `Subsurface band ${level}`;
  if (band === "A") return `Airspace band ${level}`;
  return `Elevated corridor ${level}`;
}


export function nextUnit(taken: string[]): string {
  const used = new Set(taken.map((u) => u.toUpperCase()));
  for (let i = 1; i < 46656; i++) {
    const code = unitCode(i);
    if (!used.has(code)) return code;
  }
  return "ZZZ";
}
