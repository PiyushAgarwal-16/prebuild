import type * as maplibregl from "maplibre-gl";
import type { BasemapId } from "../../types";

export type { BasemapId };

interface BasemapDefinition {
  id: BasemapId;
  label: string;
  sourceId: string;
  layerId: string;
  tiles: string[];
  attribution: string;
  saturation: number;
  contrast: number;
}

export const BASEMAPS: Record<BasemapId, BasemapDefinition> = {
  street: {
    id: "street",
    label: "Street",
    sourceId: "basemap-street",
    layerId: "basemap-street",
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution: "© OpenStreetMap contributors",
    saturation: -0.55,
    contrast: 0.05,
  },
  satellite: {
    id: "satellite",
    label: "Satellite",
    sourceId: "basemap-satellite",
    layerId: "basemap-satellite",
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    saturation: -0.12,
    contrast: 0.04,
  },
};

export const BASEMAP_ORDER: BasemapId[] = ["street", "satellite"];

export function buildStyle(active: BasemapId): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: Object.fromEntries(
      BASEMAP_ORDER.map((id) => [
        BASEMAPS[id].sourceId,
        {
          type: "raster" as const,
          tiles: BASEMAPS[id].tiles,
          tileSize: 256,
          attribution: BASEMAPS[id].attribution,
        },
      ]),
    ),
    layers: BASEMAP_ORDER.map((id) => ({
      id: BASEMAPS[id].layerId,
      type: "raster" as const,
      source: BASEMAPS[id].sourceId,
      layout: { visibility: id === active ? ("visible" as const) : ("none" as const) },
      paint: {
        "raster-saturation": BASEMAPS[id].saturation,
        "raster-contrast": BASEMAPS[id].contrast,
      },
    })),
  };
}

export function applyBasemap(map: maplibregl.Map, active: BasemapId): void {
  for (const id of BASEMAP_ORDER) {
    if (!map.getLayer(BASEMAPS[id].layerId)) continue;
    map.setLayoutProperty(BASEMAPS[id].layerId, "visibility", id === active ? "visible" : "none");
  }
}

export function refreshImagery(map: maplibregl.Map, active: BasemapId, revision: number): void {
  const definition = BASEMAPS[active];
  const source = map.getSource(definition.sourceId) as maplibregl.RasterTileSource | undefined;
  if (!source) return;
  source.setTiles(
    definition.tiles.map((t) => `${t}${t.includes("?") ? "&" : "?"}rev=${revision}`),
  );
}
