import { create } from "zustand";
import type { Conflict, LevelBand, Parcel, Ring, Stratum, StratumUse, Tenure } from "../types";
import { detectConflicts } from "../lib/conflicts";
import { ringAreaM2, ringCentroid } from "../lib/geo";
import { composeUlpin, generateBase, nextUnit } from "../lib/ulpin";

const STORAGE_KEY = "ulpin3d.registry.v2";

export interface StratumInput {
  parcelId: string;
  label: string;
  band: LevelBand;
  level: number;
  footprint: Ring;
  zMin: number;
  zMax: number;
  use: StratumUse;
  tenure: Tenure;
  holder: string;
  encumbrance?: string;
}

export interface ParcelInput {
  ring: Ring;
  surveyNumber: string;
  landUse: string;
  holder: string;
  stateCode?: string;
  stateName?: string;
  districtName?: string;
  villageName?: string;
  groundElevation?: number;
}

interface RegistryStore {
  parcels: Parcel[];
  strata: Stratum[];
  conflicts: Conflict[];
  selectedParcelId: string | null;
  selectedStratumId: string | null;

  selectParcel: (id: string | null) => void;
  selectStratum: (id: string | null) => void;
  addParcel: (input: ParcelInput) => Parcel;
  removeParcel: (id: string) => void;
  addStratum: (input: StratumInput) => Stratum;
  updateStratum: (id: string, patch: Partial<Stratum>) => void;
  removeStratum: (id: string) => void;
  ingest: (parcels: Parcel[], strata: Stratum[]) => void;
  clearAll: () => void;
}

interface Persisted {
  parcels: Parcel[];
  strata: Stratum[];
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Persisted;
      if (Array.isArray(parsed.parcels) && Array.isArray(parsed.strata)) {
        return {
          parcels: parsed.parcels.map((p) => ({ ...p, ulpinSource: p.ulpinSource ?? "generated" })),
          strata: parsed.strata,
        };
      }
    }
  } catch {
    /* fall through to an empty register */
  }
  return { parcels: [], strata: [] };
}

function save(state: Persisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ parcels: state.parcels, strata: state.strata }));
  } catch {
    /* storage unavailable */
  }
}

let uid = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(uid++).toString(36)}`;

export const useRegistry = create<RegistryStore>((set, get) => {
  const initial = load();

  function commit(parcels: Parcel[], strata: Stratum[], extra: Partial<RegistryStore> = {}) {
    save({ parcels, strata });
    set({ parcels, strata, conflicts: detectConflicts(parcels, strata), ...extra });
  }

  return {
    parcels: initial.parcels,
    strata: initial.strata,
    conflicts: detectConflicts(initial.parcels, initial.strata),
    selectedParcelId: initial.parcels[0]?.id ?? null,
    selectedStratumId: null,

    selectParcel: (selectedParcelId) => set({ selectedParcelId, selectedStratumId: null }),

    selectStratum: (id) => {
      if (!id) return set({ selectedStratumId: null });
      const s = get().strata.find((x) => x.id === id);
      set({ selectedStratumId: id, selectedParcelId: s?.parcelId ?? get().selectedParcelId });
    },

    addParcel: (input) => {
      const centroid = ringCentroid(input.ring);
      const stateCode = input.stateCode ?? "29";
      const parcel: Parcel = {
        id: newId("parcel"),
        ulpinBase: generateBase(stateCode, centroid),
        ulpinSource: "generated",
        ring: input.ring,
        surveyNumber: input.surveyNumber || "Unsurveyed",
        jurisdiction: {
          stateCode,
          stateName: input.stateName ?? "Karnataka",
          districtCode: "572",
          districtName: input.districtName ?? "Bengaluru Urban",
          villageCode: "615301",
          villageName: input.villageName ?? "Sampangi Rama Nagara",
        },
        groundElevation: input.groundElevation ?? 920,
        landUse: input.landUse || "Unclassified",
        holder: input.holder || "Unrecorded",
        registeredOn: new Date().toISOString().slice(0, 10),
      };
      commit([...get().parcels, parcel], get().strata, {
        selectedParcelId: parcel.id,
        selectedStratumId: null,
      });
      return parcel;
    },

    removeParcel: (id) => {
      const parcels = get().parcels.filter((p) => p.id !== id);
      const strata = get().strata.filter((s) => s.parcelId !== id);
      commit(parcels, strata, {
        selectedParcelId: parcels[0]?.id ?? null,
        selectedStratumId: null,
      });
    },

    addStratum: (input) => {
      const parcel = get().parcels.find((p) => p.id === input.parcelId);
      if (!parcel) throw new Error("Unknown parcel");
      const taken = get()
        .strata.filter((s) => s.parcelId === parcel.id && s.band === input.band && s.level === input.level)
        .map((s) => s.unit);
      const unit = nextUnit(taken);
      const area = ringAreaM2(input.footprint);
      const stratum: Stratum = {
        id: newId("stratum"),
        parcelId: parcel.id,
        ulpin: composeUlpin(parcel.ulpinBase, input.band, input.level, unit),
        label: input.label,
        band: input.band,
        level: input.level,
        unit,
        footprint: input.footprint,
        zMin: Number(input.zMin.toFixed(2)),
        zMax: Number(input.zMax.toFixed(2)),
        use: input.use,
        tenure: input.tenure,
        holder: input.holder,
        carpetArea: Number((area * 0.78).toFixed(1)),
        builtUpArea: Number(area.toFixed(1)),
        registeredOn: new Date().toISOString().slice(0, 10),
        encumbrance: input.encumbrance,
      };
      commit(get().parcels, [...get().strata, stratum], { selectedStratumId: stratum.id });
      return stratum;
    },

    updateStratum: (id, patch) => {
      const parcels = get().parcels;
      const strata = get().strata.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...patch };
        const parcel = parcels.find((p) => p.id === next.parcelId);
        if (parcel && (patch.band !== undefined || patch.level !== undefined || patch.unit !== undefined)) {
          next.ulpin = composeUlpin(parcel.ulpinBase, next.band, next.level, next.unit);
        }
        if (patch.footprint) {
          const area = ringAreaM2(patch.footprint);
          next.builtUpArea = Number(area.toFixed(1));
          next.carpetArea = Number((area * 0.78).toFixed(1));
        }
        return next;
      });
      commit(parcels, strata);
    },

    removeStratum: (id) => {
      commit(
        get().parcels,
        get().strata.filter((s) => s.id !== id),
        { selectedStratumId: null },
      );
    },

    ingest: (parcels, strata) => {
      const merged = [...get().parcels, ...parcels];
      commit(merged, [...get().strata, ...strata], {
        selectedParcelId: parcels[0]?.id ?? get().selectedParcelId,
        selectedStratumId: null,
      });
    },

    clearAll: () => {
      commit([], [], { selectedParcelId: null, selectedStratumId: null });
    },
  };
});

export const selectParcelStrata = (parcelId: string | null) => (s: RegistryStore) =>
  parcelId ? s.strata.filter((x) => x.parcelId === parcelId) : [];
