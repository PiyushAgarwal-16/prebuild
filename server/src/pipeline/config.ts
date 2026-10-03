export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

export const OVERPASS_TIMEOUT_MS = 30_000;
export const OVERPASS_RETRIES = 2;

export const MIN_BBOX_SPAN_DEG = 0.011;
export const CACHE_TTL_MS = 5 * 60_000;

export const USER_AGENT = "ulpin3d/0.1 (vertical cadastre prototype)";

export const TERRAIN_ENDPOINT = "https://api.opentopodata.org/v1";
export const TERRAIN_DATASET = process.env.TERRAIN_DATASET || "aster30m";

export const DEFAULT_STOREY_HEIGHT_M = 3.2;
export const DEFAULT_BASEMENT_HEIGHT_M = 3.0;
export const MIN_STOREY_HEIGHT_M = 2.6;
export const MAX_STOREY_HEIGHT_M = 4.2;

export const MAX_BUILDINGS_PER_RUN = 60;
