import type * as maplibregl from "maplibre-gl";

export type Collection = Parameters<maplibregl.GeoJSONSource["setData"]>[0];

export const EMPTY: Collection = { type: "FeatureCollection", features: [] };

const lastWritten = new Map<string, string>();
const queued = new Map<string, Collection>();
const writing = new Set<string>();

export async function writeSource(map: maplibregl.Map, id: string, data: Collection): Promise<void> {
  const fingerprint = JSON.stringify(data);
  if (lastWritten.get(id) === fingerprint) return;
  lastWritten.set(id, fingerprint);
  queued.set(id, data);
  if (writing.has(id)) return;
  writing.add(id);
  try {
    while (queued.has(id)) {
      const next = queued.get(id)!;
      queued.delete(id);
      const source = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
      if (!source) break;
      await source.setData(next);
    }
  } finally {
    writing.delete(id);
  }
}

export function seedSource(id: string, data: Collection): void {
  lastWritten.set(id, JSON.stringify(data));
}

export function resetSources(): void {
  lastWritten.clear();
  queued.clear();
}
