import { useEffect, useMemo, useState } from "react";
import { useRegistry } from "../../store/registry";
import { useUI } from "../../store/ui";
import { useViewport } from "../../store/viewport";
import { runPipeline } from "../../pipeline/client";
import { lodgeSubmission } from "../../registry/client";
import { toRegistry } from "../../pipeline/ingest";
import type { PipelineResult } from "../../pipeline/types";
import { IconAlert, IconCheck, IconClose, IconStack } from "../icons";
import { fieldLabelClass } from "../ui/primitives";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#cc3b2e",
  warning: "#d3a93c",
  info: "#8b8b90",
};

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-line bg-raised px-3 py-2">
      <div className={fieldLabelClass}>{label}</div>
      <div className="mt-1 text-[15px] text-text">{value}</div>
    </div>
  );
}

export function PipelineModal() {
  const open = useUI((s) => s.pipelineOpen);
  const setOpen = useUI((s) => s.setPipelineOpen);
  const showToast = useUI((s) => s.showToast);
  const bounds = useViewport((s) => s.bounds);
  const ingest = useRegistry((s) => s.ingest);

  const [infer, setInfer] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [lodging, setLodging] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const grouped = useMemo(() => {
    if (!result) return [];
    const map = new Map<string, { severity: string; count: number; sample: string }>();
    for (const f of result.report.findings) {
      const entry = map.get(f.code);
      if (entry) entry.count += 1;
      else map.set(f.code, { severity: f.severity, count: 1, sample: f.message });
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [result]);

  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 250);
    return () => clearInterval(timer);
  }, [busy]);

  if (!open) return null;

  const run = async () => {
    if (!bounds) {
      setError("Pan the map once so the viewport bounds are known.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await runPipeline(bounds, infer));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pipeline failed");
    } finally {
      setBusy(false);
    }
  };

  const lodge = async () => {
    if (!result) return;
    setLodging(true);
    setError(null);
    try {
      const { submission } = await lodgeSubmission(result.buildings, null);
      showToast(`${submission.reference} lodged for review`);
      setOpen(false);
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lodgement failed");
    } finally {
      setLodging(false);
    }
  };

  const commit = () => {
    if (!result) return;
    const { parcels, strata } = toRegistry(result.buildings, result.jurisdiction);
    if (!parcels.length) {
      showToast("Nothing to ingest");
      return;
    }
    ingest(parcels, strata);
    showToast(`${parcels.length} buildings, ${strata.length} volumes ingested`);
    setOpen(false);
    setResult(null);
  };

  return (
    <div className="pb-fade fixed inset-0 z-50 flex items-center justify-center bg-[#252527]/40 p-6">
      <div className="pb-rise flex max-h-[84vh] w-[620px] flex-col overflow-hidden rounded-sm border border-line bg-surface shadow-pop">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <IconStack size={14} className="text-accent" />
            <span className="text-[13px] font-medium text-text">Fetch raised buildings</span>
          </div>
          <button onClick={() => setOpen(false)} className="text-faint hover:text-text">
            <IconClose size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="text-[12px] leading-relaxed text-dim">
            Pulls building footprints with storey counts from OpenStreetMap for the current viewport,
            samples terrain for a ground datum, derives one volume per level, and validates the stack
            before anything is allowed into the register.
          </p>

          <div className="mt-3 font-mono text-[10px] text-faint">
            {(() => {
              const box = result?.bbox ?? bounds;
              if (!box) return "viewport bounds unknown";
              return `${box.south.toFixed(4)}, ${box.west.toFixed(4)} → ${box.north.toFixed(4)}, ${box.east.toFixed(4)}`;
            })()}
          </div>
          {result?.widened && (
            <div className="mt-1 text-[10px] leading-relaxed text-faint">
              Your viewport was narrower than 1.2 km, so the search area was widened around its
              centre — a tighter box returns too few buildings to be worth validating.
            </div>
          )}

          <label className="mt-3 flex items-center gap-2 text-[12px] text-dim">
            <input type="checkbox" checked={infer} onChange={(e) => setInfer(e.target.checked)} />
            Use model inference to classify each level
          </label>

          {busy && (
            <div className="mt-3 rounded-sm border border-line bg-raised px-3 py-2 text-[11px] text-dim">
              <span className="pb-shimmer">
                {elapsed < 6
                  ? "Querying OpenStreetMap for building footprints…"
                  : elapsed < 14
                    ? "Sampling terrain for a ground datum…"
                    : infer
                      ? "Classifying each level with the model…"
                      : "Deriving and validating volumes…"}
              </span>
              <span className="ml-2 font-mono text-[10px] text-faint">{elapsed}s</span>
              {infer && elapsed > 20 && (
                <div className="mt-1 text-[10px] leading-relaxed text-faint">
                  Model inference is the slow part. Untick it for a result in a few seconds.
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-sm border border-line bg-raised px-3 py-2 text-[11px] text-[#cc3b2e]">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-4">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Buildings" value={result.buildings.length} />
                <Stat
                  label="Volumes"
                  value={result.buildings.reduce((n, b) => n + b.volumes.length, 0)}
                />
                <Stat
                  label="Gate"
                  value={
                    <span className={result.report.ok ? "text-[#2f8f6f]" : "text-[#cc3b2e]"}>
                      {result.report.ok ? "passed" : "blocked"}
                    </span>
                  }
                />
              </div>

              <div className="mt-2 flex items-center gap-2 text-[11px]">
                <span className={fieldLabelClass}>jurisdiction</span>
                <span className={result.jurisdiction.resolved ? "text-text" : "text-[#8a6420]"}>
                  {result.jurisdiction.resolved
                    ? `${result.jurisdiction.villageName} · ${result.jurisdiction.districtName} · ${result.jurisdiction.stateName} (${result.jurisdiction.stateCode})`
                    : "Could not be resolved — identifiers will carry state code 00"}
                </span>
              </div>

              <div className="mt-3 text-[11px] text-dim">
                {result.inference.applied > 0
                  ? `${result.inference.model} classified ${result.inference.applied} of ${result.inference.attempted} candidate buildings.`
                  : result.inference.error
                    ? `Inference unavailable — ${result.inference.error}`
                    : "No building carried enough evidence for inference."}
              </div>

              <div className={`mt-3 ${fieldLabelClass}`}>
                Validation findings
              </div>
              <div className="mt-1.5 flex flex-col">
                {grouped.length === 0 && (
                  <div className="flex items-center gap-1.5 py-2 text-[11px] text-[#2f8f6f]">
                    <IconCheck size={12} /> No findings raised.
                  </div>
                )}
                {grouped.map(([code, entry]) => (
                  <div key={code} className="flex items-start gap-2 border-b border-line py-2 last:border-b-0">
                    <span className="mt-0.5 flex" style={{ color: SEVERITY_COLOR[entry.severity] }}>
                      <IconAlert size={12} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-[10px] text-text">{code}</span>
                        <span className="font-mono text-[10px] text-faint">×{entry.count}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] leading-snug text-dim">{entry.sample}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 text-[10px] leading-relaxed text-faint">
                {result.sources.buildings} · terrain {result.sources.terrain}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line px-4 py-3">
          <button
            onClick={() => setOpen(false)}
            className="text-[11px] text-dim hover:text-text"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={run}
              disabled={busy}
              className="h-8 rounded-sm border border-line px-3 text-[11px] text-dim hover:text-text disabled:opacity-50"
            >
              {busy ? `Running… ${elapsed}s` : result ? "Run again" : "Run pipeline"}
            </button>
            <button
              onClick={commit}
              disabled={!result || busy || lodging}
              className="h-8 rounded-sm border border-line px-3 text-[11px] text-dim hover:text-text disabled:opacity-50"
            >
              Add to workspace
            </button>
            <button
              onClick={lodge}
              disabled={!result || !result.report.ok || busy || lodging}
              title={
                result && !result.report.ok
                  ? "Resolve the critical findings before lodging"
                  : "Lodge this set for an officer to review"
              }
              className="h-8 rounded-sm bg-accent px-3 text-[11px] font-medium text-white hover:bg-accent-strong disabled:opacity-40"
            >
              {lodging ? "Lodging…" : "Lodge for review"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
