import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Conflict, LngLat, Parcel, Ring, Stratum } from "../../types";
import { useRegistry } from "../../store/registry";
import { useUI } from "../../store/ui";
import { bbox, ringAreaM2, ringCentroid } from "../../lib/geo";
import { USE_COLOR } from "../../lib/palette";
import { IconCheck, IconClose, IconPolygon } from "../icons";

const BASEMAP: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    { id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.55, "raster-contrast": 0.05 } },
  ],
};

const useColorExpression = [
  "match",
  ["get", "use"],
  ...Object.entries(USE_COLOR).flatMap(([k, v]) => [k, v]),
  "#8a8a8a",
] as unknown as maplibregl.ExpressionSpecification;

type Collection = Parameters<maplibregl.GeoJSONSource["setData"]>[0];

const empty: Collection = { type: "FeatureCollection", features: [] };

function parcelCollection(parcels: Parcel[], selectedId: string | null): Collection {
  return {
    type: "FeatureCollection",
    features: parcels.map((p) => ({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [[...p.ring, p.ring[0]]] },
      properties: { id: p.id, selected: p.id === selectedId, survey: p.surveyNumber },
    })),
  };
}

function strataCollection(
  strata: Stratum[],
  conflicts: Conflict[],
  bands: Record<string, boolean>,
  selectedId: string | null,
): Collection {
  const flagged = new Set(
    conflicts.filter((c) => c.severity === "critical").flatMap((c) => c.subjects),
  );
  return {
    type: "FeatureCollection",
    features: strata
      .filter((s) => bands[s.band])
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

const lastWritten = new Map<string, string>();
const queuedWrite = new Map<string, Collection>();
const writing = new Set<string>();

async function writeSource(map: maplibregl.Map, id: string, data: Collection) {
  const fingerprint = JSON.stringify(data);
  if (lastWritten.get(id) === fingerprint) return;
  lastWritten.set(id, fingerprint);
  queuedWrite.set(id, data);
  if (writing.has(id)) return;
  writing.add(id);
  try {
    while (queuedWrite.has(id)) {
      const next = queuedWrite.get(id)!;
      queuedWrite.delete(id);
      const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
      if (!src) break;
      await src.setData(next);
    }
  } finally {
    writing.delete(id);
  }
}

export function MapView() {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<maplibregl.Map | null>(null);
  const disposeTimer = useRef<ReturnType<typeof setTimeout>>();
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [draft, setDraft] = useState<Ring>([]);

  const parcels = useRegistry((s) => s.parcels);
  const strata = useRegistry((s) => s.strata);
  const conflicts = useRegistry((s) => s.conflicts);
  const selectedParcelId = useRegistry((s) => s.selectedParcelId);
  const selectedStratumId = useRegistry((s) => s.selectedStratumId);
  const selectParcel = useRegistry((s) => s.selectParcel);
  const selectStratum = useRegistry((s) => s.selectStratum);
  const addParcel = useRegistry((s) => s.addParcel);

  const drawing = useUI((s) => s.drawing);
  const setDrawing = useUI((s) => s.setDrawing);
  const bands = useUI((s) => s.bands);
  const showToast = useUI((s) => s.showToast);

  useEffect(() => {
    clearTimeout(disposeTimer.current);
    if (!container.current) return;
    if (instance.current) {
      if (instance.current.isStyleLoaded()) setMap(instance.current);
      return;
    }

    const registry = useRegistry.getState();
    const centre = registry.parcels.length
      ? ringCentroid(registry.parcels[0].ring)
      : ([77.5946, 12.9716] as LngLat);

    const m = new maplibregl.Map({
      container: container.current,
      style: BASEMAP,
      center: centre,
      zoom: 16.4,
      pitch: 52,
      bearing: -22,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

    m.on("load", () => {
      const ui = useUI.getState();
      const initialParcels = parcelCollection(registry.parcels, registry.selectedParcelId);
      const initialStrata = strataCollection(
        registry.strata,
        registry.conflicts,
        ui.bands,
        registry.selectedStratumId,
      );
      lastWritten.set("parcels", JSON.stringify(initialParcels));
      lastWritten.set("strata", JSON.stringify(initialStrata));
      lastWritten.set("draft", JSON.stringify(empty));

      m.addSource("parcels", { type: "geojson", data: initialParcels });
      m.addSource("strata", { type: "geojson", data: initialStrata });
      m.addSource("draft", { type: "geojson", data: empty });

      m.addLayer({
        id: "parcel-fill",
        type: "fill",
        source: "parcels",
        paint: {
          "fill-color": ["case", ["get", "selected"], "#b8862f", "#5d5952"],
          "fill-opacity": ["case", ["get", "selected"], 0.24, 0.12],
        },
      });
      m.addLayer({
        id: "parcel-line",
        type: "line",
        source: "parcels",
        paint: {
          "line-color": ["case", ["get", "selected"], "#8a6420", "#3f3c37"],
          "line-width": ["case", ["get", "selected"], 2.6, 1.2],
        },
      });
      m.addLayer({
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
      m.addLayer({
        id: "stratum-outline",
        type: "line",
        source: "strata",
        filter: ["==", ["get", "selected"], true],
        paint: { "line-color": "#16130f", "line-width": 2 },
      });
      m.addLayer({
        id: "draft-fill",
        type: "fill",
        source: "draft",
        paint: { "fill-color": "#b8862f", "fill-opacity": 0.25 },
      });
      m.addLayer({
        id: "draft-line",
        type: "line",
        source: "draft",
        paint: { "line-color": "#8a6420", "line-width": 2, "line-dasharray": [2, 1] },
      });

      m.on("click", "stratum-extrusion", (e: maplibregl.MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === "string" && !useUI.getState().drawing) {
          e.preventDefault();
          selectStratum(id);
        }
      });
      m.on("click", "parcel-fill", (e: maplibregl.MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === "string" && !useUI.getState().drawing && !e.defaultPrevented) selectParcel(id);
      });
      for (const layer of ["parcel-fill", "stratum-extrusion"]) {
        m.on("mouseenter", layer, () => {
          if (!useUI.getState().drawing) m.getCanvas().style.cursor = "pointer";
        });
        m.on("mouseleave", layer, () => {
          m.getCanvas().style.cursor = useUI.getState().drawing ? "crosshair" : "";
        });
      }

      setMap(m);
    });

    const observer = new ResizeObserver(() => m.resize());
    observer.observe(container.current);
    instance.current = m;

    return () => {
      observer.disconnect();
      disposeTimer.current = setTimeout(() => {
        instance.current?.remove();
        instance.current = null;
        lastWritten.clear();
        queuedWrite.clear();
      }, 400);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map) return;
    writeSource(map, "parcels", parcelCollection(parcels, selectedParcelId));
  }, [parcels, selectedParcelId, map]);

  useEffect(() => {
    if (!map) return;
    writeSource(map, "strata", strataCollection(strata, conflicts, bands, selectedStratumId));
  }, [strata, conflicts, bands, selectedStratumId, map]);

  useEffect(() => {
    if (!map) return;
    const parcel = parcels.find((p) => p.id === selectedParcelId);
    if (!parcel) return;
    const [minX, minY, maxX, maxY] = bbox(parcel.ring);
    map.fitBounds(
      [
        [minX, minY],
        [maxX, maxY],
      ],
      { padding: 90, duration: 900, maxZoom: 17.4, pitch: 52, bearing: -22 },
    );
  }, [selectedParcelId, parcels, map]);

  useEffect(() => {
    if (!map) return;
    map.getCanvas().style.cursor = drawing ? "crosshair" : "";
    if (!drawing) setDraft([]);
  }, [drawing, map]);

  useEffect(() => {
    if (!map) return;
    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (!useUI.getState().drawing) return;
      setDraft((d) => [...d, [e.lngLat.lng, e.lngLat.lat]]);
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    if (draft.length < 2) {
      writeSource(map, "draft", empty);
      return;
    }
    writeSource(map, "draft", {
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
    });
  }, [draft, map]);

  const commitDraft = () => {
    if (draft.length < 3) {
      showToast("A parcel needs at least three corners");
      return;
    }
    const parcel = addParcel({
      ring: draft,
      surveyNumber: `Sy. No. ${100 + parcels.length}/${1 + (parcels.length % 9)}`,
      landUse: "Unclassified",
      holder: "Unrecorded",
    });
    showToast(`Parcel ${parcel.ulpinBase} surveyed — ${ringAreaM2(draft).toFixed(0)} m²`);
    setDraft([]);
    setDrawing(false);
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md border border-line bg-raised">
      <div ref={container} className="h-full w-full" />
      {drawing && (
        <div className="pointer-events-auto absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-md border border-line bg-surface/95 px-3 py-2 shadow-pop">
          <IconPolygon size={14} className="text-accent" />
          <span className="text-xs text-dim">Click corners on the map · {draft.length} placed</span>
          <button
            onClick={commitDraft}
            className="flex items-center gap-1 rounded-sm bg-text px-2 py-1 text-[11px] text-base hover:bg-accent"
          >
            <IconCheck size={12} /> Generate ULPIN
          </button>
          <button
            onClick={() => {
              setDraft([]);
              setDrawing(false);
            }}
            className="rounded-sm border border-line px-2 py-1 text-[11px] text-dim hover:text-text"
          >
            <IconClose size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
