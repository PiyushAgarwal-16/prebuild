import { useMemo, useRef, useState } from "react";
import type { LevelBand, StratumUse, Tenure } from "../types";
import { useRegistry } from "../store/registry";
import { useUI } from "../store/ui";
import { parseGeoJSON } from "../lib/geojson";
import { certificateHTML, exportCertificate } from "../lib/exporters";
import { conflictsFor } from "../lib/conflicts";
import { scaleRing } from "../lib/geo";
import { BAND_LABEL, BAND_ORDER, describeLevel } from "../lib/ulpin";
import { TENURE_LABEL, USE_LABEL } from "../lib/palette";
import { IconClose, IconDocument, IconExport, IconUpload } from "./icons";

function Shell({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="pb-fade fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0.24_0.006_85/0.32)] p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`pb-rise flex max-h-[86vh] w-full flex-col overflow-hidden rounded-md border border-line bg-surface shadow-pop ${
          wide ? "max-w-3xl" : "max-w-md"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[13px] font-semibold">{title}</h2>
          <button onClick={onClose} className="text-faint hover:text-text">
            <IconClose size={15} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

const inputClass =
  "mt-1 w-full rounded-sm border border-line bg-base px-2 py-1.5 text-[11px] outline-none focus:border-accent-dim";
const labelClass = "font-mono text-[9px] uppercase tracking-[0.14em] text-faint";

export function ImportModal() {
  const open = useUI((s) => s.importOpen);
  const setOpen = useUI((s) => s.setImportOpen);
  const showToast = useUI((s) => s.showToast);
  const parcels = useRegistry((s) => s.parcels);
  const ingest = useRegistry((s) => s.ingest);
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");

  if (!open) return null;

  const apply = (raw: string) => {
    try {
      const { parcels: newParcels, strata, skipped } = parseGeoJSON(raw, parcels);
      if (!newParcels.length && !strata.length) {
        showToast("No usable polygons found");
        return;
      }
      ingest(newParcels, strata);
      showToast(
        `Imported ${newParcels.length} parcels, ${strata.length} volumes${skipped ? `, ${skipped} skipped` : ""}`,
      );
      setOpen(false);
      setText("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not parse GeoJSON");
    }
  };

  return (
    <Shell title="Import cadastral GeoJSON" onClose={() => setOpen(false)}>
      <div className="space-y-3 p-4">
        <p className="text-[11px] leading-relaxed text-dim">
          Polygon features become surface parcels and receive a generated 14-character base ULPIN. Features
          carrying <span className="font-mono text-text">ulpin</span>,{" "}
          <span className="font-mono text-text">z_min</span> or{" "}
          <span className="font-mono text-text">feature_kind: "stratum"</span> are registered as vertical
          volumes under whichever parcel contains them.
        </p>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex h-20 w-full flex-col items-center justify-center gap-1.5 rounded-sm border border-dashed border-line-strong text-[11px] text-dim hover:border-accent-dim hover:text-text"
        >
          <IconUpload size={16} />
          Choose a .geojson or .json file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".geojson,.json,application/geo+json,application/json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) apply(await file.text());
          }}
        />
        <div>
          <span className={labelClass}>or paste GeoJSON</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder='{"type":"FeatureCollection","features":[…]}'
            className={`${inputClass} font-mono`}
          />
        </div>
        <button
          onClick={() => apply(text)}
          disabled={!text.trim()}
          className="h-8 w-full rounded-sm bg-text text-[11px] text-base hover:bg-accent disabled:opacity-40"
        >
          Import pasted features
        </button>
      </div>
    </Shell>
  );
}

export function NewVolumeModal() {
  const open = useUI((s) => s.newVolumeOpen);
  const setOpen = useUI((s) => s.setNewVolumeOpen);
  const showToast = useUI((s) => s.showToast);
  const parcels = useRegistry((s) => s.parcels);
  const strata = useRegistry((s) => s.strata);
  const selectedParcelId = useRegistry((s) => s.selectedParcelId);
  const selectedStratumId = useRegistry((s) => s.selectedStratumId);
  const addStratum = useRegistry((s) => s.addStratum);

  const [label, setLabel] = useState("New volume");
  const [band, setBand] = useState<LevelBand>("F");
  const [level, setLevel] = useState(1);
  const [use, setUse] = useState<StratumUse>("residential");
  const [tenure, setTenure] = useState<Tenure>("freehold");
  const [holder, setHolder] = useState("Unrecorded");
  const [height, setHeight] = useState(3.2);
  const [source, setSource] = useState<"parcel" | "copy">("parcel");

  const parcel = parcels.find((p) => p.id === selectedParcelId);
  const template = strata.find((s) => s.id === selectedStratumId);

  const suggestedZ = useMemo(() => {
    const own = strata.filter((s) => s.parcelId === selectedParcelId);
    if (band === "F") {
      const ground = own.find((s) => s.band === "G");
      const base = ground ? ground.zMax : 0;
      return base + (level - 1) * height;
    }
    if (band === "B") return -level * (height + 0.1);
    if (band === "S") return -6 - (level - 1) * height;
    if (band === "G") return 0;
    if (band === "A") return own.reduce((h, s) => Math.max(h, s.zMax), 0);
    return 9 + (level - 1) * height;
  }, [strata, selectedParcelId, band, level, height]);

  if (!open) return null;

  const submit = () => {
    if (!parcel) {
      showToast("Select a parcel first");
      return;
    }
    const footprint =
      source === "copy" && template ? template.footprint : scaleRing(parcel.ring, 0.82);
    const created = addStratum({
      parcelId: parcel.id,
      label,
      band,
      level,
      footprint,
      zMin: suggestedZ,
      zMax: suggestedZ + height,
      use,
      tenure,
      holder,
    });
    showToast(`Registered ${created.ulpin}`);
    setOpen(false);
  };

  return (
    <Shell title="Register vertical volume" onClose={() => setOpen(false)}>
      <div className="space-y-3 p-4">
        <div className="rounded-sm border border-line bg-raised px-3 py-2">
          <span className={labelClass}>Parent parcel</span>
          <div className="mt-1 font-mono text-[12px] text-text">
            {parcel ? `${parcel.ulpinBase} · ${parcel.surveyNumber}` : "No parcel selected"}
          </div>
        </div>

        <label className="block">
          <span className={labelClass}>Description</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
        </label>

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
            <span className={labelClass}>Level</span>
            <input
              type="number"
              min={0}
              max={99}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Use</span>
            <select
              value={use}
              onChange={(e) => setUse(e.target.value as StratumUse)}
              className={inputClass}
            >
              {Object.entries(USE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Tenure</span>
            <select
              value={tenure}
              onChange={(e) => setTenure(e.target.value as Tenure)}
              className={inputClass}
            >
              {Object.entries(TENURE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Holder</span>
            <input value={holder} onChange={(e) => setHolder(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Height (m)</span>
            <input
              type="number"
              step={0.1}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className={inputClass}
            />
          </label>
        </div>

        <div>
          <span className={labelClass}>Footprint</span>
          <div className="mt-1 flex items-center rounded-sm border border-line p-0.5">
            {(
              [
                ["parcel", "Inset from parcel"],
                ["copy", template ? `Copy of ${template.label}` : "Copy selected volume"],
              ] as const
            ).map(([k, text]) => (
              <button
                key={k}
                disabled={k === "copy" && !template}
                onClick={() => setSource(k)}
                className={`h-7 flex-1 truncate rounded-xs px-2 text-[10px] transition-colors disabled:opacity-40 ${
                  source === k ? "bg-raised text-text" : "text-faint hover:text-text"
                }`}
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-sm border border-line bg-raised px-3 py-2 font-mono text-[10px] text-dim">
          {describeLevel(band, level)} · extent {suggestedZ.toFixed(2)} m →{" "}
          {(suggestedZ + height).toFixed(2)} m
        </div>

        <button
          onClick={submit}
          className="h-8 w-full rounded-sm bg-text text-[11px] text-base hover:bg-accent"
        >
          Generate 3D ULPIN & register
        </button>
      </div>
    </Shell>
  );
}

export function CertificateModal() {
  const id = useUI((s) => s.certificateFor);
  const setCertificateFor = useUI((s) => s.setCertificateFor);
  const showToast = useUI((s) => s.showToast);
  const strata = useRegistry((s) => s.strata);
  const parcels = useRegistry((s) => s.parcels);
  const conflicts = useRegistry((s) => s.conflicts);

  const stratum = strata.find((s) => s.id === id);
  const parcel = parcels.find((p) => p.id === stratum?.parcelId);
  const html = useMemo(
    () => (stratum && parcel ? certificateHTML(stratum, parcel, conflictsFor(conflicts, stratum.id)) : ""),
    [stratum, parcel, conflicts],
  );

  if (!stratum || !parcel) return null;

  return (
    <Shell title="3D property card" onClose={() => setCertificateFor(null)} wide>
      <iframe title="property card" srcDoc={html} className="h-[62vh] w-full border-0 bg-void" />
      <div className="flex gap-2 border-t border-line p-3">
        <button
          onClick={async () => {
            try {
              await exportCertificate(stratum, parcel, conflictsFor(conflicts, stratum.id));
              showToast("Property card downloaded");
            } catch {
              showToast("Download failed");
            }
          }}
          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-sm bg-text text-[11px] text-base hover:bg-accent"
        >
          <IconExport size={13} /> Download with 3D view
        </button>
        <button
          onClick={() => {
            const w = window.open("", "_blank");
            if (!w) return showToast("Pop-up blocked");
            w.document.write(html);
            w.document.close();
            w.print();
          }}
          className="flex h-8 items-center justify-center gap-1.5 rounded-sm border border-line px-3 text-[11px] text-dim hover:text-text"
        >
          <IconDocument size={13} /> Print
        </button>
      </div>
    </Shell>
  );
}

export function Toast() {
  const toast = useUI((s) => s.toast);
  if (!toast) return null;
  return (
    <div className="pb-rise pointer-events-none fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-sm border border-line bg-surface px-4 py-2 text-[11px] text-text shadow-pop">
      {toast.message}
    </div>
  );
}
