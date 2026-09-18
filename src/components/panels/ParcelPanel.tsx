import { useMemo } from "react";
import type { LevelBand, Stratum } from "../../types";
import { useRegistry } from "../../store/registry";
import { useUI } from "../../store/ui";
import { BAND_LABEL, BAND_ORDER, describeLevel } from "../../lib/ulpin";
import { formatArea, ringAreaM2 } from "../../lib/geo";
import { BAND_TINT, TENURE_COLOR, USE_COLOR } from "../../lib/palette";
import { IconEye, IconEyeOff, IconStack } from "../icons";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-2 pt-3 font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
      {children}
    </div>
  );
}

export function ParcelPanel() {
  const parcels = useRegistry((s) => s.parcels);
  const strata = useRegistry((s) => s.strata);
  const conflicts = useRegistry((s) => s.conflicts);
  const selectedParcelId = useRegistry((s) => s.selectedParcelId);
  const selectedStratumId = useRegistry((s) => s.selectedStratumId);
  const selectParcel = useRegistry((s) => s.selectParcel);
  const selectStratum = useRegistry((s) => s.selectStratum);

  const bands = useUI((s) => s.bands);
  const toggleBand = useUI((s) => s.toggleBand);
  const explode = useUI((s) => s.explode);
  const setExplode = useUI((s) => s.setExplode);
  const colorBy = useUI((s) => s.colorBy);
  const setColorBy = useUI((s) => s.setColorBy);

  const flagged = useMemo(() => {
    const set = new Set<string>();
    for (const c of conflicts) if (c.severity === "critical") c.subjects.forEach((id) => set.add(id));
    return set;
  }, [conflicts]);

  const grouped = useMemo(() => {
    const own = strata.filter((s) => s.parcelId === selectedParcelId);
    const map = new Map<LevelBand, Stratum[]>();
    for (const s of own) {
      const list = map.get(s.band) ?? [];
      list.push(s);
      map.set(s.band, list);
    }
    for (const list of map.values()) list.sort((a, b) => b.zMin - a.zMin);
    return BAND_ORDER.filter((b) => map.has(b))
      .reverse()
      .map((b) => [b, map.get(b)!] as const);
  }, [strata, selectedParcelId]);

  return (
    <aside className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-md border border-line bg-surface">
      <SectionLabel>Surface parcels</SectionLabel>
      <div className="max-h-[30%] overflow-y-auto px-2 pb-2">
        {parcels.map((p) => {
          const own = strata.filter((s) => s.parcelId === p.id);
          const active = p.id === selectedParcelId;
          return (
            <button
              key={p.id}
              onClick={() => selectParcel(p.id)}
              className={`mb-1 w-full rounded-sm border px-2.5 py-2 text-left transition-colors ${
                active ? "border-accent-dim bg-raised" : "border-transparent hover:bg-hover"
              }`}
            >
              <div className="font-mono text-[10px] tracking-wide text-accent">{p.ulpinBase}</div>
              <div className="mt-0.5 truncate text-[12px] text-text">{p.surveyNumber}</div>
              <div className="mt-0.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-faint">
                <span>{formatArea(ringAreaM2(p.ring))}</span>
                <span>{own.length} volumes</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="border-t border-line">
        <SectionLabel>Vertical bands</SectionLabel>
        <div className="grid grid-cols-3 gap-1 px-2 pb-3">
          {BAND_ORDER.map((b) => {
            const on = bands[b];
            const count = strata.filter((s) => s.band === b && s.parcelId === selectedParcelId).length;
            return (
              <button
                key={b}
                onClick={() => toggleBand(b)}
                title={BAND_LABEL[b]}
                className={`flex h-12 flex-col items-center justify-center gap-0.5 rounded-sm border text-[10px] transition-colors ${
                  on ? "border-line bg-raised text-text" : "border-transparent text-faint hover:bg-hover"
                }`}
              >
                <span
                  className="h-1.5 w-6 rounded-full"
                  style={{ background: on ? BAND_TINT[b] : "var(--color-line-strong)" }}
                />
                <span className="font-mono">{b}</span>
                <span className="font-mono text-[9px] text-faint">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-line px-3 py-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
            Explode stack
          </span>
          <span className="font-mono text-[10px] text-dim">{explode.toFixed(1)}×</span>
        </div>
        <input
          type="range"
          min={0}
          max={3}
          step={0.1}
          value={explode}
          onChange={(e) => setExplode(Number(e.target.value))}
          className="mt-2 w-full"
        />
        <div className="mt-3 flex items-center rounded-sm border border-line p-0.5">
          {(["use", "tenure"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setColorBy(c)}
              className={`h-6 flex-1 rounded-xs text-[10px] capitalize transition-colors ${
                colorBy === c ? "bg-raised text-text" : "text-faint hover:text-text"
              }`}
            >
              colour by {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-t border-line">
        <SectionLabel>
          <span className="flex items-center gap-1.5">
            <IconStack size={11} /> Strata stack
          </span>
        </SectionLabel>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {grouped.map(([band, list]) => (
            <div key={band} className="mb-2">
              <div className="flex items-center gap-1.5 px-1 pb-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: BAND_TINT[band] }} />
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-dim">
                  {BAND_LABEL[band]}
                </span>
                <span className="font-mono text-[9px] text-faint">{list.length}</span>
                <div className="flex-1" />
                <button onClick={() => toggleBand(band)} className="text-faint hover:text-text">
                  {bands[band] ? <IconEye size={12} /> : <IconEyeOff size={12} />}
                </button>
              </div>
              {list.map((s) => {
                const active = s.id === selectedStratumId;
                return (
                  <button
                    key={s.id}
                    onClick={() => selectStratum(s.id)}
                    className={`mb-0.5 flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors ${
                      active ? "bg-raised" : "hover:bg-hover"
                    } ${bands[band] ? "" : "opacity-40"}`}
                  >
                    <span
                      className="h-5 w-1 shrink-0 rounded-full"
                      style={{ background: colorBy === "use" ? USE_COLOR[s.use] : TENURE_COLOR[s.tenure] }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] text-text">{s.label}</span>
                      <span className="block truncate font-mono text-[9px] text-faint">
                        {describeLevel(s.band, s.level)} · {s.zMin.toFixed(1)}–{s.zMax.toFixed(1)} m
                      </span>
                    </span>
                    {flagged.has(s.id) && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#cc3b2e]" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          {!grouped.length && (
            <p className="px-2 py-4 text-[11px] leading-relaxed text-faint">
              No vertical volumes registered on this parcel yet. Use <b className="text-dim">+ Volume</b> to
              record one.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
