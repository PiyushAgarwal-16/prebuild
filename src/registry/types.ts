import type { DerivedBuilding, Finding, ValidationReport } from "../pipeline/types";

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

export interface SubmissionSummary {
  id: string;
  reference: string;
  state: SubmissionState;
  lodgedAt: string;
  decidedAt: string | null;
  buildings: number;
  volumes: number;
  criticalFindings: number;
  conflicts: number;
  note: string | null;
}

export interface Submission {
  id: string;
  reference: string;
  state: SubmissionState;
  lodgedBy: Role;
  lodgedAt: string;
  decidedAt: string | null;
  stateCode: string;
  buildings: DerivedBuilding[];
  validation: ValidationReport;
  conflicts: Finding[];
  note: string | null;
  audit: AuditEntry[];
}

export interface VerifyResult {
  found: boolean;
  registered: boolean;
  encumbered: boolean;
  band?: string;
  level?: number;
  use?: string;
  registeredAt?: string;
}
