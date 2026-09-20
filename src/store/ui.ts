import { create } from "zustand";
import type { BasemapId, LevelBand } from "../types";
import { BAND_ORDER } from "../lib/ulpin";

export type Workspace = "split" | "map" | "model";
export type ColorBy = "use" | "tenure";

const allBands = (): Record<LevelBand, boolean> =>
  Object.fromEntries(BAND_ORDER.map((b) => [b, true])) as Record<LevelBand, boolean>;

interface UIStore {
  workspace: Workspace;
  colorBy: ColorBy;
  basemap: BasemapId;
  explode: number;
  bands: Record<LevelBand, boolean>;
  drawing: boolean;
  importOpen: boolean;
  newVolumeOpen: boolean;
  planOpen: boolean;
  pipelineOpen: boolean;
  certificateFor: string | null;
  toast: { id: number; message: string } | null;

  setWorkspace: (w: Workspace) => void;
  setColorBy: (c: ColorBy) => void;
  setBasemap: (b: BasemapId) => void;
  setExplode: (v: number) => void;
  toggleBand: (b: LevelBand) => void;
  setDrawing: (d: boolean) => void;
  setImportOpen: (o: boolean) => void;
  setNewVolumeOpen: (o: boolean) => void;
  setPlanOpen: (o: boolean) => void;
  setPipelineOpen: (o: boolean) => void;
  setCertificateFor: (id: string | null) => void;
  showToast: (message: string) => void;
}

let toastId = 0;

export const useUI = create<UIStore>((set) => ({
  workspace: "split",
  colorBy: "use",
  basemap: "street",
  explode: 0,
  bands: allBands(),
  drawing: false,
  importOpen: false,
  newVolumeOpen: false,
  planOpen: false,
  pipelineOpen: false,
  certificateFor: null,
  toast: null,

  setWorkspace: (workspace) => set({ workspace }),
  setColorBy: (colorBy) => set({ colorBy }),
  setBasemap: (basemap) => set({ basemap }),
  setExplode: (explode) => set({ explode }),
  toggleBand: (b) => set((s) => ({ bands: { ...s.bands, [b]: !s.bands[b] } })),
  setDrawing: (drawing) => set({ drawing }),
  setImportOpen: (importOpen) => set({ importOpen }),
  setNewVolumeOpen: (newVolumeOpen) => set({ newVolumeOpen }),
  setPlanOpen: (planOpen) => set({ planOpen }),
  setPipelineOpen: (pipelineOpen) => set({ pipelineOpen }),
  setCertificateFor: (certificateFor) => set({ certificateFor }),
  showToast: (message) => {
    const id = ++toastId;
    set({ toast: { id, message } });
    setTimeout(() => set((s) => (s.toast?.id === id ? { toast: null } : s)), 2800);
  },
}));
