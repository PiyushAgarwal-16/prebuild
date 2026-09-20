import { create } from "zustand";
import type { LngLat, Ring } from "../types";
import type { MapCamera } from "../lib/camera";

export type CameraEmitter = "map" | "scene";

export interface MapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface LiveEdit {
  stratumId: string;
  footprint: Ring;
  zMin: number;
  zMax: number;
}

interface ViewportStore {
  camera: MapCamera;
  emitter: CameraEmitter | null;
  revision: number;
  linked: boolean;
  mapHeightPx: number;
  sceneHeightPx: number;
  liveEdit: LiveEdit | null;
  bounds: MapBounds | null;

  setBounds: (bounds: MapBounds) => void;
  setCamera: (camera: MapCamera, emitter: CameraEmitter) => void;
  setLinked: (linked: boolean) => void;
  setMapHeight: (px: number) => void;
  setSceneHeight: (px: number) => void;
  beginEdit: (edit: LiveEdit) => void;
  updateEdit: (patch: Partial<Omit<LiveEdit, "stratumId">>) => void;
  endEdit: () => void;
}

const INITIAL_CENTRE: LngLat = [77.5946, 12.9716];

export const useViewport = create<ViewportStore>((set, get) => ({
  camera: { center: INITIAL_CENTRE, zoom: 16.4, pitch: 52, bearing: -22 },
  emitter: null,
  revision: 0,
  linked: true,
  mapHeightPx: 800,
  sceneHeightPx: 800,
  liveEdit: null,
  bounds: null,

  setBounds: (bounds) => set({ bounds }),
  setCamera: (camera, emitter) => set({ camera, emitter, revision: get().revision + 1 }),
  setLinked: (linked) => set({ linked }),
  setMapHeight: (mapHeightPx) => set({ mapHeightPx }),
  setSceneHeight: (sceneHeightPx) => set({ sceneHeightPx }),

  beginEdit: (liveEdit) => set({ liveEdit }),
  updateEdit: (patch) => {
    const current = get().liveEdit;
    if (!current) return;
    set({ liveEdit: { ...current, ...patch } });
  },
  endEdit: () => set({ liveEdit: null }),
}));
