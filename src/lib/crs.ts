import proj4 from "proj4";
import type { LngLat } from "../types";

export interface ProjectedCRS {
  epsg: number;
  name: string;
  definition: string;
  toProjected: (p: LngLat) => [number, number];
  toGeographic: (p: [number, number]) => LngLat;
}

function utmZoneFor(lng: number): number {
  return Math.floor((((lng + 180) % 360) + 360) % 360 / 6) + 1;
}

export function projectedCrsFor(centroid: LngLat): ProjectedCRS {
  const zone = utmZoneFor(centroid[0]);
  const north = centroid[1] >= 0;
  const epsg = (north ? 32600 : 32700) + zone;
  const definition = `+proj=utm +zone=${zone} ${north ? "" : "+south "}+datum=WGS84 +units=m +no_defs`;
  const forward = proj4("EPSG:4326", definition);

  return {
    epsg,
    name: `WGS 84 / UTM zone ${zone}${north ? "N" : "S"}`,
    definition,
    toProjected: (p) => {
      const [x, y] = forward.forward([p[0], p[1]]);
      return [x, y];
    },
    toGeographic: (p) => {
      const [lng, lat] = forward.inverse([p[0], p[1]]);
      return [lng, lat];
    },
  };
}
