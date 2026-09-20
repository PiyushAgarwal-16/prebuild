import { ringCentroid } from "../geo.js";
import { composeUlpin, generateBase } from "../ulpin.js";
import { detectConflicts } from "./lodgement.js";
import { mutate, read } from "./store.js";
import type { Decision, RegisteredVolume, Submission, SubmissionState } from "./types.js";

const NEXT_STATE: Record<Decision, SubmissionState> = {
  approve: "approved",
  object: "objected",
  reject: "rejected",
};

export function get(id: string): Submission | undefined {
  return read().submissions.find((s) => s.id === id);
}

export function list(state?: SubmissionState): Submission[] {
  const all = read().submissions;
  return state ? all.filter((s) => s.state === state) : all;
}

export function claim(id: string, note: string | null): Submission | { error: string } {
  const current = get(id);
  if (!current) return { error: "Submission not found" };
  if (current.state !== "submitted") return { error: `Cannot review a submission that is ${current.state}` };

  let updated: Submission | undefined;
  mutate((state) => {
    state.submissions = state.submissions.map((s) => {
      if (s.id !== id) return s;
      updated = {
        ...s,
        state: "under_review",
        audit: [
          ...s.audit,
          {
            at: new Date().toISOString(),
            actor: "officer",
            action: "opened for review",
            note,
            from: s.state,
            to: "under_review",
          },
        ],
      };
      return updated;
    });
  });
  return updated ?? { error: "Submission not found" };
}

function issueRecords(submission: Submission): RegisteredVolume[] {
  const now = new Date().toISOString();
  const records: RegisteredVolume[] = [];

  for (const building of submission.buildings) {
    const base = generateBase("36", ringCentroid(building.ring));
    const taken = new Map<string, number>();
    for (const volume of building.volumes) {
      const key = `${volume.band}${volume.level}`;
      const index = (taken.get(key) ?? 0) + 1;
      taken.set(key, index);
      records.push({
        ulpin: composeUlpin(base, volume.band, volume.level, String(index).padStart(3, "0")),
        submissionId: submission.id,
        buildingId: building.sourceId,
        label: volume.label,
        band: volume.band,
        level: volume.level,
        footprint: volume.footprint,
        zMin: volume.zMin,
        zMax: volume.zMax,
        use: volume.use,
        holder: "Unrecorded",
        encumbrance: null,
        registeredAt: now,
      });
    }
  }

  return records;
}

export function decide(
  id: string,
  decision: Decision,
  note: string | null,
): { submission: Submission; issued: number } | { error: string } {
  const current = get(id);
  if (!current) return { error: "Submission not found" };
  if (current.state === "approved") return { error: "Submission is already approved" };
  if (current.state === "rejected") return { error: "Submission is already rejected" };

  if (decision === "approve") {
    if (!current.validation.ok) {
      return { error: "Cannot approve: the submission has unresolved critical validation findings" };
    }
    const conflicts = detectConflicts(current.buildings);
    if (conflicts.length) {
      return { error: `Cannot approve: ${conflicts.length} conflict(s) with volumes already on the register` };
    }
  }

  const records = decision === "approve" ? issueRecords(current) : [];
  let updated: Submission | undefined;

  mutate((state) => {
    state.submissions = state.submissions.map((s) => {
      if (s.id !== id) return s;
      updated = {
        ...s,
        state: NEXT_STATE[decision],
        decidedAt: new Date().toISOString(),
        note,
        audit: [
          ...s.audit,
          {
            at: new Date().toISOString(),
            actor: "officer",
            action: decision,
            note,
            from: s.state,
            to: NEXT_STATE[decision],
          },
        ],
      };
      return updated;
    });
    if (records.length) state.records = [...state.records, ...records];
  });

  if (!updated) return { error: "Submission not found" };
  return { submission: updated, issued: records.length };
}

export function verify(ulpin: string): {
  found: boolean;
  registered: boolean;
  encumbered: boolean;
  band?: string;
  level?: number;
  use?: string;
  registeredAt?: string;
} {
  const record = read().records.find((r) => r.ulpin.toUpperCase() === ulpin.trim().toUpperCase());
  if (!record) return { found: false, registered: false, encumbered: false };
  return {
    found: true,
    registered: true,
    encumbered: Boolean(record.encumbrance),
    band: record.band,
    level: record.level,
    use: record.use,
    registeredAt: record.registeredAt,
  };
}
