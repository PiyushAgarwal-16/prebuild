export type LngLat = [number, number];

export type FixQuality = "fixed" | "float" | "dgps" | "single" | "none";

export interface StationFrame {
  id: string;
  name: string;
  position: LngLat;
  ellipsoidalHeight: number;
  fix: FixQuality;
  satellites: number;
  hdop: number;
  correctionAgeSec: number;
  online: boolean;
}

export interface RoverFrame {
  id: string;
  label: string;
  position: LngLat;
  ellipsoidalHeight: number;
  fix: FixQuality;
  satellites: number;
  hdop: number;
  horizontalRmsM: number;
  verticalRmsM: number;
  speedMs: number;
  headingDeg: number;
  baselineKm: number;
  trackIndex: number;
}

export interface ImageryFrame {
  layerId: string;
  label: string;
  capturedAt: string;
  gsdCm: number;
  cloudCover: number;
}

export interface HelloFrame {
  serverTime: string;
  tickMs: number;
  synthetic: boolean;
  origin: LngLat;
  sources: { id: string; label: string; rateHz: number; synthetic: boolean }[];
}

export interface TickFrame {
  t: string;
  sequence: number;
  clients: number;
}

export type LiveFrame =
  | { event: "hello"; data: HelloFrame }
  | { event: "gnss"; data: { t: string; stations: StationFrame[] } }
  | { event: "rover"; data: { t: string; rover: RoverFrame } }
  | { event: "imagery"; data: { t: string; imagery: ImageryFrame[] } }
  | { event: "tick"; data: TickFrame };
