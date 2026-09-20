import { create } from "zustand";
import type { Role } from "../registry/types";

const STORAGE_KEY = "ulpin3d.role";

function load(): Role {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "surveyor" || raw === "officer" || raw === "public") return raw;
  } catch {
    /* storage unavailable */
  }
  return "surveyor";
}

interface RoleStore {
  role: Role;
  setRole: (role: Role) => void;
}

export const useRole = create<RoleStore>((set) => ({
  role: load(),
  setRole: (role) => {
    try {
      localStorage.setItem(STORAGE_KEY, role);
    } catch {
      /* storage unavailable */
    }
    set({ role });
  },
}));
