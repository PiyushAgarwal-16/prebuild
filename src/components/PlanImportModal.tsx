import { useEffect, useMemo, useRef, useState } from "react";
import type { LevelBand } from "../types";
import { useRegistry } from "../store/registry";
import { useUI } from "../store/ui";
import {
  EXTRACTION_PROMPT,
  SAMPLE_PLAN,
  fitScale,
  normalizePlan,
  planToStrata,
  type FloorPlan,
} from "../lib/plan";
import { BAND_LABEL, BAND_ORDER } from "../lib/ulpin";
import { USE_COLOR } from "../lib/palette";
import { Shell, inputClass, labelClass } from "./modals";
import { IconAlert, IconSparkle, IconUpload } from "./icons";

const KIND_COLOR: Record<string, string> = {
  apartment: USE_COLOR.residential,
  commercial: USE_COLOR.commercial,
  common: USE_COLOR.common,
  circulation: USE_COLOR.common,
  service: USE_COLOR.utility,
  parking: USE_COLOR.parking,
};

function PlanPreview({ plan }: { plan: FloorPlan }) {
  const pad = 1.5;
  const w = plan.buildingW + pad * 2;
  const d = plan.buildingD + pad * 2;
  return (
    <svg viewBox={`${-w / 2} ${-d / 2} ${w} ${d}`} className="h-44 w-full rounded-sm bg-base">
      <rect
        x={-plan.buildingW / 2}
        y={-plan.buildingD / 2}
        width={plan.buildingW}
        height={plan.buildingD}
        fill="none"
        stroke="var(--color-line-strong)"
        strokeWidth={0.22}
      />
      {plan.units.map((u, i) => (
        <g key={`${u.label}-${i}`}>
          <rect
            x={u.x - u.w / 2}
            y={u.z - u.d / 2}
            width={u.w}
            height={u.d}
            fill={KIND_COLOR[u.kind] ?? "#8a8a8a"}
            fillOpacity={0.3}
            stroke={KIND_COLOR[u.kind] ?? "#8a8a8a"}
            strokeWidth={0.16}
          />
          <text
            x={u.x}
            y={u.z}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={Math.min(1.2, u.w / Math.max(u.label.length, 6) * 1.6)}
            fill="var(--color-text)"
          >
            {u.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function PlanImportModal() {
  const open = useUI((s) => s.planOpen);
  const setOpen = useUI((s) => s.setPlanOpen);
  const showToast = useUI((s) => s.showToast);
  const parcels = useRegistry((s) => s.parcels);
  const strata = useRegistry((s) => s.strata);
  const selectedParcelId = useRegistry((s) => s.selectedParcelId);
  const addStratum = useRegistry((s) => s.addStratum);

  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [plan, setPlan] = useState<FloorPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<{ ready: boolean; model: string } | null>(null);

  const [band, setBand] = useState<LevelBand>("F");
  const [startLevel, setStartLevel] = useState(1);
  const [floors, setFloors] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [holder, setHolder] = useState("Unrecorded");

  const parcel = parcels.find((p) => p.id === selectedParcelId);

  useEffect(() => {
    if (!open) return;
    fetch("/api/plan-status")
      .then((r) => r.json())
      .then((d) => setEngine({ ready: Boolean(d.ready), model: String(d.model ?? "") }))
      .catch(() => setEngine({ ready: false, model: "" }));
  }, [open]);

  const scale = useMemo(() => (plan && parcel ? fitScale(plan, parcel) : 1), [plan, parcel]);

  const baseZ = useMemo(() => {
    const own = strata.filter((s) => s.parcelId === selectedParcelId);
    const ground = own.find((s) => s.band === "G");
    if (band === "B") return -(plan?.storeyHeight ?? 3.2) * startLevel;
    if (band === "G") return 0;
    return (ground ? ground.zMax : 0) + (startLevel - 1) * (plan?.storeyHeight ?? 3.2);
  }, [strata, selectedParcelId, band, startLevel, plan]);

  const preview = useMemo(() => {
    if (!plan || !parcel) return null;
    return planToStrata(plan, parcel, {
      band,
      level: startLevel,
      rotationDeg: rotation,
      zMin: baseZ,
      scale,
      holder,
    });
  }, [plan, parcel, band, startLevel, rotation, baseZ, scale, holder]);

  if (!open) return null;

  const pickFile = async (file: File) => {
    setError(null);
    setPlan(null);
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
    setImage(dataUrl);
  };

  const extract = async () => {
    if (!image) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/extract-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: image, prompt: EXTRACTION_PROMPT }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Extraction failed");
      const normalized = normalizePlan(data.plan);
      if (!normalized.units.length) throw new Error("No separable spaces were found in this plan");
      setPlan(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setBusy(false);
    }
  };

  const commit = () => {
    if (!plan || !parcel) return;
    let created = 0;
    for (let f = 0; f < Math.max(1, floors); f++) {
      const level = band === "B" ? startLevel + f : startLevel + f;
      const zMin = band === "B" ? baseZ - f * plan.storeyHeight : baseZ + f * plan.storeyHeight;
      const { inputs } = planToStrata(plan, parcel, {
        band,
        level,
        rotationDeg: rotation,
        zMin,
        scale,
        holder,
      });
      for (const input of inputs) {
        addStratum(input);
        created++;
      }
    }
    showToast(`Registered ${created} volumes from floor plan`);
    setOpen(false);
    setPlan(null);
    setImage(null);
  };

  return (
    <Shell title="Digitise floor plan" onClose={() => setOpen(false)} wide>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div className="space-y-3">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) await pickFile(file);
            }}
            onClick={() => fileRef.current?.click()}
            className="flex h-44 cursor-pointer items-center justify-center overflow-hidden rounded-sm border border-dashed border-line-strong hover:border-accent-dim"
          >
            {image ? (
              <img src={image} alt="floor plan" className="h-full w-full object-contain" />
            ) : (
              <span className="flex flex-col items-center gap-1.5 text-[11px] text-dim">
                <IconUpload size={16} />
                Drop a floor plan image, or click to choose
              </span>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) await pickFile(file);
            }}
          />

          <div className="flex gap-2">
            <button
              onClick={extract}
              disabled={!image || busy || !engine?.ready}
              className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-sm bg-text text-[11px] text-base hover:bg-accent disabled:opacity-40"
            >
              <IconSparkle size={13} />
              {busy ? "Reading plan…" : "Extract units"}
            </button>
            <button
              onClick={() => {
                setPlan(SAMPLE_PLAN);
                setError(null);
              }}
              className="h-8 rounded-sm border border-line px-3 text-[11px] text-dim hover:text-text"
            >
              Use sample
            </button>
          </div>

          {engine && !engine.ready && (
            <p className="flex items-start gap-1.5 rounded-sm border border-[#e6d3a4] bg-[#fcf4e2] px-2.5 py-2 text-[10px] leading-relaxed text-[#7a5c1e]">
              <IconAlert size={12} />
              <span>
                Vision extraction needs <span className="font-mono">NVIDIA_API_KEY</span> set for the dev
                server. Without it, load the sample plan to exercise the rest of the pipeline.
              </span>
            </p>
          )}
          {error && (
            <p className="rounded-sm border border-[#e0b5ae] bg-[#fbeae8] px-2.5 py-2 text-[10px] leading-relaxed text-[#8a3226]">
              {error}
            </p>
          )}
        </div>

        <div className="space-y-3">
          {plan ? (
            <>
              <PlanPreview plan={plan} />
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-faint">
                <span>
                  {plan.units.length} spaces · {plan.buildingW.toFixed(1)} × {plan.buildingD.toFixed(1)} m
                </span>
                <span>scale {(scale * 100).toFixed(0)}%</span>
              </div>
            </>
          ) : (
            <div className="flex h-44 items-center justify-center rounded-sm border border-line bg-raised px-6 text-center text-[11px] leading-relaxed text-faint">
              Extracted spaces appear here, then are placed on the selected parcel as vertical volumes with
              their own 3D ULPINs.
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={labelClass}>Band</span>
              <select
                value={band}
                onChange={(e) => setBand(e.target.value as LevelBand)}
                className={inputClass}
              >
                {BAND_ORDER.map((b) => (
                  <option key={b} value={b}>
                    {BAND_LABEL[b]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>First level</span>
              <input
                type="number"
                min={0}
                max={99}
                value={startLevel}
                onChange={(e) => setStartLevel(Number(e.target.value))}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Repeat for floors</span>
              <input
                type="number"
                min={1}
                max={60}
                value={floors}
                onChange={(e) => setFloors(Number(e.target.value))}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Holder</span>
              <input value={holder} onChange={(e) => setHolder(e.target.value)} className={inputClass} />
            </label>
          </div>

          <label className="block">
            <span className={labelClass}>Rotation {rotation}°</span>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </label>

          <div className="rounded-sm border border-line bg-raised px-3 py-2 font-mono text-[10px] leading-relaxed text-dim">
            {parcel ? (
              <>
                {parcel.ulpinBase} · {parcel.surveyNumber}
                <br />
                {preview ? preview.inputs.length * Math.max(1, floors) : 0} volumes · z {baseZ.toFixed(2)} m →{" "}
                {(baseZ + (plan?.storeyHeight ?? 0) * Math.max(1, floors)).toFixed(2)} m
                {preview && preview.outside > 0 && (
                  <span className="block text-[#b4553f]">
                    {preview.outside} unit(s) fall outside the parcel — rotate or they will be flagged
                  </span>
                )}
              </>
            ) : (
              "Select a parcel first"
            )}
          </div>

          <button
            onClick={commit}
            disabled={!plan || !parcel}
            className="h-8 w-full rounded-sm bg-text text-[11px] text-base hover:bg-accent disabled:opacity-40"
          >
            Generate ULPINs & register
          </button>
        </div>
      </div>
    </Shell>
  );
}
