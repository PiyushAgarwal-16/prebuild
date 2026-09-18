import type { LevelBand, StratumUse, Tenure } from "../types";

export const USE_COLOR: Record<StratumUse, string> = {
  residential: "#c9743f",
  commercial: "#3b7ea8",
  parking: "#6f7580",
  utility: "#8a6fb0",
  transport: "#2f8f6f",
  airspace: "#d3a93c",
  common: "#9aa2ab",
  structural: "#7d6a55",
};

export const TENURE_COLOR: Record<Tenure, string> = {
  freehold: "#2f7f5f",
  leasehold: "#3b7ea8",
  easement: "#8a6fb0",
  "air-rights": "#d3a93c",
  government: "#b4553f",
  common: "#9aa2ab",
};

export const USE_LABEL: Record<StratumUse, string> = {
  residential: "Residential",
  commercial: "Commercial",
  parking: "Parking",
  utility: "Utility",
  transport: "Transport",
  airspace: "Airspace",
  common: "Common area",
  structural: "Structural",
};

export const TENURE_LABEL: Record<Tenure, string> = {
  freehold: "Freehold",
  leasehold: "Leasehold",
  easement: "Easement",
  "air-rights": "Air rights",
  government: "Government",
  common: "Common",
};

export const BAND_TINT: Record<LevelBand, string> = {
  S: "#8a6fb0",
  B: "#6f7580",
  G: "#7d6a55",
  F: "#c9743f",
  A: "#d3a93c",
  E: "#2f8f6f",
};

export const CONFLICT_COLOR = "#cc3b2e";
