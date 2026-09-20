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
