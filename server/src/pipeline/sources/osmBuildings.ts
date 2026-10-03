import {
  CACHE_TTL_MS,
  MAX_BUILDINGS_PER_RUN,
  OVERPASS_ENDPOINTS,
  OVERPASS_RETRIES,
  OVERPASS_TIMEOUT_MS,
  USER_AGENT,
} from "../config.js";
import type { BoundingBox, Ring, SourceBuilding } from "../types.js";

const ATTRIBUTION = "© OpenStreetMap contributors (ODbL)";

interface OverpassWay {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

function query(bbox: BoundingBox): string {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  return `[out:json][timeout:60];way["building"](${box});out geom ${MAX_BUILDINGS_PER_RUN};`;
}

function parseLength(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^([0-9]+(?:\.[0-9]+)?)\s*(m|metre|meters)?$/i.exec(value.trim());
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseCount(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number.parseInt(value.trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function toRing(geometry: { lat: number; lon: number }[]): Ring {
  const ring: Ring = geometry.map((p) => [p.lon, p.lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (ring.length > 1 && first[0] === last[0] && first[1] === last[1]) ring.pop();
  return ring;
}

const cache = new Map<string, { at: number; buildings: SourceBuilding[] }>();

function cacheKey(bbox: BoundingBox): string {
  return [bbox.south, bbox.west, bbox.north, bbox.east].map((n) => n.toFixed(4)).join(",");
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchBuildings(bbox: BoundingBox): Promise<SourceBuilding[]> {
  const key = cacheKey(bbox);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.buildings;

  const body = new URLSearchParams({ data: query(bbox) });
  const failures: string[] = [];

  for (let attempt = 0; attempt < OVERPASS_RETRIES; attempt++) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      const host = new URL(endpoint).host;
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
          body,
          signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
        });
        if (!res.ok) {
          failures.push(`${host} ${res.status}`);
          continue;
        }
        const payload = (await res.json()) as { elements?: OverpassWay[] };
        const elements = payload.elements ?? [];
        const buildings = elements
        .filter((e) => e.type === "way" && Array.isArray(e.geometry) && e.geometry.length >= 4)
        .map((e) => {
          const tags = e.tags ?? {};
          return {
            sourceId: `osm-way-${e.id}`,
            source: "osm" as const,
            name: tags.name ?? null,
            ring: toRing(e.geometry!),
            levels: parseCount(tags["building:levels"]),
            levelsBelow: parseCount(tags["building:levels:underground"]),
            heightM: parseLength(tags.height) ?? parseLength(tags["building:height"]),
            buildingTag: tags.building ?? "yes",
            amenity: tags.amenity ?? tags.office ?? tags.shop ?? null,
            attribution: ATTRIBUTION,
          };
        })
          .filter((b) => b.ring.length >= 3);
        cache.set(key, { at: Date.now(), buildings });
        return buildings;
      } catch (err) {
        const reason = err instanceof Error && err.name === "TimeoutError" ? "timeout" : "unreachable";
        failures.push(`${host} ${reason}`);
      }
    }
    if (attempt < OVERPASS_RETRIES - 1) await wait(1500);
  }

  throw new Error(
    `OpenStreetMap is not responding. Tried ${failures.join(", ")}. The public Overpass servers throttle under load — wait a few seconds and run again.`,
  );
}
