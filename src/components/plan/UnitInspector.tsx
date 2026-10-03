import type { PlanUnit, PlanUnitKind } from "../../lib/plan";
import { fieldLabelClass } from "../ui/primitives";
import { IconPlus, IconTrash } from "../icons";

const KINDS: PlanUnitKind[] = [
  "apartment",
  "commercial",
  "common",
  "circulation",
  "service",
  "parking",
];

const numberClass =
  "h-7 w-full rounded-sm border border-line bg-base px-1.5 text-right font-mono text-[11px] outline-none focus:border-accent-dim";

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className={fieldLabelClass}>{label}</span>
      <input
        type="number"
        step={0.1}
        value={Number(value.toFixed(2))}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className={`${numberClass} mt-1`}
      />
    </label>
  );
}

export function UnitInspector({
  unit,
  index,
  onChange,
  onDelete,
  onAdd,
}: {
  unit: PlanUnit | null;
  index: number | null;
  onChange: (index: number, next: PlanUnit) => void;
  onDelete: (index: number) => void;
  onAdd: () => void;
}) {
  if (!unit || index === null) {
    return (
      <div className="flex h-full flex-col justify-between rounded-sm border border-line bg-surface p-3">
        <p className="text-[11px] leading-relaxed text-faint">
          Select a space on the plan to correct its position, size or classification. The model
          proposes; you certify.
        </p>
        <button
          onClick={onAdd}
          className="mt-3 flex h-8 items-center justify-center gap-1.5 rounded-sm border border-line text-[11px] text-dim hover:text-text"
        >
          <IconPlus size={12} /> Add a space
        </button>
      </div>
    );
  }

  const set = (patch: Partial<PlanUnit>) => onChange(index, { ...unit, ...patch });

  return (
    <div className="flex h-full flex-col rounded-sm border border-line bg-surface p-3">
      <span className={fieldLabelClass}>Label</span>
      <input
        value={unit.label}
        onChange={(e) => set({ label: e.target.value })}
        className="mt-1 h-7 w-full rounded-sm border border-line bg-base px-2 text-[12px] outline-none focus:border-accent-dim"
      />

      <span className={`${fieldLabelClass} mt-3 block`}>Kind</span>
      <select
        value={unit.kind}
        onChange={(e) => set({ kind: e.target.value as PlanUnitKind })}
        className="mt-1 h-7 w-full rounded-sm border border-line bg-base px-1.5 text-[11px] outline-none focus:border-accent-dim"
      >
        {KINDS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Num label="centre x" value={unit.x} onChange={(x) => set({ x })} />
        <Num label="centre z" value={unit.z} onChange={(z) => set({ z })} />
        <Num label="width" value={unit.w} onChange={(w) => set({ w: Math.max(0.2, w) })} />
        <Num label="depth" value={unit.d} onChange={(d) => set({ d: Math.max(0.2, d) })} />
      </div>

      <div className="mt-2 font-mono text-[10px] text-faint">
        {(unit.w * unit.d).toFixed(1)} m² floor area
      </div>

      <div className="mt-auto flex items-center gap-2 pt-3">
        <button
          onClick={onAdd}
          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-sm border border-line text-[11px] text-dim hover:text-text"
        >
          <IconPlus size={12} /> Add
        </button>
        <button
          onClick={() => onDelete(index)}
          className="flex h-8 items-center justify-center gap-1.5 rounded-sm border border-line px-2.5 text-[11px] text-[#cc3b2e] hover:border-[#cc3b2e]"
        >
          <IconTrash size={12} /> Delete
        </button>
      </div>
    </div>
  );
}
