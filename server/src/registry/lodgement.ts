import { randomUUID } from "node:crypto";
import { overlapAreaM2, rangesOverlap } from "../geo.js";
import type { DerivedBuilding, Finding } from "../pipeline/types.js";
import { validateAll } from "../pipeline/validate/topology.js";
import { read, mutate } from "./store.js";
import type { AuditEntry, Role, Submission } from "./types.js";

const MIN_OVERLAP_M = 0.05;
const MIN_SHARED_AREA_M2 = 0.5;

export function detectConflicts(buildings: DerivedBuilding[]): Finding[] {
  const records = read().records;
  const findings: Finding[] = [];

  for (const building of buildings) {
    for (const volume of building.volumes) {
      for (const record of records) {
        const depth = rangesOverlap(volume.zMin, volume.zMax, record.zMin, record.zMax);
        if (depth <= MIN_OVERLAP_M) continue;
        const shared = overlapAreaM2(volume.footprint, record.footprint);
        if (shared <= MIN_SHARED_AREA_M2) continue;
        findings.push({
          code: "registered-volume-conflict",
          severity: "critical",
          message: `${volume.label} occupies ${shared.toFixed(1)} m² already registered to ${record.ulpin}, over ${depth.toFixed(2)} m of height.`,
          subjects: [volume.ref, record.ulpin],
        });
      }
    }
  }

  return findings;
}

function entry(actor: Role, action: string, from: Submission["state"] | null, to: Submission["state"] | null, note: string | null): AuditEntry {
  return { at: new Date().toISOString(), actor, action, note, from, to };
}

export function lodge(
  buildings: DerivedBuilding[],
  stateCode: string,
  note: string | null,
  actor: Role = "surveyor",
): Submission {
  const validation = validateAll(buildings);
  const conflicts = detectConflicts(buildings);
  const now = new Date().toISOString();
  const count = read().submissions.length + 1;

  const submission: Submission = {
    id: randomUUID(),
    reference: `LDG-${new Date().getFullYear()}-${String(count).padStart(4, "0")}`,
    state: "submitted",
    lodgedBy: actor,
    lodgedAt: now,
    decidedAt: null,
    stateCode,
    buildings,
    validation,
    conflicts,
    note,
    audit: [entry(actor, "lodged", null, "submitted", note)],
  };

  mutate((state) => {
    state.submissions = [submission, ...state.submissions];
  });

  return submission;
}
