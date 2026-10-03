import { fromUrl, type GeoTIFF, type GeoTIFFImage } from "geotiff";
import { COPERNICUS_BUCKET, COPERNICUS_DATASET } from "../config.js";
import type { LngLat } from "../../types.js";
import type { TerrainSample } from "../types.js";

interface Tile {
  image: GeoTIFFImage;
  west: number;
  north: number;
  resX: number;
  resY: number;
  width: number;
  height: number;
}

const TILE_ATTEMPTS = 3;

const tiles = new Map<string, Promise<Tile | null>>();

function tileKey(lng: number, lat: number): string {
  const south = Math.floor(lat);
  const west = Math.floor(lng);
  const ns = `${south >= 0 ? "N" : "S"}${String(Math.abs(south)).padStart(2, "0")}_00`;
  const ew = `${west >= 0 ? "E" : "W"}${String(Math.abs(west)).padStart(3, "0")}_00`;
  return `Copernicus_DSM_COG_10_${ns}_${ew}_DEM`;
}

function openTile(key: string): Promise<Tile | null> {
  const cached = tiles.get(key);
  if (cached) return cached;
  const pending = (async () => {
    for (let attempt = 0; attempt < TILE_ATTEMPTS; attempt++) {
      try {
        const tiff: GeoTIFF = await fromUrl(`${COPERNICUS_BUCKET}/${key}/${key}.tif`);
        const image = await tiff.getImage();
        const [west, north] = image.getOrigin();
        const [resX, resY] = image.getResolution();
        return { image, west, north, resX, resY, width: image.getWidth(), height: image.getHeight() };
      } catch {
        continue;
      }
    }
    tiles.delete(key);
    return null;
  })();
  tiles.set(key, pending);
  return pending;
}

async function sampleTile(tile: Tile, lng: number, lat: number): Promise<number | null> {
  const fx = (lng - tile.west) / tile.resX - 0.5;
  const fy = (lat - tile.north) / tile.resY - 0.5;
  const x0 = Math.min(Math.max(Math.floor(fx), 0), tile.width - 2);
  const y0 = Math.min(Math.max(Math.floor(fy), 0), tile.height - 2);
  const window: [number, number, number, number] = [x0, y0, x0 + 2, y0 + 2];
  const raster = (await tile.image.readRasters({ window, samples: [0] })) as unknown as [
    ArrayLike<number>,
  ];
  const v = Array.from(raster[0]);
  if (v.length !== 4 || v.some((n) => !Number.isFinite(n) || n < -500)) return null;
  const tx = Math.min(Math.max(fx - x0, 0), 1);
  const ty = Math.min(Math.max(fy - y0, 0), 1);
  const top = v[0] * (1 - tx) + v[1] * tx;
  const bottom = v[2] * (1 - tx) + v[3] * tx;
  return top * (1 - ty) + bottom * ty;
}

export async function sampleTerrain(points: LngLat[]): Promise<TerrainSample[]> {
  return Promise.all(
    points.map(async (position) => {
      const [lng, lat] = position;
      try {
        const tile = await openTile(tileKey(lng, lat));
        const elevation = tile ? await sampleTile(tile, lng, lat) : null;
        return {
          position,
          elevationM: elevation === null ? null : Number(elevation.toFixed(2)),
          dataset: COPERNICUS_DATASET,
        };
      } catch {
        return { position, elevationM: null, dataset: COPERNICUS_DATASET };
      }
    }),
  );
}
