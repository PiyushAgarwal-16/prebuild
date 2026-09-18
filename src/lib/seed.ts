import type { Jurisdiction, LngLat, Parcel, Ring, Stratum, StratumUse, Tenure } from "../types";
import { rectRing, ringAreaM2, unproject } from "./geo";
import { composeUlpin, generateBase } from "./ulpin";
import type { LevelBand } from "../types";

const KARNATAKA: Jurisdiction = {
  stateCode: "29",
  stateName: "Karnataka",
  districtCode: "572",
  districtName: "Bengaluru Urban",
  villageCode: "615301",
  villageName: "Sampangi Rama Nagara",
};

const ORIGIN: LngLat = [77.5946, 12.9716];

interface Draft {
  band: LevelBand;
  level: number;
  unit: string;
  label: string;
  footprint: Ring;
  zMin: number;
  zMax: number;
  use: StratumUse;
  tenure: Tenure;
  holder: string;
  registeredOn: string;
  encumbrance?: string;
}

function makeParcel(
  id: string,
  center: LngLat,
  width: number,
  depth: number,
  surveyNumber: string,
  landUse: string,
  holder: string,
  registeredOn: string,
  groundElevation: number,
): Parcel {
  const ring = rectRing(center, width, depth);
  return {
    id,
    ulpinBase: generateBase(KARNATAKA.stateCode, center),
    ring,
    surveyNumber,
    jurisdiction: KARNATAKA,
    groundElevation,
    landUse,
    holder,
    registeredOn,
  };
}

function materialise(parcel: Parcel, drafts: Draft[]): Stratum[] {
  return drafts.map((d, i) => {
    const area = ringAreaM2(d.footprint);
    return {
      id: `${parcel.id}-${i}`,
      parcelId: parcel.id,
      ulpin: composeUlpin(parcel.ulpinBase, d.band, d.level, d.unit),
      label: d.label,
      band: d.band,
      level: d.level,
      unit: d.unit.toUpperCase(),
      footprint: d.footprint,
      zMin: Number(d.zMin.toFixed(2)),
      zMax: Number(d.zMax.toFixed(2)),
      use: d.use,
      tenure: d.tenure,
      holder: d.holder,
      carpetArea: Number((area * 0.78).toFixed(1)),
      builtUpArea: Number(area.toFixed(1)),
      registeredOn: d.registeredOn,
      encumbrance: d.encumbrance,
    };
  });
}

function towerDrafts(center: LngLat): Draft[] {
  const at = (dx: number, dz: number) => unproject(center, dx, dz);
  const podium = rectRing(center, 52, 38);
  const drafts: Draft[] = [
    {
      band: "S",
      level: 1,
      unit: "001",
      label: "BWSSB trunk main easement",
      footprint: rectRing(at(0, 16), 56, 6),
      zMin: -9,
      zMax: -6.5,
      use: "utility",
      tenure: "easement",
      holder: "Bangalore Water Supply & Sewerage Board",
      registeredOn: "2019-03-11",
      encumbrance: "Perpetual right of way for maintenance access",
    },
    {
      band: "B",
      level: 2,
      unit: "001",
      label: "Basement parking level 2",
      footprint: podium,
      zMin: -7,
      zMax: -3.9,
      use: "parking",
      tenure: "common",
      holder: "Vertica Heights Owners' Association",
      registeredOn: "2021-07-02",
    },
    {
      band: "B",
      level: 1,
      unit: "001",
      label: "Basement parking level 1",
      footprint: podium,
      zMin: -3.9,
      zMax: -0.8,
      use: "parking",
      tenure: "common",
      holder: "Vertica Heights Owners' Association",
      registeredOn: "2021-07-02",
    },
    {
      band: "G",
      level: 0,
      unit: "001",
      label: "Ground retail arcade",
      footprint: rectRing(center, 46, 32),
      zMin: 0,
      zMax: 4.5,
      use: "commercial",
      tenure: "leasehold",
      holder: "Sampangi Retail Ventures LLP",
      registeredOn: "2022-01-19",
      encumbrance: "Lease 30 years from 2022-01-01",
    },
    {
      band: "G",
      level: 0,
      unit: "0C1",
      label: "Service core & lift shaft",
      footprint: rectRing(center, 4, 9),
      zMin: 0,
      zMax: 43.7,
      use: "common",
      tenure: "common",
      holder: "Vertica Heights Owners' Association",
      registeredOn: "2021-07-02",
    },
  ];

  const holders = [
    "R. Lakshmi Narayan",
    "Aisha Fernandes",
    "Deepak & Meera Rao",
    "S. Anantharaman",
    "Nivedita Shetty",
    "Farhan Qureshi",
    "K. Subramani",
    "Priya Venkatesh",
    "Jose Mathew",
    "Tanvi Bhaskar",
    "Arun Pillai",
    "Zoya Rahman",
    "Harish Gowda",
    "Elena D'Souza",
    "M. Ramesh Babu",
    "Kavya Iyer",
    "Vikram Sood",
    "Shabana Ali",
    "Girish Kamath",
    "Ananya Reddy",
    "Imran Shaikh",
    "Lalitha Prasad",
    "Devendra Joshi",
    "Rhea Chandran",
  ];

  for (let floor = 1; floor <= 12; floor++) {
    const zMin = 4.5 + (floor - 1) * 3.2;
    const sides: [number, string][] = [
      [-10.5, "001"],
      [10.5, "002"],
    ];
    sides.forEach(([dx, unit], idx) => {
      const holder = holders[((floor - 1) * 2 + idx) % holders.length];
      drafts.push({
        band: "F",
        level: floor,
        unit,
        label: `Apartment ${floor}${unit === "001" ? "A" : "B"}`,
        footprint: rectRing(at(dx, 0), 16, 26),
        zMin,
        zMax: zMin + 3.2,
        use: "residential",
        tenure: "freehold",
        holder,
        registeredOn: `2022-${String(((floor + idx) % 12) + 1).padStart(2, "0")}-14`,
        encumbrance: floor === 7 && unit === "002" ? "Mortgage — Canara Bank, 2023" : undefined,
      });
    });
  }

  drafts.push({
    band: "A",
    level: 1,
    unit: "001",
    label: "Transferable development rights — air column",
    footprint: rectRing(center, 34, 26),
    zMin: 43.7,
    zMax: 58,
    use: "airspace",
    tenure: "air-rights",
    holder: "Bengaluru Metropolitan TDR Pool",
    registeredOn: "2023-09-05",
    encumbrance: "TDR certificate DRC/2023/1184",
  });

  return drafts;
}

function corridorDrafts(center: LngLat): Draft[] {
  return [
    {
      band: "S",
      level: 2,
      unit: "001",
      label: "Common utility duct (power & fibre)",
      footprint: rectRing(center, 146, 8),
      zMin: -6,
      zMax: -2,
      use: "utility",
      tenure: "easement",
      holder: "BESCOM · shared duct consortium",
      registeredOn: "2018-11-23",
      encumbrance: "Shared access — BESCOM, BSNL, ACT Fibernet",
    },
    {
      band: "G",
      level: 0,
      unit: "001",
      label: "Surface carriageway",
      footprint: rectRing(center, 146, 22),
      zMin: 0,
      zMax: 0.4,
      use: "transport",
      tenure: "government",
      holder: "Bruhat Bengaluru Mahanagara Palike",
      registeredOn: "2005-04-01",
    },
    {
      band: "E",
      level: 1,
      unit: "001",
      label: "Metro viaduct — Purple Line",
      footprint: rectRing(center, 146, 11),
      zMin: 9.5,
      zMax: 17.5,
      use: "transport",
      tenure: "government",
      holder: "Bangalore Metro Rail Corporation Ltd",
      registeredOn: "2016-06-17",
      encumbrance: "Statutory reservation under BMRCL Act",
    },
    {
      band: "A",
      level: 1,
      unit: "001",
      label: "Telecom mast air column",
      footprint: rectRing(center, 146, 11),
      zMin: 17.5,
      zMax: 31,
      use: "airspace",
      tenure: "air-rights",
      holder: "Indus Towers Ltd",
      registeredOn: "2021-02-08",
      encumbrance: "Lease 15 years from 2021-04-01",
    },
  ];
}

function parkDrafts(center: LngLat): Draft[] {
  const drafts: Draft[] = [
    {
      band: "B",
      level: 1,
      unit: "001",
      label: "Podium parking",
      footprint: rectRing(center, 62, 48),
      zMin: -3.6,
      zMax: -0.6,
      use: "parking",
      tenure: "leasehold",
      holder: "Cubbon Tech Park Pvt Ltd",
      registeredOn: "2020-08-30",
    },
    {
      band: "G",
      level: 0,
      unit: "001",
      label: "Ground concourse & food court",
      footprint: rectRing(center, 62, 48),
      zMin: 0,
      zMax: 5,
      use: "commercial",
      tenure: "leasehold",
      holder: "Cubbon Tech Park Pvt Ltd",
      registeredOn: "2020-08-30",
    },
  ];

  const tenants = [
    "Northwind Analytics",
    "Kadamba Semiconductors",
    "Vayu Aerospace Design",
    "Lumen Health Systems",
    "Tessellate Robotics",
    "Sarvam Payments",
  ];

  for (let floor = 1; floor <= 6; floor++) {
    const zMin = 5 + (floor - 1) * 3.9;
    drafts.push({
      band: "F",
      level: floor,
      unit: "001",
      label: `Office floor ${floor}`,
      footprint: rectRing(center, 54, 40),
      zMin,
      zMax: zMin + 3.9,
      use: "commercial",
      tenure: "leasehold",
      holder: tenants[floor - 1],
      registeredOn: `2021-0${floor}-12`,
      encumbrance: floor === 3 ? "Sub-lease registered 2024" : undefined,
    });
  }

  drafts.push({
    band: "A",
    level: 1,
    unit: "001",
    label: "Rooftop solar array rights",
    footprint: rectRing(center, 54, 40),
    zMin: 28.4,
    zMax: 32.4,
    use: "airspace",
    tenure: "air-rights",
    holder: "Suryodaya Renewables Pvt Ltd",
    registeredOn: "2024-05-21",
    encumbrance: "PPA with BESCOM, 25 years",
  });

  drafts.push({
    band: "F",
    level: 2,
    unit: "009",
    label: "Disputed mezzanine claim",
    footprint: rectRing(unproject(center, 8, -6), 22, 18),
    zMin: 9.4,
    zMax: 12.6,
    use: "commercial",
    tenure: "freehold",
    holder: "Estate of B. Chandrappa (claimant)",
    registeredOn: "2024-11-02",
    encumbrance: "Subject to O.S. 442/2024, City Civil Court",
  });

  return drafts;
}

export function buildSeed(): { parcels: Parcel[]; strata: Stratum[] } {
  const towerCenter = ORIGIN;
  const corridorCenter = unproject(ORIGIN, 10, -95);
  const parkCenter = unproject(ORIGIN, 130, 18);

  const tower = makeParcel(
    "parcel-tower",
    towerCenter,
    60,
    45,
    "Sy. No. 114/2",
    "Residential (high rise)",
    "Vertica Heights Owners' Association",
    "2021-07-02",
    920,
  );
  const corridor = makeParcel(
    "parcel-corridor",
    corridorCenter,
    150,
    26,
    "Sy. No. 87 (Road)",
    "Public transport corridor",
    "Bruhat Bengaluru Mahanagara Palike",
    "2005-04-01",
    919,
  );
  const park = makeParcel(
    "parcel-park",
    parkCenter,
    70,
    55,
    "Sy. No. 121/4",
    "Commercial (IT park)",
    "Cubbon Tech Park Pvt Ltd",
    "2020-08-30",
    921,
  );

  return {
    parcels: [tower, corridor, park],
    strata: [
      ...materialise(tower, towerDrafts(towerCenter)),
      ...materialise(corridor, corridorDrafts(corridorCenter)),
      ...materialise(park, parkDrafts(parkCenter)),
    ],
  };
}
