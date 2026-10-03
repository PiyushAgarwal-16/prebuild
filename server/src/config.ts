import type { LngLat } from "./types.js";

export const PORT = Number(process.env.LIVE_PORT || 5181);

export const ORIGIN: LngLat = [77.5946, 12.9716];

export const TICK_MS = 250;

export const GNSS_EVERY_TICKS = 4;
export const IMAGERY_EVERY_TICKS = 40;
export const HEARTBEAT_EVERY_TICKS = 20;

export const SYNTHETIC = process.env.LIVE_NTRIP_URL === undefined;

export const STATIONS = [
  { id: "KABG", name: "Bengaluru CORS — Cubbon", offset: [-0.0071, 0.0042], height: 921.4 },
  { id: "KAJN", name: "Jayanagar CORS", offset: [0.0036, -0.0088], height: 913.2 },
  { id: "KAWF", name: "Whitefield CORS", offset: [0.0124, 0.0031], height: 907.8 },
  { id: "KAYL", name: "Yelahanka CORS", offset: [-0.0042, 0.0139], height: 930.6 },
] as const;

export const SURVEY_ROUTE: LngLat[] = [
  [77.59398, 12.97094],
  [77.59512, 12.97094],
  [77.59512, 12.97218],
  [77.59398, 12.97218],
];

export const IMAGERY_LAYERS = [
  { id: "ortho-drone", label: "Drone orthomosaic", gsdCm: 3.4 },
  { id: "sat-basemap", label: "Satellite basemap", gsdCm: 46 },
] as const;
