import type { LevelBand, Parcel, Ring, Stratum, StratumUse, Tenure } from "../types";
import { pointInRing, ringAreaM2, ringCentroid } from "./geo";
import { composeUlpin, generateBase, parseUlpin, unitCode } from "./ulpin";

interface Feature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
}

export function toGeoJSON(parcels: Parcel[], strata: Stratum[]) {
  const parcelFeatures: Feature[] = parcels.map((p) => ({
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [closeRing(p.ring)] },
    properties: {
      feature_kind: "parcel",
      ulpin_base: p.ulpinBase,
      survey_number: p.surveyNumber,
      land_use: p.landUse,
      holder: p.holder,
      state: p.jurisdiction.stateName,
      district: p.jurisdiction.districtName,
      village: p.jurisdiction.villageName,
      ground_elevation_m: p.groundElevation,
      area_m2: Number(ringAreaM2(p.ring).toFixed(1)),
      registered_on: p.registeredOn,
    },
  }));

  const stratumFeatures: Feature[] = strata.map((s) => ({
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [closeRing(s.footprint).map(([lng, lat]) => [lng, lat, s.zMin])],
    },
    properties: {
      feature_kind: "stratum",
      ulpin: s.ulpin,
      ulpin_base: s.ulpin.slice(0, 14),
      label: s.label,
      band: s.band,
      level: s.level,
      unit: s.unit,
      z_min: s.zMin,
      z_max: s.zMax,
      height_m: Number((s.zMax - s.zMin).toFixed(2)),
      use: s.use,
      tenure: s.tenure,
      holder: s.holder,
      carpet_area_m2: s.carpetArea,
      built_up_area_m2: s.builtUpArea,
      encumbrance: s.encumbrance ?? null,
      registered_on: s.registeredOn,
    },
  }));

  return {
    type: "FeatureCollection" as const,
    name: "3D ULPIN registry extract",
    crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } },
    generated_on: new Date().toISOString(),
    features: [...parcelFeatures, ...stratumFeatures],
  };
}

function closeRing(ring: Ring): Ring {
  if (!ring.length) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}

function openRing(coords: number[][]): Ring {
  const ring = coords.map((c) => [c[0], c[1]] as [number, number]);
  if (ring.length > 1) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) ring.pop();
  }
  return ring;
}

function ringsFrom(geometry: { type: string; coordinates: unknown }): Ring[] {
  if (geometry.type === "Polygon") {
    const coords = geometry.coordinates as number[][][];
    return coords.length ? [openRing(coords[0])] : [];
  }
  if (geometry.type === "MultiPolygon") {
    const coords = geometry.coordinates as number[][][][];
    return coords.map((poly) => openRing(poly[0])).filter((r) => r.length >= 3);
  }
  return [];
}

const str = (v: unknown, fallback: string) =>
  typeof v === "string" && v.trim() ? v.trim() : fallback;
const num = (v: unknown, fallback: number) => (typeof v === "number" && isFinite(v) ? v : fallback);

let importCounter = 0;

export function parseGeoJSON(
  text: string,
  existing: Parcel[],
): { parcels: Parcel[]; strata: Stratum[]; skipped: number } {
  const doc = JSON.parse(text) as { type?: string; features?: Feature[] };
  const features = Array.isArray(doc.features) ? doc.features : [];
  const parcels: Parcel[] = [];
  const pendingStrata: { ring: Ring; props: Record<string, unknown> }[] = [];
  let skipped = 0;

  for (const f of features) {
    if (!f?.geometry) {
      skipped++;
      continue;
    }
    const rings = ringsFrom(f.geometry);
    if (!rings.length) {
      skipped++;
      continue;
    }
    const props = f.properties ?? {};
    const isStratum =
      props.feature_kind === "stratum" || props.ulpin !== undefined || props.z_min !== undefined;
    for (const ring of rings) {
      if (isStratum) pendingStrata.push({ ring, props });
      else parcels.push(parcelFrom(ring, props));
    }
  }

  const pool = [...existing, ...parcels];
  const strata: Stratum[] = [];
  for (const { ring, props } of pendingStrata) {
    const centroid = ringCentroid(ring);
    const host = pool.find((p) => pointInRing(centroid, p.ring));
    if (!host) {
      skipped++;
      continue;
    }
    strata.push(stratumFrom(ring, props, host, strata));
  }

  return { parcels, strata, skipped };
}

function parcelFrom(ring: Ring, props: Record<string, unknown>): Parcel {
  const centroid = ringCentroid(ring);
  const stateCode = str(props.state_code, "29");
  const declared = str(props.ulpin_base, "");
  return {
    id: `parcel-import-${Date.now().toString(36)}-${importCounter++}`,
    ulpinBase: declared.length === 14 ? declared.toUpperCase() : generateBase(stateCode, centroid),
    ring,
    surveyNumber: str(props.survey_number ?? props.survey ?? props.name, "Imported parcel"),
    jurisdiction: {
      stateCode,
      stateName: str(props.state, "Karnataka"),
      districtCode: str(props.district_code, "572"),
      districtName: str(props.district, "Bengaluru Urban"),
      villageCode: str(props.village_code, "615301"),
      villageName: str(props.village, "Imported"),
    },
    groundElevation: num(props.ground_elevation_m, 920),
    landUse: str(props.land_use, "Unclassified"),
    holder: str(props.holder ?? props.owner, "Unrecorded"),
    registeredOn: str(props.registered_on, new Date().toISOString().slice(0, 10)),
  };
}

function stratumFrom(
  ring: Ring,
  props: Record<string, unknown>,
  host: Parcel,
  siblings: Stratum[],
): Stratum {
  const declared = str(props.ulpin, "");
  const parts = parseUlpin(declared);
  const band = (parts?.band ?? (str(props.band, "F")[0] as LevelBand)) || "F";
  const level = parts?.level ?? num(props.level, 1);
  const taken = siblings
    .filter((s) => s.parcelId === host.id && s.band === band && s.level === level)
    .map((s) => s.unit);
  const unit = parts?.unit ?? unitCode(taken.length + 1);
  const zMin = num(props.z_min, 0);
  const zMax = num(props.z_max, zMin + num(props.height_m, 3));
  const area = ringAreaM2(ring);
  return {
    id: `stratum-import-${Date.now().toString(36)}-${importCounter++}`,
    parcelId: host.id,
    ulpin: parts && parts.base === host.ulpinBase ? declared.toUpperCase() : composeUlpin(host.ulpinBase, band, level, unit),
    label: str(props.label ?? props.name, `Imported volume ${siblings.length + 1}`),
    band,
    level,
    unit,
    footprint: ring,
    zMin,
    zMax,
    use: str(props.use, "residential") as StratumUse,
    tenure: str(props.tenure, "freehold") as Tenure,
    holder: str(props.holder ?? props.owner, "Unrecorded"),
    carpetArea: num(props.carpet_area_m2, Number((area * 0.78).toFixed(1))),
    builtUpArea: num(props.built_up_area_m2, Number(area.toFixed(1))),
    registeredOn: str(props.registered_on, new Date().toISOString().slice(0, 10)),
    encumbrance: typeof props.encumbrance === "string" ? props.encumbrance : undefined,
  };
}
