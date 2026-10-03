import type { DerivedBuilding } from "../pipeline/types";
import type { Decision, Role, Submission, SubmissionState, SubmissionSummary, VerifyResult } from "./types";

const BASE = "/api/registry";

async function call<T>(path: string, role: Role, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-ulpin-role": role,
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string } & T) | null;
  if (!res.ok || !payload?.ok) throw new Error(payload?.error || `Request failed (${res.status})`);
  return payload;
}

export function lodgeSubmission(
  buildings: DerivedBuilding[],
  stateCode: string,
  note: string | null,
): Promise<{ submission: Submission }> {
  return call<{ submission: Submission }>("/submissions", "surveyor", {
    method: "POST",
    body: JSON.stringify({ buildings, stateCode, note }),
  });
}

export function listSubmissions(state?: SubmissionState): Promise<{ submissions: SubmissionSummary[] }> {
  const query = state ? `?state=${state}` : "";
  return call<{ submissions: SubmissionSummary[] }>(`/submissions${query}`, "officer");
}

export function getSubmission(id: string): Promise<{ submission: Submission }> {
  return call<{ submission: Submission }>(`/submissions/${id}`, "officer");
}

export function claimSubmission(id: string, note: string | null): Promise<{ submission: Submission }> {
  return call<{ submission: Submission }>(`/submissions/${id}/claim`, "officer", {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export function decideSubmission(
  id: string,
  decision: Decision,
  note: string | null,
): Promise<{ submission: Submission; issued: number }> {
  return call<{ submission: Submission; issued: number }>(`/submissions/${id}/decide`, "officer", {
    method: "POST",
    body: JSON.stringify({ decision, note }),
  });
}

export function verifyUlpin(ulpin: string): Promise<VerifyResult> {
  return call<VerifyResult>(`/verify/${encodeURIComponent(ulpin)}`, "public");
}
