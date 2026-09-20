import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { RegistryFile } from "./types.js";

const FILE = resolve(process.cwd(), process.env.REGISTRY_FILE || "data/registry.json");

const empty: RegistryFile = { submissions: [], records: [] };

let cache: RegistryFile | null = null;

export function read(): RegistryFile {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as RegistryFile;
    cache = {
      submissions: Array.isArray(parsed.submissions) ? parsed.submissions : [],
      records: Array.isArray(parsed.records) ? parsed.records : [],
    };
  } catch {
    cache = { ...empty, submissions: [], records: [] };
  }
  return cache;
}

export function write(next: RegistryFile): void {
  cache = next;
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(next, null, 2), "utf8");
  } catch (err) {
    console.error("registry write failed", err);
  }
}

export function mutate(fn: (state: RegistryFile) => void): RegistryFile {
  const state = read();
  const next: RegistryFile = {
    submissions: [...state.submissions],
    records: [...state.records],
  };
  fn(next);
  write(next);
  return next;
}
