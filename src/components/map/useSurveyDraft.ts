import { useCallback, useEffect, useState } from "react";
import type * as maplibregl from "maplibre-gl";
import type { Ring } from "../../types";
import { ringAreaM2 } from "../../lib/geo";
import { useRegistry } from "../../store/registry";
import { useUI } from "../../store/ui";
import { draftCollection } from "./collections";
import { writeSource } from "./source";

export interface SurveyDraft {
  draft: Ring;
  commit: () => void;
  cancel: () => void;
}

export function useSurveyDraft(map: maplibregl.Map | null): SurveyDraft {
  const [draft, setDraft] = useState<Ring>([]);
  const parcels = useRegistry((s) => s.parcels);
  const addParcel = useRegistry((s) => s.addParcel);
  const drawing = useUI((s) => s.drawing);
  const setDrawing = useUI((s) => s.setDrawing);
  const showToast = useUI((s) => s.showToast);

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
    void writeSource(map, "draft", draftCollection(draft));
  }, [draft, map]);

  const commit = useCallback(() => {
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
  }, [addParcel, draft, parcels.length, setDrawing, showToast]);

  const cancel = useCallback(() => {
    setDraft([]);
    setDrawing(false);
  }, [setDrawing]);

  return { draft, commit, cancel };
}
