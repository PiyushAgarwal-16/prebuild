import { USER_AGENT } from "../config.js";
import type { LngLat } from "../../types.js";

/** LGD / census state codes. The first two characters of every ULPIN root. */
const STATE_CODE: Record<string, string> = {
  "jammu and kashmir": "01",
  "himachal pradesh": "02",
  punjab: "03",
  chandigarh: "04",
  uttarakhand: "05",
  haryana: "06",
  delhi: "07",
  rajasthan: "08",
  "uttar pradesh": "09",
  bihar: "10",
  sikkim: "11",
  "arunachal pradesh": "12",
  nagaland: "13",
  manipur: "14",
  mizoram: "15",
  tripura: "16",
  meghalaya: "17",
  assam: "18",
  "west bengal": "19",
  jharkhand: "20",
  odisha: "21",
  chhattisgarh: "22",
  "madhya pradesh": "23",
  gujarat: "24",
  "dadra and nagar haveli and daman and diu": "26",
  maharashtra: "27",
  "andhra pradesh": "28",
  karnataka: "29",
  goa: "30",
  lakshadweep: "31",
  kerala: "32",
  "tamil nadu": "33",
  puducherry: "34",
  "andaman and nicobar islands": "35",
  telangana: "36",
  ladakh: "37",
};

export interface Jurisdiction {
  stateCode: string;
  stateName: string;
  districtName: string;
  villageName: string;
  resolved: boolean;
}

export const UNRESOLVED: Jurisdiction = {
  stateCode: "00",
  stateName: "Unresolved",
  districtName: "Unresolved",
  villageName: "Unresolved",
  resolved: false,
};

const cache = new Map<string, Jurisdiction>();

interface NominatimAddress {
  state?: string;
  state_district?: string;
  county?: string;
  suburb?: string;
  neighbourhood?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  country_code?: string;
}

export async function resolveJurisdiction(centre: LngLat): Promise<Jurisdiction> {
  const key = `${centre[0].toFixed(2)},${centre[1].toFixed(2)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?lat=${centre[1]}&lon=${centre[0]}` +
      `&format=json&zoom=12&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return UNRESOLVED;

    const payload = (await res.json()) as { address?: NominatimAddress };
    const a = payload.address ?? {};
    if (a.country_code && a.country_code !== "in") return UNRESOLVED;

    const stateName = a.state?.trim();
    if (!stateName) return UNRESOLVED;

    const jurisdiction: Jurisdiction = {
      stateCode: STATE_CODE[stateName.toLowerCase()] ?? "00",
      stateName,
      districtName: a.state_district ?? a.county ?? "Unresolved",
      villageName:
        a.suburb ?? a.neighbourhood ?? a.village ?? a.town ?? a.city_district ?? a.city ?? "Unresolved",
      resolved: true,
    };
    cache.set(key, jurisdiction);
    return jurisdiction;
  } catch {
    return UNRESOLVED;
  }
}
