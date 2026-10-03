import type { DerivedBuilding, Finding, ValidationReport } from "../pipeline/types.js";

export type Role = "surveyor" | "officer" | "public";

export type SubmissionState =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "objected"
  | "rejected";

export type Decision = "approve" | "object" | "reject";

export interface AuditEntry {
  at: string;
  actor: Role;
  action: string;
  note: string | null;
  from: SubmissionState | null;
  to: SubmissionState | null;
}

export interface Submission {
  id: string;
  reference: string;
  state: SubmissionState;
  lodgedBy: Role;
  lodgedAt: string;
  decidedAt: string | null;
  buildings: DerivedBuilding[];
  validation: ValidationReport;
  conflicts: Finding[];
  note: string | null;
  audit: AuditEntry[];
}

export interface RegisteredVolume {
  ulpin: string;
  submissionId: string;
  buildingId: string;
  label: string;
  band: string;
  level: number;
  footprint: [number, number][];
  zMin: number;
  zMax: number;
  use: string;
  holder: string;
  encumbrance: string | null;
  registeredAt: string;
}

export interface RegistryFile {
  submissions: Submission[];
  records: RegisteredVolume[];
}
