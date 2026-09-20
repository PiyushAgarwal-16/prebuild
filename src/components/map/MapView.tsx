import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LngLat } from "../../types";
import { useRegistry } from "../../store/registry";
import { useUI } from "../../store/ui";
import { useViewport } from "../../store/viewport";
import { bbox, ringCentroid } from "../../lib/geo";
import { MAX_PITCH } from "../../lib/camera";
import { applyBasemap, buildStyle } from "./basemap";
import { liveEditCollection, parcelCollection, strataCollection } from "./collections";
import { installLayers } from "./layers";
import { EMPTY, resetSources, writeSource } from "./source";
import { useLiveOverlay } from "./useLiveOverlay";
import { useMapCameraLink } from "./useMapCameraLink";
import { useSurveyDraft } from "./useSurveyDraft";
import { DrawToolbar } from "./DrawToolbar";
import { MapControls } from "./MapControls";
import { LiveFeedPanel } from "../live/LiveFeedPanel";

export function MapView() {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<maplibregl.Map | null>(null);
  const disposeTimer = useRef<ReturnType<typeof setTimeout>>();
  const [map, setMap] = useState<maplibregl.Map | null>(null);

  const parcels = useRegistry((s) => s.parcels);
  const strata = useRegistry((s) => s.strata);
  const conflicts = useRegistry((s) => s.conflicts);
  const selectedParcelId = useRegistry((s) => s.selectedParcelId);
  const selectedStratumId = useRegistry((s) => s.selectedStratumId);
  const selectParcel = useRegistry((s) => s.selectParcel);
  const selectStratum = useRegistry((s) => s.selectStratum);

  const drawing = useUI((s) => s.drawing);
  const bands = useUI((s) => s.bands);
  const basemap = useUI((s) => s.basemap);
  const liveEdit = useViewport((s) => s.liveEdit);
  const setMapHeight = useViewport((s) => s.setMapHeight);

  const { draft, commit, cancel } = useSurveyDraft(map);
  useMapCameraLink(map);
  useLiveOverlay(map, basemap);

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
      style: buildStyle(useUI.getState().basemap),
      center: centre,
      zoom: 16.4,
      pitch: 52,
      bearing: -22,
      maxPitch: MAX_PITCH,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

    m.on("load", () => {
      const ui = useUI.getState();
      installLayers(m, {
        parcels: parcelCollection(registry.parcels, registry.selectedParcelId),
        strata: strataCollection(
          registry.strata,
          registry.conflicts,
          ui.bands,
          registry.selectedStratumId,
          null,
        ),
        "live-edit": EMPTY,
        draft: EMPTY,
        track: EMPTY,
        stations: EMPTY,
        rover: EMPTY,
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
        if (typeof id === "string" && !useUI.getState().drawing && !e.defaultPrevented) {
          selectParcel(id);
        }
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

    const observer = new ResizeObserver(() => {
      m.resize();
      if (container.current) setMapHeight(container.current.clientHeight);
    });
    observer.observe(container.current);
    setMapHeight(container.current.clientHeight);
    instance.current = m;

    return () => {
      observer.disconnect();
      disposeTimer.current = setTimeout(() => {
        instance.current?.remove();
        instance.current = null;
        resetSources();
      }, 400);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map) return;
    applyBasemap(map, basemap);
  }, [map, basemap]);

  useEffect(() => {
    if (!map) return;
    void writeSource(map, "parcels", parcelCollection(parcels, selectedParcelId));
  }, [parcels, selectedParcelId, map]);

  useEffect(() => {
    if (!map) return;
    void writeSource(
      map,
      "strata",
      strataCollection(strata, conflicts, bands, selectedStratumId, liveEdit),
    );
  }, [strata, conflicts, bands, selectedStratumId, liveEdit, map]);

  useEffect(() => {
    if (!map) return;
    const use = strata.find((s) => s.id === liveEdit?.stratumId)?.use ?? "common";
    void writeSource(map, "live-edit", liveEditCollection(liveEdit, use));
  }, [liveEdit, strata, map]);

  useEffect(() => {
    if (!map || useViewport.getState().liveEdit) return;
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

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md border border-line bg-raised">
      <div ref={container} className="h-full w-full" />
      <MapControls />
      <LiveFeedPanel />
      {drawing && <DrawToolbar count={draft.length} onCommit={commit} onCancel={cancel} />}
    </div>
  );
}
