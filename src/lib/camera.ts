import type { LngLat } from "../types";
import { project, unproject } from "./geo";

export const SCENE_FOV = 44;
export const MAX_PITCH = 85;

const EQUATOR_MPP = 156543.03392;
const DEG = Math.PI / 180;

export interface MapCamera {
  center: LngLat;
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface OrbitCamera {
  target: [number, number, number];
  position: [number, number, number];
}

export function metresPerPixel(lat: number, zoom: number): number {
  return (EQUATOR_MPP * Math.cos(lat * DEG)) / 2 ** zoom;
}

export function zoomForMetresPerPixel(lat: number, mpp: number): number {
  return Math.log2((EQUATOR_MPP * Math.cos(lat * DEG)) / Math.max(mpp, 1e-6));
}

export function distanceForZoom(lat: number, zoom: number, heightPx: number, fovDeg = SCENE_FOV): number {
  const span = metresPerPixel(lat, zoom) * heightPx;
  return span / 2 / Math.tan((fovDeg / 2) * DEG);
}

export function zoomForDistance(lat: number, distance: number, heightPx: number, fovDeg = SCENE_FOV): number {
  const span = 2 * distance * Math.tan((fovDeg / 2) * DEG);
  return zoomForMetresPerPixel(lat, span / Math.max(heightPx, 1));
}

export function mapToOrbit(
  camera: MapCamera,
  origin: LngLat,
  groundY: number,
  heightPx: number,
  fovDeg = SCENE_FOV,
): OrbitCamera {
  const [tx, tz] = project(origin, camera.center);
  const distance = distanceForZoom(camera.center[1], camera.zoom, heightPx, fovDeg);
  const polar = Math.min(MAX_PITCH, Math.max(0, camera.pitch)) * DEG;
  const azimuth = (camera.bearing + 180) * DEG;
  const horizontal = distance * Math.sin(polar);
  return {
    target: [tx, groundY, tz],
    position: [
      tx + horizontal * Math.sin(azimuth),
      groundY + distance * Math.cos(polar),
      tz - horizontal * Math.cos(azimuth),
    ],
  };
}

export function orbitToMap(
  orbit: OrbitCamera,
  origin: LngLat,
  heightPx: number,
  fovDeg = SCENE_FOV,
): MapCamera {
  const dx = orbit.position[0] - orbit.target[0];
  const dy = orbit.position[1] - orbit.target[1];
  const dz = orbit.position[2] - orbit.target[2];
  const distance = Math.max(Math.hypot(dx, dy, dz), 1);
  const center = unproject(origin, orbit.target[0], orbit.target[2]);
  const pitch = Math.min(MAX_PITCH, Math.acos(Math.min(1, Math.max(-1, dy / distance))) / DEG);
  const bearing = ((Math.atan2(dx, -dz) / DEG - 180) % 360 + 540) % 360 - 180;
  return {
    center,
    zoom: zoomForDistance(center[1], distance, heightPx, fovDeg),
    pitch,
    bearing,
  };
}

export function cameraChanged(a: MapCamera, b: MapCamera): boolean {
  return (
    Math.abs(a.center[0] - b.center[0]) > 1e-7 ||
    Math.abs(a.center[1] - b.center[1]) > 1e-7 ||
    Math.abs(a.zoom - b.zoom) > 0.004 ||
    Math.abs(a.pitch - b.pitch) > 0.05 ||
    Math.abs(a.bearing - b.bearing) > 0.05
  );
}
