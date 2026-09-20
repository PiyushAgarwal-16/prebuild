import type { LngLat } from "./types.js";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GEOHASH_ALPHABET = "0123456789bcdefghjkmnpqrstuvwxyz";
const M = 36;
const GEOHASH_PRECISION = 11;

export function geohash(lat: number, lng: number, precision: number): string {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let hash = "";
  let bit = 0;
  let idx = 0;
  let even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        idx = idx * 2 + 1;
        lngMin = mid;
      } else {
        idx *= 2;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        idx = idx * 2 + 1;
        latMin = mid;
      } else {
        idx *= 2;
        latMax = mid;
      }
    }
    even = !even;
    if (++bit === 5) {
      hash += GEOHASH_ALPHABET[idx];
      bit = 0;
      idx = 0;
    }
  }
  return hash;
}

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

export function composeUlpin(base: string, band: string, level: number, unit: string): string {
  const lvl = `${band}${String(Math.max(0, Math.min(99, Math.round(level)))).padStart(2, "0")}`;
  const payload = `${base}${lvl}${unit}`;
  return `${base}-${lvl}-${unit}-${checkChar(payload)}`;
}
