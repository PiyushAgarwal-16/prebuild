import type { LngLat, Parcel, Ring, Stratum } from "../types";
import { projectedCrsFor, type ProjectedCRS } from "./crs";

const SCALE: [number, number, number] = [0.001, 0.001, 0.001];

interface Geometry {
  type: "Solid" | "MultiSurface";
  lod: string;
  boundaries: unknown;
}

interface CityObject {
  type: string;
  attributes?: Record<string, unknown>;
  children?: string[];
  parents?: string[];
  geometry?: Geometry[];
}

export interface CityJSON {
  type: "CityJSON";
  version: "2.0";
  metadata: Record<string, unknown>;
  transform: { scale: [number, number, number]; translate: [number, number, number] };
  CityObjects: Record<string, CityObject>;
  vertices: [number, number, number][];
}

function signedArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    sum += x0 * y1 - x1 * y0;
  }
  return sum / 2;
}

function counterClockwise(ring: Ring): Ring {
  return signedArea(ring) < 0 ? [...ring].reverse() : ring;
}

class VertexPool {
  private readonly index = new Map<string, number>();
  readonly list: [number, number, number][] = [];

  add(x: number, y: number, z: number): number {
    const key = `${x.toFixed(4)}|${y.toFixed(4)}|${z.toFixed(4)}`;
    const hit = this.index.get(key);
    if (hit !== undefined) return hit;
    const id = this.list.length;
    this.list.push([x, y, z]);
    this.index.set(key, id);
    return id;
  }
}

function solidFromPrism(
  pool: VertexPool,
  crs: ProjectedCRS,
  ring: Ring,
  zBottom: number,
  zTop: number,
): number[][][][] {
  const base = counterClockwise(ring).map((p) => crs.toProjected(p));
  const bottom = base.map((p) => pool.add(p[0], p[1], zBottom));
  const top = base.map((p) => pool.add(p[0], p[1], zTop));

  const surfaces: number[][][] = [];
  surfaces.push([[...bottom].reverse()]);
  surfaces.push([[...top]]);
  for (let i = 0; i < base.length; i++) {
    const j = (i + 1) % base.length;
    surfaces.push([[bottom[i], bottom[j], top[j], top[i]]]);
  }
  return [surfaces];
}

function meanCentroid(parcels: Parcel[]): LngLat {
  const points = parcels.flatMap((p) => p.ring);
  if (!points.length) return [77.5946, 12.9716];
  return [
    points.reduce((s, p) => s + p[0], 0) / points.length,
    points.reduce((s, p) => s + p[1], 0) / points.length,
  ];
}

export function toCityJSON(parcels: Parcel[], strata: Stratum[]): CityJSON {
  const pool = new VertexPool();
  const objects: Record<string, CityObject> = {};
  const crs = projectedCrsFor(meanCentroid(parcels));

  for (const parcel of parcels) {
    const ground = parcel.groundElevation;
    const landUseId = `parcel-${parcel.ulpinBase}`;
    const buildingId = `building-${parcel.ulpinBase}`;
    const ring = counterClockwise(parcel.ring);

    objects[landUseId] = {
      type: "LandUse",
      attributes: {
        ulpin: parcel.ulpinBase,
        ulpinSource: parcel.ulpinSource,
        surveyNumber: parcel.surveyNumber,
        landUse: parcel.landUse,
        holder: parcel.holder,
        state: parcel.jurisdiction.stateName,
        district: parcel.jurisdiction.districtName,
        village: parcel.jurisdiction.villageName,
        groundElevation: ground,
        registeredOn: parcel.registeredOn,
      },
      geometry: [
        {
          type: "MultiSurface",
          lod: "1",
          boundaries: [[ring.map((p) => crs.toProjected(p)).map((p) => pool.add(p[0], p[1], ground))]],
        },
      ],
    };

    const own = strata.filter((s) => s.parcelId === parcel.id);
    const childIds: string[] = [];

    for (const stratum of own) {
      const id = `unit-${stratum.ulpin}`;
      childIds.push(id);
      objects[id] = {
        type: "BuildingUnit",
        parents: [buildingId],
        attributes: {
          ulpin: stratum.ulpin,
          label: stratum.label,
          band: stratum.band,
          level: stratum.level,
          unit: stratum.unit,
          function: stratum.use,
          tenure: stratum.tenure,
          holder: stratum.holder,
          carpetArea: stratum.carpetArea,
          builtUpArea: stratum.builtUpArea,
          registeredOn: stratum.registeredOn,
          encumbrance: stratum.encumbrance ?? null,
          verticalExtentLocal: [stratum.zMin, stratum.zMax],
        },
        geometry: [
          {
            type: "Solid",
            lod: "1",
            boundaries: solidFromPrism(pool, crs, stratum.footprint, ground + stratum.zMin, ground + stratum.zMax),
          },
        ],
      };
    }

    objects[buildingId] = {
      type: "Building",
      children: childIds,
      attributes: {
        ulpinBase: parcel.ulpinBase,
        surveyNumber: parcel.surveyNumber,
        registeredVolumes: childIds.length,
      },
    };
  }

  const xs = pool.list.map((v) => v[0]);
  const ys = pool.list.map((v) => v[1]);
  const zs = pool.list.map((v) => v[2]);
  const translate: [number, number, number] = [
    xs.length ? Math.min(...xs) : 0,
    ys.length ? Math.min(...ys) : 0,
    zs.length ? Math.min(...zs) : 0,
  ];

  const vertices = pool.list.map(
    (v) =>
      [
        Math.round((v[0] - translate[0]) / SCALE[0]),
        Math.round((v[1] - translate[1]) / SCALE[1]),
        Math.round((v[2] - translate[2]) / SCALE[2]),
      ] as [number, number, number],
  );

  return {
    type: "CityJSON",
    version: "2.0",
    metadata: {
      referenceSystem: `https://www.opengis.net/def/crs/EPSG/0/${crs.epsg}`,
      title: "ULPIN 3D volumetric cadastre extract",
      crsName: crs.name,
      heightReference: "Parcel ground datum (EGM96 orthometric, ASTER GDEM) plus local extent",
      geographicalExtent: xs.length
        ? [Math.min(...xs), Math.min(...ys), Math.min(...zs), Math.max(...xs), Math.max(...ys), Math.max(...zs)]
        : undefined,
    },
    transform: { scale: SCALE, translate },
    CityObjects: objects,
    vertices,
  };
}
