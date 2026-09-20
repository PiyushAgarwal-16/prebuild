import type { Parcel, Stratum, StratumUse, Tenure } from "../types";
import { ringAreaM2, ringCentroid } from "../lib/geo";
import { composeUlpin, generateBase } from "../lib/ulpin";
import type { DerivedBuilding } from "./types";

const USES = new Set<StratumUse>([
  "residential",
  "commercial",
  "parking",
  "utility",
  "transport",
  "airspace",
  "common",
  "structural",
]);

const TENURE_BY_KIND: Record<string, Tenure> = {
  unit: "freehold",
  common: "common",
  parking: "common",
  plant: "common",
};

let counter = 0;
const newId = (prefix: string) => `${prefix}-osm-${Date.now().toString(36)}-${(counter++).toString(36)}`;

function asUse(value: string): StratumUse {
  return USES.has(value as StratumUse) ? (value as StratumUse) : "commercial";
}

export function toRegistry(buildings: DerivedBuilding[]): { parcels: Parcel[]; strata: Stratum[] } {
  const parcels: Parcel[] = [];
  const strata: Stratum[] = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const building of buildings) {
    const centroid = ringCentroid(building.ring);
    const parcelId = newId("parcel");
    const ulpinBase = generateBase("36", centroid);

    parcels.push({
      id: parcelId,
      ulpinBase,
      ulpinSource: "generated",
      ring: building.ring,
      surveyNumber: building.sourceId,
      jurisdiction: {
        stateCode: "36",
        stateName: "Telangana",
        districtCode: "000",
        districtName: "Unresolved",
        villageCode: "000000",
        villageName: "Unresolved",
      },
      groundElevation: building.groundElevationM ?? 0,
      landUse: building.name ?? "Building footprint (OpenStreetMap)",
      holder: "Unrecorded",
      registeredOn: today,
    });

    const taken = new Map<string, number>();
    for (const volume of building.volumes) {
      const key = `${volume.band}${volume.level}`;
      const index = (taken.get(key) ?? 0) + 1;
      taken.set(key, index);
      const unit = String(index).padStart(3, "0");
      const area = ringAreaM2(volume.footprint);

      strata.push({
        id: newId("stratum"),
        parcelId,
        ulpin: composeUlpin(ulpinBase, volume.band, volume.level, unit),
        label: volume.label,
        band: volume.band,
        level: volume.level,
        unit,
        footprint: volume.footprint,
        zMin: volume.zMin,
        zMax: volume.zMax,
        use: asUse(volume.use),
        tenure: TENURE_BY_KIND[volume.kind] ?? "freehold",
        holder: "Unrecorded",
        carpetArea: Number((area * 0.78).toFixed(1)),
        builtUpArea: Number(area.toFixed(1)),
        registeredOn: today,
      });
    }
  }

  return { parcels, strata };
}
