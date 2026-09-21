/**
 * The ULPIN minting algorithm. Shared verbatim by the browser and the register
 * server so that an identifier issued by either is identical.
 */

export type CorePoint = [number, number];

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GEOHASH_ALPHABET = "0123456789bcdefghjkmnpqrstuvwxyz";
const M = 36;

export const GEOHASH_PRECISION = 11;
export const BASE_LENGTH = 14;

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

export function geohashDecode(hash: string): CorePoint {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let even = true;
  for (const ch of hash.toLowerCase()) {
    const idx = GEOHASH_ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    for (let b = 4; b >= 0; b--) {
      const bitOn = (idx >> b) & 1;
      if (even) {
        const mid = (lngMin + lngMax) / 2;
        if (bitOn) lngMin = mid;
        else lngMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (bitOn) latMin = mid;
        else latMax = mid;
      }
      even = !even;
    }
  }
  return [(lngMin + lngMax) / 2, (latMin + latMax) / 2];
}

function charValue(ch: string): number {
  const v = ALPHABET.indexOf(ch.toUpperCase());
  return v < 0 ? 0 : v;
}

/** ISO 7064 MOD 37,36 */
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

export function generateBase(stateCode: string, centroid: CorePoint): string {
  const state = stateCode.replace(/\D/g, "").padStart(2, "0").slice(-2);
  const cell = geohash(centroid[1], centroid[0], GEOHASH_PRECISION).toUpperCase();
  const payload = `${state}${cell}`;
  return `${payload}${checkChar(payload)}`;
}

export function levelCode(band: string, level: number): string {
  return `${band}${String(Math.max(0, Math.min(99, Math.round(level)))).padStart(2, "0")}`;
}

export function composeUlpin(base: string, band: string, level: number, unit: string): string {
  const lvl = levelCode(band, level);
  return `${base}-${lvl}-${unit}-${checkChar(`${base}${lvl}${unit}`)}`;
}
