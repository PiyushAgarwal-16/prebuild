export { geohash, geohashDecode } from "../../shared/ulpin-core";
import polygonClipping from "polygon-clipping";
import turfArea from "@turf/area";
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

function closed(ring: Ring): Ring {
  if (ring.length < 3) return ring;
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  return fx === lx && fy === ly ? ring : [...ring, ring[0]];
}

export function ringAreaM2(ring: Ring): number {
  if (ring.length < 3) return 0;
  return turfArea({
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [closed(ring)] },
  });
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

/**
 * Area of `inner` that falls outside `outer`. Measured rather than tested
 * vertex-by-vertex: a footprint that coincides with its parcel boundary has
 * every vertex *on* the edge, which a strict point-in-ring test rejects.
 */
export function outsideAreaM2(inner: Ring, outer: Ring): number {
  if (inner.length < 3 || outer.length < 3) return 0;
  const pieces = polygonClipping.difference([closed(inner)], [closed(outer)]);
  if (!pieces.length) return 0;
  return turfArea({
    type: "Feature",
    properties: {},
    geometry: { type: "MultiPolygon", coordinates: pieces },
  });
}

export function overlapAreaM2(a: Ring, b: Ring): number {
  if (a.length < 3 || b.length < 3) return 0;
  if (!ringsOverlap(a, b)) return 0;
  const pieces = polygonClipping.intersection([closed(a)], [closed(b)]);
  if (!pieces.length) return 0;
  return turfArea({
    type: "Feature",
    properties: {},
    geometry: { type: "MultiPolygon", coordinates: pieces },
  });
}

export function scaleRing(ring: Ring, factor: number, shift: [number, number] = [0, 0]): Ring {
  const c = ringCentroid(ring);
  const origin = c;
  return ring.map((p) => {
    const [x, z] = project(origin, p);
    return unproject(origin, x * factor + shift[0], z * factor + shift[1]);
  });
}





export function formatArea(m2: number): string {
  if (m2 >= 10000) return `${(m2 / 10000).toFixed(3)} ha`;
  return `${m2.toFixed(1)} m²`;
}

export function formatLngLat(p: LngLat): string {
  return `${p[1].toFixed(6)}°N, ${p[0].toFixed(6)}°E`;
}
