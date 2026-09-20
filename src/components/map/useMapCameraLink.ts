import { useEffect, useRef } from "react";
import type * as maplibregl from "maplibre-gl";
import { cameraChanged, MAX_PITCH, type MapCamera } from "../../lib/camera";
import { useViewport } from "../../store/viewport";

function readCamera(map: maplibregl.Map): MapCamera {
  const centre = map.getCenter();
  return {
    center: [centre.lng, centre.lat],
    zoom: map.getZoom(),
    pitch: map.getPitch(),
    bearing: map.getBearing(),
  };
}

export function useMapCameraLink(map: maplibregl.Map | null): void {
  const applying = useRef(false);

  useEffect(() => {
    if (!map) return;
    const emit = () => {
      if (applying.current) return;
      useViewport.getState().setCamera(readCamera(map), "map");
    };
    map.on("move", emit);
    return () => {
      map.off("move", emit);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    let seen = useViewport.getState().revision;
    return useViewport.subscribe((state) => {
      if (state.revision === seen) return;
      seen = state.revision;
      if (state.emitter !== "scene" || !state.linked) return;
      if (!cameraChanged(readCamera(map), state.camera)) return;
      applying.current = true;
      map.jumpTo({
        center: state.camera.center,
        zoom: state.camera.zoom,
        pitch: Math.min(MAX_PITCH, Math.max(0, state.camera.pitch)),
        bearing: state.camera.bearing,
      });
      applying.current = false;
    });
  }, [map]);
}
