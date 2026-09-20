import { useCallback, useEffect, useState } from "react";
import {
  claimSubmission,
  decideSubmission,
  getSubmission,
  listSubmissions,
} from "../../registry/client";
import type { Decision, Submission, SubmissionSummary } from "../../registry/types";
import { useUI } from "../../store/ui";
import { IconAlert, IconCheck, IconRefresh } from "../icons";
import { StateBadge } from "./StateBadge";
import { fieldLabelClass, sectionLabelClass } from "../ui/primitives";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#cc3b2e",
  warning: "#d3a93c",
  info: "#8b8b90",
};

function FindingList({
  title,
  findings,
}: {
  title: string;
  findings: { code: string; severity: string; message: string }[];
}) {
  if (!findings.length) return null;
  return (
    <div className="mt-4">
      <div className={sectionLabelClass}>{title}</div>
      <div className="mt-1.5">
        {findings.slice(0, 40).map((f, i) => (
          <div key={`${f.code}-${i}`} className="flex items-start gap-2 border-b border-line py-2 last:border-b-0">
            <span className="mt-0.5 flex" style={{ color: SEVERITY_COLOR[f.severity] }}>
              <IconAlert size={12} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[10px] text-text">{f.code}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-dim">{f.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReviewQueue() {
  const showToast = useUI((s) => s.showToast);
  const [rows, setRows] = useState<SubmissionSummary[]>([]);
  const [active, setActive] = useState<Submission | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { submissions } = await listSubmissions();
      setRows(submissions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the register");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const open = async (id: string) => {
    setError(null);
    try {
      const { submission } = await getSubmission(id);
      setActive(submission);
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open submission");
    }
  };

  const act = async (fn: () => Promise<Submission>, message: string) => {
    setBusy(true);
    setError(null);
    try {
      setActive(await fn());
      showToast(message);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const claim = () =>
    active && act(async () => (await claimSubmission(active.id, note || null)).submission, "Opened for review");

  const decide = (decision: Decision) =>
    active &&
    act(async () => {
      const result = await decideSubmission(active.id, decision, note || null);
      return result.submission;
    }, decision === "approve" ? "Approved and identifiers issued" : `Submission ${decision}ed`);

  return (
    <div className="flex h-full min-h-0 bg-void">
      <aside className="flex w-[330px] shrink-0 flex-col border-r border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
          <span className={sectionLabelClass}>
            Lodgement queue
          </span>
          <button onClick={refresh} className="text-faint hover:text-text" title="Refresh">
            <IconRefresh size={13} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows.length === 0 && (
            <div className="px-3 py-4 text-[11px] leading-relaxed text-dim">
              Nothing lodged yet. A surveyor submits from the workspace after running the pipeline.
            </div>
          )}
          {rows.map((row) => (
            <button
              key={row.id}
              onClick={() => open(row.id)}
              className={`block w-full border-b border-line px-3 py-2.5 text-left transition-colors hover:bg-hover ${
                active?.id === row.id ? "bg-raised" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-text">{row.reference}</span>
                <StateBadge state={row.state} />
              </div>
              <div className="mt-1 font-mono text-[10px] text-faint">
                {row.buildings} buildings · {row.volumes} volumes
              </div>
              {(row.criticalFindings > 0 || row.conflicts > 0) && (
                <div className="mt-1 flex items-center gap-1 text-[10px] text-[#cc3b2e]">
                  <IconAlert size={11} />
                  {row.conflicts > 0
                    ? `${row.conflicts} register conflict${row.conflicts === 1 ? "" : "s"}`
                    : `${row.criticalFindings} critical`}
                </div>
              )}
            </button>
          ))}
        </div>
      </aside>

      <section className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {!active && (
          <div className="mx-auto mt-16 max-w-md text-center">
            <h2 className="text-[26px] font-light leading-[1.15] tracking-[-0.04em] text-text">
              Pick a lodgement
              <br />
              to review.
            </h2>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              Nothing enters the authoritative record until it clears validation and carries no
              conflict with a volume already registered.
            </p>
          </div>
        )}

        {active && (
          <div className="mx-auto max-w-3xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className={sectionLabelClass}>
                  Lodgement
                </span>
                <h2 className="mt-1 font-mono text-[22px] tracking-tight text-text">
                  {active.reference}
                </h2>
                <div className="mt-1 text-[11px] text-dim">
                  Lodged by {active.lodgedBy} · {new Date(active.lodgedAt).toLocaleString()}
                </div>
              </div>
              <StateBadge state={active.state} />
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2">
              {[
                ["Buildings", active.buildings.length],
                ["Volumes", active.buildings.reduce((n, b) => n + b.volumes.length, 0)],
                ["Critical", active.validation.findings.filter((f) => f.severity === "critical").length],
                ["Conflicts", active.conflicts.length],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-sm border border-line bg-surface px-3 py-2">
                  <div className={fieldLabelClass}>
                    {label as string}
                  </div>
                  <div className="mt-1 text-[16px] text-text">{value as number}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-sm border border-line bg-surface p-4">
              <FindingList title="Conflicts with the register" findings={active.conflicts} />
              <FindingList title="Validation findings" findings={active.validation.findings} />
              {active.conflicts.length === 0 && active.validation.findings.length === 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-[#2f8f6f]">
                  <IconCheck size={12} /> Clean — no findings and no conflicts.
                </div>
              )}
            </div>

            <div className="mt-4 rounded-sm border border-line bg-surface p-4">
              <div className={sectionLabelClass}>
                Audit trail
              </div>
              <div className="mt-2">
                {active.audit.map((entry, i) => (
                  <div key={i} className="flex items-baseline gap-3 border-b border-line py-1.5 last:border-b-0">
                    <span className="font-mono text-[10px] text-faint">
                      {new Date(entry.at).toLocaleTimeString()}
                    </span>
                    <span className="text-[11px] text-text">{entry.actor}</span>
                    <span className="text-[11px] text-dim">{entry.action}</span>
                    {entry.note && <span className="text-[11px] text-faint">— {entry.note}</span>}
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-sm border border-line bg-surface px-3 py-2 text-[11px] text-[#cc3b2e]">
                {error}
              </div>
            )}

            <div className="mt-4 rounded-sm border border-line bg-surface p-4">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note for the record (optional)"
                className="h-9 w-full rounded-sm border border-line bg-base px-3 text-[12px] outline-none focus:border-accent-dim"
              />
              <div className="mt-3 flex items-center gap-2">
                {active.state === "submitted" && (
                  <button
                    onClick={claim}
                    disabled={busy}
                    className="h-8 rounded-sm border border-line px-3 text-[11px] text-dim hover:text-text disabled:opacity-50"
                  >
                    Open for review
                  </button>
                )}
                <button
                  onClick={() => decide("approve")}
                  disabled={busy || active.state === "approved" || active.state === "rejected"}
                  className="h-8 rounded-sm bg-accent px-3 text-[11px] font-medium text-white hover:bg-accent-strong disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  onClick={() => decide("object")}
                  disabled={busy || active.state === "approved" || active.state === "rejected"}
                  className="h-8 rounded-sm border border-line px-3 text-[11px] text-dim hover:text-text disabled:opacity-50"
                >
                  Object
                </button>
                <button
                  onClick={() => decide("reject")}
                  disabled={busy || active.state === "approved" || active.state === "rejected"}
                  className="h-8 rounded-sm border border-line px-3 text-[11px] text-[#cc3b2e] hover:border-[#cc3b2e] disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
