export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

export const OVERPASS_TIMEOUT_MS = 30_000;
export const OVERPASS_RETRIES = 2;

export const MIN_BBOX_SPAN_DEG = 0.011;
export const CACHE_TTL_MS = 5 * 60_000;

export const USER_AGENT = "ulpin3d/0.1 (vertical cadastre prototype)";

export const COPERNICUS_BUCKET = "https://copernicus-dem-30m.s3.amazonaws.com";
export const COPERNICUS_DATASET = "Copernicus GLO-30 DSM (EGM2008 orthometric)";

export const VISION_URL = process.env.VISION_URL || "http://127.0.0.1:5182";
export const VISION_TIMEOUT_MS = 15 * 60_000;
export const EXTRACT_MIN_CONFIDENCE = 0.7;
export const EXTRACT_MATCH_IOU = 0.5;
export const EXTRACT_NOVEL_OVERLAP = 0.2;
export const EXTRACT_INSIDE_COVER = 0.5;

export const DEFAULT_STOREY_HEIGHT_M = 3.2;
export const DEFAULT_BASEMENT_HEIGHT_M = 3.0;
export const MIN_STOREY_HEIGHT_M = 2.6;
export const MAX_STOREY_HEIGHT_M = 4.2;

export const MAX_BUILDINGS_PER_RUN = 60;
