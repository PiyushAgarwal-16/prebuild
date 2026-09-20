import type { LngLat } from "../types";

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

export interface LiveSource {
  id: string;
  label: string;
  rateHz: number;
  synthetic: boolean;
}

export interface HelloFrame {
  serverTime: string;
  tickMs: number;
  synthetic: boolean;
  origin: LngLat;
  sources: LiveSource[];
}

export interface SnapshotPayload {
  serverTime: string;
  synthetic: boolean;
  stations: StationFrame[];
  rover: RoverFrame | null;
  imagery: ImageryFrame[];
}

export interface LiveHandlers {
  onHello: (frame: HelloFrame) => void;
  onGnss: (stations: StationFrame[]) => void;
  onRover: (rover: RoverFrame) => void;
  onImagery: (imagery: ImageryFrame[]) => void;
  onTick: () => void;
  onOpen: () => void;
  onError: () => void;
}
