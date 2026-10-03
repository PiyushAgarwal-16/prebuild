import type { SubmissionState } from "../../registry/types";

const TONE: Record<SubmissionState, { label: string; color: string; border: string }> = {
  draft: { label: "Draft", color: "#8b8b90", border: "#d7d5d1" },
  submitted: { label: "Submitted", color: "#5d50e6", border: "#a79cff" },
  under_review: { label: "Under review", color: "#8a6420", border: "#d3a93c" },
  approved: { label: "Approved", color: "#2f8f6f", border: "#2f8f6f" },
  objected: { label: "Objected", color: "#b4553f", border: "#d3a93c" },
  rejected: { label: "Rejected", color: "#cc3b2e", border: "#cc3b2e" },
};

export function StateBadge({ state }: { state: SubmissionState }) {
  const tone = TONE[state];
  return (
    <span
      className="rounded-xs border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]"
      style={{ color: tone.color, borderColor: tone.border }}
    >
      {tone.label}
    </span>
  );
}
