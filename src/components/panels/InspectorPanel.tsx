import { useMemo } from "react";
import type { Stratum, StratumUse, Tenure, UlpinSource } from "../../types";
import { useRegistry } from "../../store/registry";
import { useUI } from "../../store/ui";
import { conflictsFor } from "../../lib/conflicts";
import { shareFor } from "../../lib/shares";
import { DocumentVault } from "./DocumentVault";
import { toDerivedBuilding } from "../../registry/fromWorkspace";
import { lodgeSubmission } from "../../registry/client";
import { formatArea, formatLngLat, ringAreaM2, ringCentroid } from "../../lib/geo";
import { BAND_LABEL, describeLevel, parseUlpin, validateUlpin } from "../../lib/ulpin";
import { TENURE_COLOR, TENURE_LABEL, USE_COLOR, USE_LABEL } from "../../lib/palette";
import { IconAlert, IconCheck, IconCopy, IconDocument, IconTrash, IconUpload } from "../icons";
import { fieldLabelClass, microLabelBase, microLabelClass, sectionLabelClass } from "../ui/primitives";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line px-3 py-2">
      <span className={`shrink-0 ${fieldLabelClass}`}>
        {label}
      </span>
      <span className="text-right text-[11px] text-text">{value}</span>
    </div>
  );
}

function Segment({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="rounded-xs px-1.5 py-1 font-mono text-[11px] tracking-wider"
        style={{ background: tone, color: "#faf8f4" }}
      >
        {value}
      </span>
      <span className={microLabelClass}>{label}</span>
    </div>
  );
}

function UlpinCard({ stratum, source }: { stratum: Stratum; source: UlpinSource }) {
  const showToast = useUI((s) => s.showToast);
  const declared = source === "declared";
  const parts = declared ? null : parseUlpin(stratum.ulpin);
  const valid = validateUlpin(stratum.ulpin);

  return (
    <div className="border-b border-line bg-raised px-3 py-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className={sectionLabelClass}>3D ULPIN</span>
          <span
            className={`rounded-xs border px-1 ${microLabelBase} ${
              declared ? "border-accent text-accent" : "border-line text-faint"
            }`}
          >
            {declared ? "declared base" : "generated"}
          </span>
        </span>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(stratum.ulpin);
            showToast("ULPIN copied");
          }}
          className="flex items-center gap-1 text-[10px] text-faint hover:text-text"
        >
          <IconCopy size={11} /> copy
        </button>
      </div>
      <div className="mt-2 select-text break-all font-mono text-[15px] leading-tight tracking-[0.04em] text-text">
        {stratum.ulpin}
      </div>
      {parts && (
        <div className="mt-3 flex items-start gap-1.5">
          <Segment label="parcel geocode" value={parts.base} tone="#3f3b35" />
          <Segment label="level" value={`${parts.band}${String(parts.level).padStart(2, "0")}`} tone="#8a6420" />
          <Segment label="unit" value={parts.unit} tone="#4a6b52" />
          <Segment label="check" value={parts.check} tone="#6b5a7d" />
        </div>
      )}
      {declared ? (
        <div className="mt-3 text-[10px] leading-relaxed text-dim">
          Base taken from an external record. The check character and embedded geocode are not
          recomputed, because the official derivation is not implemented here.
        </div>
      ) : (
        <div
          className={`mt-3 flex items-center gap-1.5 text-[10px] ${
            valid ? "text-[#2f7f5f]" : "text-[#b4553f]"
          }`}
        >
          {valid ? <IconCheck size={12} /> : <IconAlert size={12} />}
          {valid
            ? "Checksum valid — ISO 7064 MOD 37,36"
            : "Checksum failure — record cannot be trusted"}
        </div>
      )}
    </div>
  );
}

function StratumView({ stratum }: { stratum: Stratum }) {
  const parcels = useRegistry((s) => s.parcels);
  const strata = useRegistry((s) => s.strata);
  const conflicts = useRegistry((s) => s.conflicts);
  const updateStratum = useRegistry((s) => s.updateStratum);
  const removeStratum = useRegistry((s) => s.removeStratum);
  const setCertificateFor = useUI((s) => s.setCertificateFor);
  const showToast = useUI((s) => s.showToast);

  const parcel = parcels.find((p) => p.id === stratum.parcelId);
  const own = conflictsFor(conflicts, stratum.id);
  const centroid = useMemo(() => ringCentroid(stratum.footprint), [stratum.footprint]);
  const share = useMemo(
    () => (parcel ? shareFor(parcel, strata, stratum) : null),
    [parcel, strata, stratum],
  );

  return (
    <>
      <UlpinCard stratum={stratum} source={parcel?.ulpinSource ?? "generated"} />

      <div className="px-3 py-3">
        <input
          value={stratum.label}
          onChange={(e) => updateStratum(stratum.id, { label: e.target.value })}
          className="w-full rounded-sm border border-line bg-base px-2 py-1.5 text-[12px] text-text outline-none focus:border-accent-dim"
        />
        <div className={`mt-1.5 ${fieldLabelClass}`}>
          {BAND_LABEL[stratum.band]} · {describeLevel(stratum.band, stratum.level)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 pb-3">
        <label className="block">
          <span className={fieldLabelClass}>Use</span>
          <select
            value={stratum.use}
            onChange={(e) => updateStratum(stratum.id, { use: e.target.value as StratumUse })}
            className="mt-1 w-full rounded-sm border border-line bg-base px-2 py-1.5 text-[11px] outline-none focus:border-accent-dim"
          >
            {Object.entries(USE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={fieldLabelClass}>Tenure</span>
          <select
            value={stratum.tenure}
            onChange={(e) => updateStratum(stratum.id, { tenure: e.target.value as Tenure })}
            className="mt-1 w-full rounded-sm border border-line bg-base px-2 py-1.5 text-[11px] outline-none focus:border-accent-dim"
          >
            {Object.entries(TENURE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={fieldLabelClass}>z min (m)</span>
          <input
            type="number"
            step={0.1}
            value={stratum.zMin}
            onChange={(e) => updateStratum(stratum.id, { zMin: Number(e.target.value) })}
            className="mt-1 w-full rounded-sm border border-line bg-base px-2 py-1.5 font-mono text-[11px] outline-none focus:border-accent-dim"
          />
        </label>
        <label className="block">
          <span className={fieldLabelClass}>z max (m)</span>
          <input
            type="number"
            step={0.1}
            value={stratum.zMax}
            onChange={(e) => updateStratum(stratum.id, { zMax: Number(e.target.value) })}
            className="mt-1 w-full rounded-sm border border-line bg-base px-2 py-1.5 font-mono text-[11px] outline-none focus:border-accent-dim"
          />
        </label>
      </div>

      <div className="border-t border-line">
        <Field
          label="Holder"
          value={
            <input
              value={stratum.holder}
              onChange={(e) => updateStratum(stratum.id, { holder: e.target.value })}
              className="w-44 bg-transparent text-right text-[11px] outline-none focus:text-accent"
            />
          }
        />
        <Field label="Floor" value={`${BAND_LABEL[stratum.band]} · ${describeLevel(stratum.band, stratum.level)}`} />
        <Field
          label="Height range"
          value={
            <span className="font-mono text-[11px]">
              {stratum.zMin.toFixed(2)} m to {stratum.zMax.toFixed(2)} m
              <span className="text-faint"> ({(stratum.zMax - stratum.zMin).toFixed(2)} m)</span>
            </span>
          }
        />
        <Field
          label="Parent ULPIN"
          value={<span className="font-mono text-[10px] text-accent">{parcel?.ulpinBase ?? "—"}</span>}
        />
        <Field label="Footprint" value={formatArea(ringAreaM2(stratum.footprint))} />
        <Field label="Carpet area" value={`${stratum.carpetArea} m²`} />
        <Field label="Built-up area" value={`${stratum.builtUpArea} m²`} />
        <Field label="Centroid" value={<span className="font-mono text-[10px]">{formatLngLat(centroid)}</span>} />
        <Field
          label="Ground datum"
          value={parcel ? `${parcel.groundElevation} m MSL` : "—"}
        />
        <Field label="Survey" value={parcel?.surveyNumber ?? "—"} />
        <Field label="Registered" value={stratum.registeredOn} />
        <Field label="Encumbrance" value={stratum.encumbrance ?? "None recorded"} />
      </div>

      {share && (
        <div className="border-b border-line px-3 py-3">
          <div className={sectionLabelClass}>Share of the parcel</div>
          <div className="mt-2">
            <Field
              label="Undivided land share"
              value={
                <span>
                  <b className="text-[12px]">{share.undividedLandShareM2} m²</b>
                  <span className="text-faint"> of {share.parcelAreaM2} m²</span>
                </span>
              }
            />
            <Field label="Share fraction" value={`${share.sharePct}%`} />
            <Field
              label="Common-area rights"
              value={
                <span>
                  <b className="text-[12px]">{share.commonAreaShareM2} m²</b>
                  <span className="text-faint"> of {share.totalCommonM2} m²</span>
                </span>
              }
            />
            <Field
              label="Basis"
              value={
                <span className="text-[10px] leading-snug text-faint">
                  built-up ÷ {share.totalSaleableM2} m² saleable across {share.saleableUnits} units
                </span>
              }
            />
          </div>
        </div>
      )}

      <DocumentVault stratum={stratum} />

      {own.length > 0 && (
        <div className="px-3 py-3">
          <div className={sectionLabelClass}>Conflicts</div>
          {own.map((c) => (
            <div
              key={c.id}
              className={`mt-2 rounded-sm border px-2.5 py-2 text-[11px] leading-relaxed ${
                c.severity === "critical"
                  ? "border-[#e0b5ae] bg-[#fbeae8] text-[#8a3226]"
                  : "border-[#e6d3a4] bg-[#fcf4e2] text-[#7a5c1e]"
              }`}
            >
              <span className="font-mono text-[9px] uppercase tracking-wider">{c.kind}</span>
              <p className="mt-1">{c.message}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto flex gap-2 border-t border-line p-3">
        <button
          onClick={() => setCertificateFor(stratum.id)}
          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-sm bg-text text-[11px] text-base hover:bg-accent"
        >
          <IconDocument size={13} /> Property card
        </button>
        <button
          onClick={() => {
            removeStratum(stratum.id);
            showToast("Volume removed from register");
          }}
          className="flex h-8 w-9 items-center justify-center rounded-sm border border-line text-faint hover:border-[#cc3b2e] hover:text-[#cc3b2e]"
        >
          <IconTrash size={13} />
        </button>
      </div>
    </>
  );
}

function ParcelView() {
  const parcels = useRegistry((s) => s.parcels);
  const strata = useRegistry((s) => s.strata);
  const conflicts = useRegistry((s) => s.conflicts);
  const selectedParcelId = useRegistry((s) => s.selectedParcelId);
  const selectStratum = useRegistry((s) => s.selectStratum);
  const removeParcel = useRegistry((s) => s.removeParcel);
  const showToast = useUI((s) => s.showToast);

  const parcel = parcels.find((p) => p.id === selectedParcelId);
  if (!parcel)
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="max-w-[210px] text-center text-[11px] leading-relaxed text-faint">
          Select a parcel on the map, or draw a new one with{" "}
          <b className="text-dim">Survey parcel</b>.
        </p>
      </div>
    );

  const own = strata.filter((s) => s.parcelId === parcel.id);
  const parcelConflicts = conflicts.filter((c) => c.parcelId === parcel.id);
  const builtUp = own.reduce((sum, s) => sum + s.builtUpArea, 0);
  const top = own.reduce((h, s) => Math.max(h, s.zMax), 0);
  const bottom = own.reduce((h, s) => Math.min(h, s.zMin), 0);

  return (
    <>
      <div className="border-b border-line bg-raised px-3 py-3">
        <span className={sectionLabelClass}>
          Surface parcel ULPIN
        </span>
        <div className="mt-1.5 select-text font-mono text-[15px] tracking-[0.06em] text-text">
          {parcel.ulpinBase}
        </div>
        <div className="mt-1 text-[11px] text-dim">{parcel.surveyNumber}</div>
      </div>

      <div>
        <Field label="Land use" value={parcel.landUse} />
        <Field label="Holder" value={parcel.holder} />
        <Field label="Village" value={parcel.jurisdiction.villageName} />
        <Field label="District" value={parcel.jurisdiction.districtName} />
        <Field label="State" value={`${parcel.jurisdiction.stateName} (${parcel.jurisdiction.stateCode})`} />
        <Field label="Parcel area" value={formatArea(ringAreaM2(parcel.ring))} />
        <Field label="Centroid" value={<span className="font-mono text-[10px]">{formatLngLat(ringCentroid(parcel.ring))}</span>} />
        <Field label="Ground datum" value={`${parcel.groundElevation} m MSL`} />
        <Field label="Registered volumes" value={String(own.length)} />
        <Field label="Total built-up" value={formatArea(builtUp)} />
        <Field label="Vertical range" value={`${bottom.toFixed(1)} m to ${top.toFixed(1)} m`} />
      </div>

      <div className="px-3 py-3">
        <div className={sectionLabelClass}>
          Parcel conflicts
        </div>
        {parcelConflicts.length === 0 && (
          <p className="mt-2 rounded-sm border border-[#c5ddc9] bg-[#eef5ef] px-2.5 py-2 text-[11px] text-[#2f6a4b]">
            No overlapping claims detected across {own.length} volumes.
          </p>
        )}
        {parcelConflicts.map((c) => (
          <button
            key={c.id}
            onClick={() => selectStratum(c.subjects[0])}
            className={`mt-2 block w-full rounded-sm border px-2.5 py-2 text-left text-[11px] leading-relaxed transition-colors ${
              c.severity === "critical"
                ? "border-[#e0b5ae] bg-[#fbeae8] text-[#8a3226] hover:border-[#cc3b2e]"
                : "border-[#e6d3a4] bg-[#fcf4e2] text-[#7a5c1e] hover:border-[#c9a94e]"
            }`}
          >
            <span className="font-mono text-[9px] uppercase tracking-wider">{c.kind}</span>
            <p className="mt-1">{c.message}</p>
          </button>
        ))}
      </div>

      <div className="mt-auto space-y-2 border-t border-line p-3">
        <button
          onClick={async () => {
            if (!own.length) {
              showToast("Nothing to lodge — this parcel has no volumes");
              return;
            }
            try {
              const { submission } = await lodgeSubmission(
                [toDerivedBuilding(parcel, strata)],
                `${parcel.surveyNumber} · ${own.length} volumes`,
              );
              showToast(`${submission.reference} lodged for review`);
            } catch (err) {
              showToast(err instanceof Error ? err.message : "Lodgement failed");
            }
          }}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-sm bg-accent text-[11px] font-medium text-white hover:bg-accent-strong"
        >
          <IconUpload size={13} /> Lodge parcel for review
        </button>
        <button
          onClick={() => {
            removeParcel(parcel.id);
            showToast("Parcel and its volumes removed");
          }}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-sm border border-line text-[11px] text-faint hover:border-[#cc3b2e] hover:text-[#cc3b2e]"
        >
          <IconTrash size={13} /> Remove parcel
        </button>
      </div>
    </>
  );
}

export function InspectorPanel() {
  const strata = useRegistry((s) => s.strata);
  const selectedStratumId = useRegistry((s) => s.selectedStratumId);
  const stratum = strata.find((s) => s.id === selectedStratumId);

  return (
    <aside className="flex w-[340px] shrink-0 flex-col overflow-y-auto rounded-md border border-line bg-surface">
      {stratum ? <StratumView stratum={stratum} /> : <ParcelView />}
    </aside>
  );
}
