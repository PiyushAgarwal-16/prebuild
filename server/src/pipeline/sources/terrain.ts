import { TERRAIN_DATASET, TERRAIN_ENDPOINT, USER_AGENT } from "../config.js";
import type { LngLat } from "../../types.js";
import type { TerrainSample } from "../types.js";

interface TerrainResponse {
  status?: string;
  results?: { elevation: number | null; location: { lat: number; lng: number } }[];
}

export async function sampleTerrain(points: LngLat[]): Promise<TerrainSample[]> {
  if (!points.length) return [];
  const batches: LngLat[][] = [];
  for (let i = 0; i < points.length; i += 90) batches.push(points.slice(i, i + 90));

  const samples: TerrainSample[] = [];
  for (const batch of batches) {
    const locations = batch.map(([lng, lat]) => `${lat.toFixed(6)},${lng.toFixed(6)}`).join("|");
    try {
      const res = await fetch(`${TERRAIN_ENDPOINT}/${TERRAIN_DATASET}?locations=${locations}`, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`terrain service returned ${res.status}`);
      const payload = (await res.json()) as TerrainResponse;
      const results = payload.results ?? [];
      batch.forEach((position, i) => {
        samples.push({
          position,
          elevationM: results[i]?.elevation ?? null,
          dataset: TERRAIN_DATASET,
        });
      });
    } catch {
      for (const position of batch) {
        samples.push({ position, elevationM: null, dataset: TERRAIN_DATASET });
      }
    }
  }
  return samples;
}
