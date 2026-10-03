import { IconCheck, IconClose, IconPolygon } from "../icons";

export function DrawToolbar({
  count,
  onCommit,
  onCancel,
}: {
  count: number;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-md border border-line bg-surface/95 px-3 py-2 shadow-pop">
      <IconPolygon size={14} className="text-accent" />
      <span className="text-xs text-dim">Click corners on the map · {count} placed</span>
      <button
        onClick={onCommit}
        className="flex items-center gap-1 rounded-sm bg-text px-2 py-1 text-[11px] text-base hover:bg-accent"
      >
        <IconCheck size={12} /> Generate ULPIN
      </button>
      <button
        onClick={onCancel}
        className="rounded-sm border border-line px-2 py-1 text-[11px] text-dim hover:text-text"
      >
        <IconClose size={12} />
      </button>
    </div>
  );
}
