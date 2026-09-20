import type { LngLat } from "./types.js";

const EARTH_R = 6378137;
const DEG = Math.PI / 180;

export function metresBetween(a: LngLat, b: LngLat): number {
  const x = (b[0] - a[0]) * DEG * EARTH_R * Math.cos(((a[1] + b[1]) / 2) * DEG);
  const y = (b[1] - a[1]) * DEG * EARTH_R;
  return Math.hypot(x, y);
}

export function lerpLngLat(a: LngLat, b: LngLat, t: number): LngLat {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function bearingDeg(a: LngLat, b: LngLat): number {
  const x = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * DEG);
  const y = b[1] - a[1];
  const deg = Math.atan2(x, y) / DEG;
  return (deg + 360) % 360;
}

export function offsetMetres(p: LngLat, east: number, north: number): LngLat {
  return [p[0] + east / (DEG * EARTH_R * Math.cos(p[1] * DEG)), p[1] + north / (DEG * EARTH_R)];
}

export function ringCentroid(ring: LngLat[]): LngLat {
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

export function ringAreaM2(ring: LngLat[]): number {
  if (ring.length < 3) return 0;
  const origin = ringCentroid(ring);
  const DEG = Math.PI / 180;
  const R = 6378137;
  const flat = ring.map((p) => [
    (p[0] - origin[0]) * DEG * R * Math.cos(origin[1] * DEG),
    (p[1] - origin[1]) * DEG * R,
  ]);
  let sum = 0;
  for (let i = 0; i < flat.length; i++) {
    const [x0, y0] = flat[i];
    const [x1, y1] = flat[(i + 1) % flat.length];
    sum += x0 * y1 - x1 * y0;
  }
  return Math.abs(sum) / 2;
}

export function bbox(ring: LngLat[]): [number, number, number, number] {
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

export function pointInRing(p: LngLat, ring: LngLat[]): boolean {
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

export function ringsOverlap(a: LngLat[], b: LngLat[]): boolean {
  const [aMinX, aMinY, aMaxX, aMaxY] = bbox(a);
  const [bMinX, bMinY, bMaxX, bMaxY] = bbox(b);
  if (aMaxX < bMinX || bMaxX < aMinX || aMaxY < bMinY || bMaxY < aMinY) return false;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (segmentsIntersect(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
    }
  }
  return pointInRing(a[0], b) || pointInRing(b[0], a);
}

export function rangesOverlap(aMin: number, aMax: number, bMin: number, bMax: number): number {
  return Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
}
