import type { LevelBand, LngLat, UlpinParts } from "../types";
import { geohash, geohashDecode } from "./geo";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const M = 36;
const GEOHASH_PRECISION = 11;
export const BASE_LENGTH = 14;

export const BAND_LABEL: Record<LevelBand, string> = {
  S: "Subsurface",
  B: "Basement",
  G: "Ground",
  F: "Floor",
  A: "Airspace",
  E: "Elevated",
};

export const BAND_ORDER: LevelBand[] = ["S", "B", "G", "F", "A", "E"];

function charValue(ch: string): number {
  const v = ALPHABET.indexOf(ch.toUpperCase());
  return v < 0 ? 0 : v;
}

export function checkChar(payload: string): string {
  let p = M;
  for (const ch of payload.replace(/[^0-9A-Za-z]/g, "")) {
    const s = (p % (M + 1)) + charValue(ch);
    let m = s % M;
    if (m === 0) m = M;
    p = 2 * m;
  }
  return ALPHABET[(M + 1 - (p % (M + 1))) % M];
}

export function generateBase(stateCode: string, centroid: LngLat): string {
  const state = stateCode.replace(/\D/g, "").padStart(2, "0").slice(-2);
  const cell = geohash(centroid[1], centroid[0], GEOHASH_PRECISION).toUpperCase();
  const payload = `${state}${cell}`;
  return `${payload}${checkChar(payload)}`;
}

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

export function levelCode(band: LevelBand, level: number): string {
  const n = Math.max(0, Math.min(99, Math.round(level)));
  return `${band}${String(n).padStart(2, "0")}`;
}

export function unitCode(index: number): string {
  const n = Math.max(0, Math.min(46655, Math.round(index)));
  return n.toString(36).toUpperCase().padStart(3, "0");
}

export function composeUlpin(base: string, band: LevelBand, level: number, unit: string): string {
  const payload = `${base}-${levelCode(band, level)}-${unit.toUpperCase().padStart(3, "0").slice(0, 3)}`;
  return `${payload}-${checkChar(payload)}`;
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

export function describeUlpin(value: string): string {
  const parts = parseUlpin(value);
  if (!parts) return "Not a valid 3D ULPIN";
  return `${describeLevel(parts.band, parts.level)} · unit ${parts.unit}`;
}

export function nextUnit(taken: string[]): string {
  const used = new Set(taken.map((u) => u.toUpperCase()));
  for (let i = 1; i < 46656; i++) {
    const code = unitCode(i);
    if (!used.has(code)) return code;
  }
  return "ZZZ";
}
