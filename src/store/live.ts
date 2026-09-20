import { create } from "zustand";
import type { LngLat } from "../types";
import { fetchSnapshot, openLiveStream, type LiveConnection } from "../live/client";
import { DOWN_AFTER_MS, STALE_AFTER_MS, TRACK_LIMIT } from "../live/endpoints";
import type { ImageryFrame, LiveSource, RoverFrame, StationFrame } from "../live/types";

export type FeedStatus = "idle" | "connecting" | "live" | "stale" | "down";

interface LiveStore {
  status: FeedStatus;
  synthetic: boolean;
  tickMs: number;
  sources: LiveSource[];
  stations: StationFrame[];
  rover: RoverFrame | null;
  track: LngLat[];
  imagery: ImageryFrame[];
  lastFrameAt: number | null;
  framesReceived: number;
  now: number;
  followRover: boolean;

  connect: () => void;
  disconnect: () => void;
  clearTrack: () => void;
  setFollowRover: (follow: boolean) => void;
}

let connection: LiveConnection | null = null;
let clock: ReturnType<typeof setInterval> | null = null;

export const useLive = create<LiveStore>((set, get) => ({
  status: "idle",
  synthetic: true,
  tickMs: 250,
  sources: [],
  stations: [],
  rover: null,
  track: [],
  imagery: [],
  lastFrameAt: null,
  framesReceived: 0,
  now: Date.now(),
  followRover: false,

  connect: () => {
    if (connection) return;
    set({ status: "connecting" });

    void fetchSnapshot().then((snap) => {
      if (!snap || get().framesReceived > 0) return;
      set({
        synthetic: snap.synthetic,
        stations: snap.stations,
        rover: snap.rover,
        imagery: snap.imagery,
      });
    });

    const mark = () => set({ lastFrameAt: Date.now(), framesReceived: get().framesReceived + 1 });

    connection = openLiveStream({
      onOpen: () => set({ status: "live", lastFrameAt: Date.now() }),
      onError: () => set({ status: "down" }),
      onHello: (frame) =>
        set({
          synthetic: frame.synthetic,
          tickMs: frame.tickMs,
          sources: frame.sources,
          status: "live",
          lastFrameAt: Date.now(),
        }),
      onGnss: (stations) => {
        mark();
        set({ stations, status: "live" });
      },
      onRover: (rover: RoverFrame) => {
        mark();
        const track = [...get().track, rover.position];
        set({
          rover,
          track: track.length > TRACK_LIMIT ? track.slice(track.length - TRACK_LIMIT) : track,
          status: "live",
        });
      },
      onImagery: (imagery) => {
        mark();
        set({ imagery, status: "live" });
      },
      onTick: () => {
        mark();
        set({ status: "live" });
      },
    });

    clock = setInterval(() => {
      const { lastFrameAt, status } = get();
      const now = Date.now();
      if (status === "idle") return set({ now });
      if (!lastFrameAt) return set({ now });
      const age = now - lastFrameAt;
      const next: FeedStatus = age > DOWN_AFTER_MS ? "down" : age > STALE_AFTER_MS ? "stale" : "live";
      set({ now, status: status === "connecting" && age < STALE_AFTER_MS ? "connecting" : next });
    }, 500);
  },

  disconnect: () => {
    connection?.close();
    connection = null;
    if (clock) clearInterval(clock);
    clock = null;
    set({ status: "idle", lastFrameAt: null });
  },

  clearTrack: () => set({ track: [] }),

  setFollowRover: (followRover) => set({ followRover }),
}));

export const selectFeedAgeMs = (s: LiveStore): number | null =>
  s.lastFrameAt === null ? null : Math.max(0, s.now - s.lastFrameAt);
