import type { Conflict, LngLat, Parcel, Ring, Stratum } from "../../types";
import type { StationFrame } from "../../live/types";
import type { LiveEdit } from "../../store/viewport";
import type { Collection } from "./source";

export function parcelCollection(parcels: Parcel[], selectedId: string | null): Collection {
  return {
    type: "FeatureCollection",
    features: parcels.map((p) => ({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [[...p.ring, p.ring[0]]] },
      properties: { id: p.id, selected: p.id === selectedId, survey: p.surveyNumber },
    })),
  };
}

export function strataCollection(
  strata: Stratum[],
  conflicts: Conflict[],
  bands: Record<string, boolean>,
  selectedId: string | null,
  liveEdit: LiveEdit | null,
): Collection {
  const flagged = new Set(
    conflicts.filter((c) => c.severity === "critical").flatMap((c) => c.subjects),
  );
  return {
    type: "FeatureCollection",
    features: strata
      .filter((s) => bands[s.band])
      .filter((s) => s.id !== liveEdit?.stratumId)
      .map((s) => ({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [[...s.footprint, s.footprint[0]]] },
        properties: {
          id: s.id,
          use: s.use,
          base: Math.max(s.zMin, 0),
          height: Math.max(s.zMax, 0.4),
          flagged: flagged.has(s.id),
          selected: s.id === selectedId,
        },
      })),
  };
}

export function liveEditCollection(edit: LiveEdit | null, use: string): Collection {
  if (!edit) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [[...edit.footprint, edit.footprint[0]]] },
        properties: {
          use,
          base: Math.max(edit.zMin, 0),
          height: Math.max(edit.zMax, 0.4),
        },
      },
    ],
  };
}

export function draftCollection(draft: Ring): Collection {
  if (draft.length < 2) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry:
          draft.length >= 3
            ? { type: "Polygon", coordinates: [[...draft, draft[0]]] }
            : { type: "LineString", coordinates: draft },
        properties: {},
      },
    ],
  };
}

export function stationCollection(stations: StationFrame[]): Collection {
  return {
    type: "FeatureCollection",
    features: stations.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: s.position },
      properties: {
        id: s.id,
        name: s.name,
        fix: s.fix,
        online: s.online,
        satellites: s.satellites,
        hdop: s.hdop,
        age: s.correctionAgeSec,
      },
    })),
  };
}

export function roverCollection(position: LngLat | null, heading: number, fix: string): Collection {
  if (!position) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: position },
        properties: { heading, fix },
      },
    ],
  };
}

export function trackCollection(track: LngLat[]): Collection {
  if (track.length < 2) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "LineString", coordinates: track }, properties: {} },
    ],
  };
}
