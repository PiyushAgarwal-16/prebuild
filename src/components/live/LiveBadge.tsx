import { selectFeedAgeMs, useLive } from "../../store/live";
import { formatAge, STATUS_COLOR, STATUS_LABEL } from "../../live/format";

export function LiveBadge() {
  const status = useLive((s) => s.status);
  const synthetic = useLive((s) => s.synthetic);
  const age = useLive(selectFeedAgeMs);

  return (
    <div className="flex items-center gap-2 rounded-sm border border-line bg-surface/95 px-2 py-1 shadow-soft">
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: STATUS_COLOR[status] }}
        aria-hidden
      />
      <span className="text-[11px] font-medium text-text">{STATUS_LABEL[status]}</span>
      <span className="font-mono text-[10px] text-faint">{formatAge(age)}</span>
      {synthetic && (
        <span className="rounded-xs border border-line px-1 font-mono text-[9px] uppercase tracking-wide text-faint">
          Synthetic
        </span>
      )}
    </div>
  );
}
