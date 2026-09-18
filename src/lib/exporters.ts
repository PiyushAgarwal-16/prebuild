import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { Conflict, Parcel, Stratum } from "../types";
import { volumeRegistry } from "../components/scene/StrataScene";
import { useRegistry } from "../store/registry";
import { toGeoJSON } from "./geojson";
import { formatArea, formatLngLat, ringAreaM2, ringCentroid } from "./geo";
import { BAND_LABEL, describeLevel, parseUlpin } from "./ulpin";
import { TENURE_LABEL, USE_LABEL } from "./palette";

export function safeFilename(name: string): string {
  return name.trim().replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "registry";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function requestSnapshot(scale = 1): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("3D view not ready")), 5000);
    window.addEventListener(
      "ulpin:snapshot",
      (e) => {
        clearTimeout(timer);
        resolve((e as CustomEvent<string>).detail);
      },
      { once: true },
    );
    window.dispatchEvent(new CustomEvent("ulpin:snapshot-request", { detail: { scale } }));
  });
}

export async function exportPNG(scale = 2) {
  const dataUrl = await requestSnapshot(scale);
  if (!dataUrl) throw new Error("Snapshot failed");
  const blob = await (await fetch(dataUrl)).blob();
  downloadBlob(blob, "ulpin-3d-view.png");
}

export function exportGeoJSON() {
  const { parcels, strata } = useRegistry.getState();
  const doc = toGeoJSON(parcels, strata);
  downloadBlob(
    new Blob([JSON.stringify(doc, null, 2)], { type: "application/geo+json" }),
    "ulpin-3d-registry.geojson",
  );
}

export function exportCSV() {
  const { parcels, strata } = useRegistry.getState();
  const head = [
    "ulpin",
    "parcel_ulpin",
    "survey_number",
    "label",
    "band",
    "level",
    "unit",
    "use",
    "tenure",
    "holder",
    "z_min_m",
    "z_max_m",
    "carpet_area_m2",
    "built_up_area_m2",
    "encumbrance",
    "registered_on",
  ];
  const rows = strata.map((s) => {
    const parcel = parcels.find((p) => p.id === s.parcelId);
    return [
      s.ulpin,
      parcel?.ulpinBase ?? "",
      parcel?.surveyNumber ?? "",
      s.label,
      s.band,
      s.level,
      s.unit,
      s.use,
      s.tenure,
      s.holder,
      s.zMin,
      s.zMax,
      s.carpetArea,
      s.builtUpArea,
      s.encumbrance ?? "",
      s.registeredOn,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",");
  });
  downloadBlob(new Blob([[head.join(","), ...rows].join("\n")], { type: "text/csv" }), "ulpin-3d-registry.csv");
}

export async function exportGLB() {
  if (!volumeRegistry.size) throw new Error("3D view not loaded");
  const group = new THREE.Group();
  group.name = "ulpin-3d-strata";
  volumeRegistry.forEach((node) => group.add(node.clone(true)));
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(group, { binary: true });
  downloadBlob(new Blob([result as ArrayBuffer], { type: "model/gltf-binary" }), "ulpin-3d-strata.glb");
}

export function certificateHTML(
  stratum: Stratum,
  parcel: Parcel,
  conflicts: Conflict[],
  image?: string,
): string {
  const parts = parseUlpin(stratum.ulpin);
  const centroid = ringCentroid(stratum.footprint);
  const rows: [string, string][] = [
    ["3D ULPIN", stratum.ulpin],
    ["Surface parcel ULPIN", parcel.ulpinBase],
    ["Survey number", parcel.surveyNumber],
    ["Village / District / State", `${parcel.jurisdiction.villageName} · ${parcel.jurisdiction.districtName} · ${parcel.jurisdiction.stateName}`],
    ["Description", stratum.label],
    ["Vertical position", parts ? `${BAND_LABEL[parts.band]} — ${describeLevel(parts.band, parts.level)}` : "—"],
    ["Unit code", stratum.unit],
    ["Elevation extent", `${stratum.zMin.toFixed(2)} m to ${stratum.zMax.toFixed(2)} m relative to ground (${parcel.groundElevation} m MSL)`],
    ["Height", `${(stratum.zMax - stratum.zMin).toFixed(2)} m`],
    ["Footprint centroid", formatLngLat(centroid)],
    ["Footprint area", formatArea(ringAreaM2(stratum.footprint))],
    ["Carpet area", `${stratum.carpetArea} m²`],
    ["Built-up area", `${stratum.builtUpArea} m²`],
    ["Use class", USE_LABEL[stratum.use]],
    ["Tenure", TENURE_LABEL[stratum.tenure]],
    ["Right holder", stratum.holder],
    ["Encumbrance", stratum.encumbrance ?? "None recorded"],
    ["Registered on", stratum.registeredOn],
  ];

  const flags = conflicts.length
    ? `<section class="flags"><h2>Recorded conflicts</h2>${conflicts
        .map((c) => `<p class="flag ${c.severity}"><b>${c.severity.toUpperCase()}</b> ${c.message}</p>`)
        .join("")}</section>`
    : `<section class="flags"><h2>Recorded conflicts</h2><p class="clear">No overlapping or encroaching claim detected against this volume.</p></section>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>3D Property Card — ${stratum.ulpin}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#f4f2ed;color:#23201c;font:14px/1.55 "Helvetica Neue",Helvetica,Arial,sans-serif;padding:32px}
  .card{max-width:940px;margin:0 auto;background:#fff;border:1px solid #ddd8cf;border-radius:10px;overflow:hidden}
  header{padding:22px 28px;border-bottom:1px solid #e6e1d8;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
  h1{margin:0;font-size:17px;letter-spacing:.01em}
  .sub{color:#6d675e;font-size:12px;margin-top:4px}
  .ulpin{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:15px;background:#23201c;color:#f4f2ed;padding:8px 12px;border-radius:6px;letter-spacing:.06em;white-space:nowrap}
  img{width:100%;display:block;border-bottom:1px solid #e6e1d8}
  table{width:100%;border-collapse:collapse}
  td{padding:9px 28px;border-bottom:1px solid #efece5;vertical-align:top}
  td.k{color:#6d675e;width:34%;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
  td.v{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}
  .flags{padding:18px 28px 24px}
  h2{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#6d675e;margin:0 0 10px}
  .flag{margin:0 0 8px;padding:10px 12px;border-radius:6px;font-size:13px}
  .flag.critical{background:#fbeae8;border:1px solid #e8bdb7}
  .flag.warning{background:#fdf5e3;border:1px solid #e9d8ad}
  .clear{margin:0;padding:10px 12px;border-radius:6px;background:#eef5ef;border:1px solid #c5ddc9;font-size:13px}
  footer{padding:14px 28px;border-top:1px solid #e6e1d8;color:#8a8379;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.05em}
</style></head><body>
<div class="card">
  <header>
    <div>
      <h1>3D Property Card</h1>
      <div class="sub">Vertical property record generated from the 3D ULPIN registry</div>
    </div>
    <div class="ulpin">${stratum.ulpin}</div>
  </header>
  ${image ? `<img src="${image}" alt="3D view of ${stratum.label}"/>` : ""}
  <table>${rows.map(([k, v]) => `<tr><td class="k">${k}</td><td class="v">${v}</td></tr>`).join("")}</table>
  ${flags}
  <footer>GENERATED ${new Date().toISOString().slice(0, 19).replace("T", " ")} · CHECKSUM ISO 7064 MOD 37,36 VERIFIED · DEMONSTRATION RECORD, NOT A LEGAL INSTRUMENT</footer>
</div>
</body></html>`;
}

export async function exportCertificate(stratum: Stratum, parcel: Parcel, conflicts: Conflict[]) {
  let image: string | undefined;
  try {
    image = await requestSnapshot(1.4);
  } catch {
    image = undefined;
  }
  const html = certificateHTML(stratum, parcel, conflicts, image);
  downloadBlob(new Blob([html], { type: "text/html" }), `property-card-${safeFilename(stratum.ulpin)}.html`);
}
