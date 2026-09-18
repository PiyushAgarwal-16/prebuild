import type { LngLat, Ring } from "../types";

const EARTH_R = 6378137;
const DEG = Math.PI / 180;

export function project(origin: LngLat, p: LngLat): [number, number] {
  const x = (p[0] - origin[0]) * DEG * EARTH_R * Math.cos(origin[1] * DEG);
  const z = -(p[1] - origin[1]) * DEG * EARTH_R;
  return [x, z];
}

export function unproject(origin: LngLat, x: number, z: number): LngLat {
  const lng = origin[0] + x / (DEG * EARTH_R * Math.cos(origin[1] * DEG));
  const lat = origin[1] - z / (DEG * EARTH_R);
  return [lng, lat];
}

export function projectRing(origin: LngLat, ring: Ring): [number, number][] {
  return ring.map((p) => project(origin, p));
}

export function ringCentroid(ring: Ring): LngLat {
  const n = ring.length;
  if (!n) return [0, 0];
  const mean: LngLat = [
    ring.reduce((s, p) => s + p[0], 0) / n,
    ring.reduce((s, p) => s + p[1], 0) / n,
  ];
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const x0 = ring[i][0] - mean[0];
    const y0 = ring[i][1] - mean[1];
    const x1 = ring[(i + 1) % n][0] - mean[0];
    const y1 = ring[(i + 1) % n][1] - mean[1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (Math.abs(area) < 1e-18) return mean;
  return [cx / (3 * area) + mean[0], cy / (3 * area) + mean[1]];
}

export function ringAreaM2(ring: Ring): number {
  if (ring.length < 3) return 0;
  const origin = ringCentroid(ring);
  const flat = projectRing(origin, ring);
  let sum = 0;
  for (let i = 0; i < flat.length; i++) {
    const [x0, z0] = flat[i];
    const [x1, z1] = flat[(i + 1) % flat.length];
    sum += x0 * z1 - x1 * z0;
  }
  return Math.abs(sum) / 2;
}

export function bbox(ring: Ring): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

export function pointInRing(p: LngLat, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const straddles = yi > p[1] !== yj > p[1];
    if (straddles && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function orientation(a: LngLat, b: LngLat, c: LngLat): number {
  const v = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (Math.abs(v) < 1e-14) return 0;
  return v > 0 ? 1 : 2;
}

function onSegment(a: LngLat, b: LngLat, c: LngLat): boolean {
  return (
    b[0] <= Math.max(a[0], c[0]) &&
    b[0] >= Math.min(a[0], c[0]) &&
    b[1] <= Math.max(a[1], c[1]) &&
    b[1] >= Math.min(a[1], c[1])
  );
}

export function segmentsIntersect(p1: LngLat, q1: LngLat, p2: LngLat, q2: LngLat): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

export function ringsOverlap(a: Ring, b: Ring): boolean {
  const [aMinX, aMinY, aMaxX, aMaxY] = bbox(a);
  const [bMinX, bMinY, bMaxX, bMaxY] = bbox(b);
  if (aMaxX < bMinX || bMaxX < aMinX || aMaxY < bMinY || bMaxY < aMinY) return false;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      const a1 = a[i];
      const a2 = a[(i + 1) % a.length];
      const b1 = b[j];
      const b2 = b[(j + 1) % b.length];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return pointInRing(a[0], b) || pointInRing(b[0], a);
}

export function ringInsideRing(inner: Ring, outer: Ring): boolean {
  return inner.every((p) => pointInRing(p, outer));
}

export function overlapAreaM2(a: Ring, b: Ring, samples = 60): number {
  if (!ringsOverlap(a, b)) return 0;
  const [minX, minY, maxX, maxY] = bbox(a);
  const stepX = (maxX - minX) / samples;
  const stepY = (maxY - minY) / samples;
  if (stepX <= 0 || stepY <= 0) return 0;
  let hits = 0;
  for (let i = 0; i < samples; i++) {
    for (let j = 0; j < samples; j++) {
      const p: LngLat = [minX + (i + 0.5) * stepX, minY + (j + 0.5) * stepY];
      if (pointInRing(p, a) && pointInRing(p, b)) hits++;
    }
  }
  const cellArea = ringAreaM2([
    [minX, minY],
    [minX + stepX, minY],
    [minX + stepX, minY + stepY],
    [minX, minY + stepY],
  ]);
  return hits * cellArea;
}

export function scaleRing(ring: Ring, factor: number, shift: [number, number] = [0, 0]): Ring {
  const c = ringCentroid(ring);
  const origin = c;
  return ring.map((p) => {
    const [x, z] = project(origin, p);
    return unproject(origin, x * factor + shift[0], z * factor + shift[1]);
  });
}

export function rectRing(center: LngLat, widthM: number, depthM: number): Ring {
  const hw = widthM / 2;
  const hd = depthM / 2;
  return [
    unproject(center, -hw, -hd),
    unproject(center, hw, -hd),
    unproject(center, hw, hd),
    unproject(center, -hw, hd),
  ];
}

const GEOHASH_ALPHABET = "0123456789bcdefghjkmnpqrstuvwxyz";

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

export function geohashDecode(hash: string): LngLat {
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

export function formatArea(m2: number): string {
  if (m2 >= 10000) return `${(m2 / 10000).toFixed(3)} ha`;
  return `${m2.toFixed(1)} m²`;
}

export function formatLngLat(p: LngLat): string {
  return `${p[1].toFixed(6)}°N, ${p[0].toFixed(6)}°E`;
}
