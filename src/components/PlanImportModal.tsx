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
import { PlanEditor } from "./plan/PlanEditor";
import { UnitInspector } from "./plan/UnitInspector";
import { validatePlan } from "../lib/planValidation";
import type { PlanUnit } from "../lib/plan";
import { IconAlert, IconSparkle, IconUpload } from "./icons";

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
  const [selectedUnit, setSelectedUnit] = useState<number | null>(null);
  const [showImage, setShowImage] = useState(true);
  const [underlay, setUnderlay] = useState({ x: 0, z: 0, scale: 1.4 });

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
  const report = useMemo(
    () => (plan ? validatePlan(plan) : { findings: [], invalid: new Set<number>(), ok: true, coverage: 0 }),
    [plan],
  );

  const setUnits = (units: PlanUnit[]) => setPlan((p) => (p ? { ...p, units } : p));
  const updateUnit = (index: number, next: PlanUnit) =>
    setPlan((p) => (p ? { ...p, units: p.units.map((u, i) => (i === index ? next : u)) } : p));
  const deleteUnit = (index: number) => {
    setPlan((p) => (p ? { ...p, units: p.units.filter((_, i) => i !== index) } : p));
    setSelectedUnit(null);
  };
  const addUnit = () =>
    setPlan((p) => {
      if (!p) return p;
      const unit: PlanUnit = { label: `Space ${p.units.length + 1}`, kind: "apartment", x: 0, z: 0, w: 4, d: 4 };
      setSelectedUnit(p.units.length);
      return { ...p, units: [...p.units, unit] };
    });

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
    <Shell title="Digitise floor plan" onClose={() => setOpen(false)} xwide>
      <div className="grid gap-4 p-4 md:grid-cols-[330px_1fr]">
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
                Vision extraction needs <span className="font-mono">OPENAI_API_KEY</span> set for the dev
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
              <div className="grid grid-cols-[1fr_210px] gap-2">
                <PlanEditor
                  plan={plan}
                  report={report}
                  image={image}
                  showImage={showImage}
                  underlay={underlay}
                  selected={selectedUnit}
                  onSelect={setSelectedUnit}
                  onChange={setUnits}
                />
                <UnitInspector
                  unit={selectedUnit === null ? null : (plan.units[selectedUnit] ?? null)}
                  index={selectedUnit}
                  onChange={updateUnit}
                  onDelete={deleteUnit}
                  onAdd={addUnit}
                />
              </div>

              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-faint">
                <span>
                  {plan.units.length} spaces · {plan.buildingW.toFixed(1)} × {plan.buildingD.toFixed(1)} m ·
                  {" "}{(report.coverage * 100).toFixed(0)}% assigned
                </span>
                <label className="flex items-center gap-1.5 normal-case tracking-normal">
                  <input type="checkbox" checked={showImage} onChange={(e) => setShowImage(e.target.checked)} />
                  plan underlay
                </label>
              </div>

              {image && showImage && (
                <div className="flex items-center gap-3 rounded-sm border border-line bg-raised px-2.5 py-1.5">
                  <span className={labelClass}>align underlay</span>
                  <input
                    type="range"
                    min={0.6}
                    max={2.6}
                    step={0.02}
                    value={underlay.scale}
                    onChange={(e) => setUnderlay((u) => ({ ...u, scale: Number(e.target.value) }))}
                    className="flex-1"
                    title="Scale the drawing until its building outline matches the footprint"
                  />
                  <div className="flex items-center gap-1">
                    {([
                      ["←", { x: -0.25, z: 0 }],
                      ["→", { x: 0.25, z: 0 }],
                      ["↑", { x: 0, z: -0.25 }],
                      ["↓", { x: 0, z: 0.25 }],
                    ] as const).map(([glyph, delta]) => (
                      <button
                        key={glyph}
                        onClick={() => setUnderlay((u) => ({ ...u, x: u.x + delta.x, z: u.z + delta.z }))}
                        className="h-6 w-6 rounded-xs border border-line text-[11px] text-dim hover:text-text"
                      >
                        {glyph}
                      </button>
                    ))}
                    <button
                      onClick={() => setUnderlay({ x: 0, z: 0, scale: 1.4 })}
                      className="ml-1 h-6 rounded-xs border border-line px-1.5 text-[10px] text-dim hover:text-text"
                    >
                      reset
                    </button>
                  </div>
                </div>
              )}

              {report.findings.length > 0 ? (
                <div className="max-h-28 overflow-y-auto rounded-sm border border-line bg-raised p-2">
                  {report.findings.slice(0, 12).map((f, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedUnit(f.units[0] ?? null)}
                      className="flex w-full items-start gap-1.5 py-1 text-left text-[11px] leading-snug text-[#8a3226] hover:underline"
                    >
                      <IconAlert size={11} className="mt-0.5 shrink-0" />
                      {f.message}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-sm border border-line bg-raised px-2 py-1.5 text-[11px] text-[#2f6a4b]">
                  No overlaps, nothing outside the footprint — ready to certify.
                </div>
              )}
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
            disabled={!plan || !parcel || !report.ok}
            title={
              plan && !report.ok
                ? "Resolve the overlaps and out-of-bounds spaces before registering"
                : undefined
            }
            className="h-8 w-full rounded-sm bg-accent text-[11px] font-medium text-white hover:bg-accent-strong disabled:opacity-40"
          >
            {plan && !report.ok ? "Corrections needed" : "Certify & generate ULPINs"}
          </button>
        </div>
      </div>
    </Shell>
  );
}
