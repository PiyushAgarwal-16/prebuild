import type * as maplibregl from "maplibre-gl";
import { USE_COLOR } from "../../lib/palette";
import { seedSource, type Collection } from "./source";

const useColorExpression = [
  "match",
  ["get", "use"],
  ...Object.entries(USE_COLOR).flatMap(([k, v]) => [k, v]),
  "#8a8a8a",
] as unknown as maplibregl.ExpressionSpecification;

const fixColorExpression = [
  "match",
  ["get", "fix"],
  "fixed",
  "#2f8f6f",
  "float",
  "#d3a93c",
  "dgps",
  "#3b7ea8",
  "#cc3b2e",
] as unknown as maplibregl.ExpressionSpecification;

export const SOURCE_IDS = [
  "parcels",
  "strata",
  "live-edit",
  "draft",
  "track",
  "stations",
  "rover",
] as const;

export type SourceId = (typeof SOURCE_IDS)[number];

export function installLayers(map: maplibregl.Map, initial: Record<SourceId, Collection>): void {
  for (const id of SOURCE_IDS) {
    seedSource(id, initial[id]);
    map.addSource(id, { type: "geojson", data: initial[id] });
  }

  map.addLayer({
    id: "parcel-fill",
    type: "fill",
    source: "parcels",
    paint: {
      "fill-color": ["case", ["get", "selected"], "#b8862f", "#5d5952"],
      "fill-opacity": ["case", ["get", "selected"], 0.24, 0.12],
    },
  });
  map.addLayer({
    id: "parcel-line",
    type: "line",
    source: "parcels",
    paint: {
      "line-color": ["case", ["get", "selected"], "#8a6420", "#3f3c37"],
      "line-width": ["case", ["get", "selected"], 2.6, 1.2],
    },
  });
  map.addLayer({
    id: "stratum-extrusion",
    type: "fill-extrusion",
    source: "strata",
    paint: {
      "fill-extrusion-color": ["case", ["get", "flagged"], "#cc3b2e", useColorExpression],
      "fill-extrusion-base": ["get", "base"],
      "fill-extrusion-height": ["get", "height"],
      "fill-extrusion-opacity": 0.74,
    },
  });
  map.addLayer({
    id: "stratum-outline",
    type: "line",
    source: "strata",
    filter: ["==", ["get", "selected"], true],
    paint: { "line-color": "#16130f", "line-width": 2 },
  });
  map.addLayer({
    id: "live-edit-extrusion",
    type: "fill-extrusion",
    source: "live-edit",
    paint: {
      "fill-extrusion-color": useColorExpression,
      "fill-extrusion-base": ["get", "base"],
      "fill-extrusion-height": ["get", "height"],
      "fill-extrusion-opacity": 0.92,
    },
  });
  map.addLayer({
    id: "live-edit-line",
    type: "line",
    source: "live-edit",
    paint: { "line-color": "#16130f", "line-width": 2.4, "line-dasharray": [1.6, 1] },
  });
  map.addLayer({
    id: "draft-fill",
    type: "fill",
    source: "draft",
    paint: { "fill-color": "#b8862f", "fill-opacity": 0.25 },
  });
  map.addLayer({
    id: "draft-line",
    type: "line",
    source: "draft",
    paint: { "line-color": "#8a6420", "line-width": 2, "line-dasharray": [2, 1] },
  });
  map.addLayer({
    id: "track-line",
    type: "line",
    source: "track",
    paint: { "line-color": "#3b7ea8", "line-width": 2, "line-opacity": 0.75 },
  });
  map.addLayer({
    id: "station-halo",
    type: "circle",
    source: "stations",
    paint: {
      "circle-radius": 13,
      "circle-color": fixColorExpression,
      "circle-opacity": ["case", ["get", "online"], 0.16, 0.06],
    },
  });
  map.addLayer({
    id: "station-point",
    type: "circle",
    source: "stations",
    paint: {
      "circle-radius": 5,
      "circle-color": fixColorExpression,
      "circle-stroke-color": "#16130f",
      "circle-stroke-width": 1.2,
      "circle-opacity": ["case", ["get", "online"], 1, 0.35],
    },
  });
  map.addLayer({
    id: "rover-halo",
    type: "circle",
    source: "rover",
    paint: { "circle-radius": 18, "circle-color": fixColorExpression, "circle-opacity": 0.2 },
  });
  map.addLayer({
    id: "rover-point",
    type: "circle",
    source: "rover",
    paint: {
      "circle-radius": 6.5,
      "circle-color": fixColorExpression,
      "circle-stroke-color": "#fbfaf7",
      "circle-stroke-width": 2,
    },
  });
}
