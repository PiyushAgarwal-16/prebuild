import {
  GNSS_EVERY_TICKS,
  HEARTBEAT_EVERY_TICKS,
  IMAGERY_EVERY_TICKS,
  ORIGIN,
  SYNTHETIC,
  TICK_MS,
} from "./config.js";
import { stepRover, stepStations } from "./feeds/gnss.js";
import { stepImagery } from "./feeds/imagery.js";
import { clientCount, publish } from "./stream.js";
import type { HelloFrame, ImageryFrame, RoverFrame, StationFrame } from "./types.js";

let sequence = 0;
let timer: ReturnType<typeof setInterval> | null = null;

let lastStations: StationFrame[] = [];
let lastRover: RoverFrame | null = null;
let lastImagery: ImageryFrame[] = [];

export function hello(): HelloFrame {
  return {
    serverTime: new Date().toISOString(),
    tickMs: TICK_MS,
    synthetic: SYNTHETIC,
    origin: ORIGIN,
    sources: [
      { id: "gnss", label: "GNSS / CORS network", rateHz: 1000 / (TICK_MS * GNSS_EVERY_TICKS), synthetic: SYNTHETIC },
      { id: "rover", label: "Survey rover telemetry", rateHz: 1000 / TICK_MS, synthetic: SYNTHETIC },
      { id: "imagery", label: "Imagery freshness", rateHz: 1000 / (TICK_MS * IMAGERY_EVERY_TICKS), synthetic: SYNTHETIC },
    ],
  };
}

export function snapshot() {
  return {
    serverTime: new Date().toISOString(),
    synthetic: SYNTHETIC,
    stations: lastStations,
    rover: lastRover,
    imagery: lastImagery,
  };
}

function tick(): void {
  sequence += 1;
  const t = new Date().toISOString();

  lastRover = stepRover();
  publish({ event: "rover", data: { t, rover: lastRover } });

  if (sequence % GNSS_EVERY_TICKS === 0) {
    lastStations = stepStations();
    publish({ event: "gnss", data: { t, stations: lastStations } });
  }
  if (sequence % IMAGERY_EVERY_TICKS === 0) {
    lastImagery = stepImagery();
    publish({ event: "imagery", data: { t, imagery: lastImagery } });
  }
  if (sequence % HEARTBEAT_EVERY_TICKS === 0) {
    publish({ event: "tick", data: { t, sequence, clients: clientCount() } });
  }
}

export function startEngine(): void {
  if (timer) return;
  lastStations = stepStations();
  lastRover = stepRover();
  lastImagery = stepImagery();
  timer = setInterval(tick, TICK_MS);
}

export function stopEngine(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
