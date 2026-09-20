import { useEffect, useMemo } from "react";
import type * as maplibregl from "maplibre-gl";
import { useLive } from "../../store/live";
import { useViewport } from "../../store/viewport";
import { refreshImagery, type BasemapId } from "./basemap";
import { roverCollection, stationCollection, trackCollection } from "./collections";
import { writeSource } from "./source";

function hashRevision(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

export function useLiveOverlay(map: maplibregl.Map | null, basemap: BasemapId): void {
  const stations = useLive((s) => s.stations);
  const rover = useLive((s) => s.rover);
  const track = useLive((s) => s.track);
  const imagery = useLive((s) => s.imagery);
  const followRover = useLive((s) => s.followRover);

  const imageryRevision = useMemo(
    () => hashRevision(imagery.map((i) => `${i.layerId}:${i.capturedAt}`).join("|")),
    [imagery],
  );

  useEffect(() => {
    if (!map) return;
    void writeSource(map, "stations", stationCollection(stations));
  }, [map, stations]);

  useEffect(() => {
    if (!map) return;
    void writeSource(
      map,
      "rover",
      roverCollection(rover?.position ?? null, rover?.headingDeg ?? 0, rover?.fix ?? "none"),
    );
  }, [map, rover]);

  useEffect(() => {
    if (!map) return;
    void writeSource(map, "track", trackCollection(track));
  }, [map, track]);

  useEffect(() => {
    if (!map || !imageryRevision) return;
    refreshImagery(map, basemap, imageryRevision);
  }, [map, basemap, imageryRevision]);

  useEffect(() => {
    if (!map || !followRover || !rover) return;
    const { camera, linked } = useViewport.getState();
    if (!linked) return;
    map.easeTo({ center: rover.position, zoom: camera.zoom, duration: 240, easing: (t) => t });
  }, [map, followRover, rover]);
}
