import { ORIGIN, STATIONS, SURVEY_ROUTE, TICK_MS } from "../config.js";
import { bearingDeg, lerpLngLat, metresBetween, offsetMetres } from "../geo.js";
import type { FixQuality, LngLat, RoverFrame, StationFrame } from "../types.js";

const ROVER_SPEED_MS = 1.35;

interface StationState {
  id: string;
  name: string;
  base: LngLat;
  height: number;
  drift: [number, number];
  satellites: number;
  hdop: number;
  online: boolean;
  correctionAgeSec: number;
}

const stations: StationState[] = STATIONS.map((s) => ({
  id: s.id,
  name: s.name,
  base: [ORIGIN[0] + s.offset[0], ORIGIN[1] + s.offset[1]],
  height: s.height,
  drift: [0, 0],
  satellites: 11 + Math.floor(Math.random() * 6),
  hdop: 0.7 + Math.random() * 0.4,
  online: true,
  correctionAgeSec: 0.6,
}));

let legIndex = 0;
let legProgress = 0;
let roverSatellites = 14;
let roverHdop = 0.68;
let roverFix: FixQuality = "fixed";
let laps = 0;

function wander(current: number, scale: number, min: number, max: number): number {
  const next = current + (Math.random() - 0.5) * scale;
  return Math.min(max, Math.max(min, next));
}

function stationFix(state: StationState): FixQuality {
  if (!state.online) return "none";
  if (state.hdop > 1.5) return "float";
  return "fixed";
}

export function stepStations(): StationFrame[] {
  return stations.map((state) => {
    if (Math.random() < 0.0015) state.online = !state.online;
    state.satellites = Math.round(wander(state.satellites, 1.2, 6, 18));
    state.hdop = wander(state.hdop, 0.08, 0.5, 2.2);
    state.drift = [wander(state.drift[0], 0.004, -0.014, 0.014), wander(state.drift[1], 0.004, -0.014, 0.014)];
    state.correctionAgeSec = state.online ? wander(state.correctionAgeSec, 0.25, 0.4, 3.2) : 999;
    return {
      id: state.id,
      name: state.name,
      position: offsetMetres(state.base, state.drift[0], state.drift[1]),
      ellipsoidalHeight: Number((state.height + state.drift[1] * 0.4).toFixed(3)),
      fix: stationFix(state),
      satellites: state.satellites,
      hdop: Number(state.hdop.toFixed(2)),
      correctionAgeSec: Number(state.correctionAgeSec.toFixed(1)),
      online: state.online,
    };
  });
}

export function stepRover(): RoverFrame {
  const from = SURVEY_ROUTE[legIndex];
  const to = SURVEY_ROUTE[(legIndex + 1) % SURVEY_ROUTE.length];
  const legLength = metresBetween(from, to);
  legProgress += (ROVER_SPEED_MS * TICK_MS) / 1000;
  if (legProgress >= legLength) {
    legProgress -= legLength;
    legIndex = (legIndex + 1) % SURVEY_ROUTE.length;
    if (legIndex === 0) laps += 1;
  }
  const leg = SURVEY_ROUTE[legIndex];
  const legTo = SURVEY_ROUTE[(legIndex + 1) % SURVEY_ROUTE.length];
  const span = Math.max(metresBetween(leg, legTo), 0.001);
  const exact = lerpLngLat(leg, legTo, Math.min(1, legProgress / span));

  roverSatellites = Math.round(wander(roverSatellites, 1.4, 7, 20));
  roverHdop = wander(roverHdop, 0.07, 0.5, 2.6);
  if (roverHdop > 1.8) roverFix = "float";
  else if (roverHdop > 1.2) roverFix = roverFix === "fixed" ? "fixed" : "float";
  else roverFix = "fixed";

  const rms = roverFix === "fixed" ? 0.008 + roverHdop * 0.006 : 0.14 + roverHdop * 0.05;
  const jitter = roverFix === "fixed" ? 0.012 : 0.2;

  return {
    id: "ROVER-01",
    label: "Survey rover — boundary traverse",
    position: offsetMetres(exact, (Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter),
    ellipsoidalHeight: Number((920.6 + (Math.random() - 0.5) * 0.08).toFixed(3)),
    fix: roverFix,
    satellites: roverSatellites,
    hdop: Number(roverHdop.toFixed(2)),
    horizontalRmsM: Number(rms.toFixed(3)),
    verticalRmsM: Number((rms * 1.7).toFixed(3)),
    speedMs: Number((ROVER_SPEED_MS + (Math.random() - 0.5) * 0.2).toFixed(2)),
    headingDeg: Number(bearingDeg(leg, legTo).toFixed(1)),
    baselineKm: Number((metresBetween(exact, stations[0].base) / 1000).toFixed(3)),
    trackIndex: laps * SURVEY_ROUTE.length + legIndex,
  };
}

