import type { FixQuality } from "./types";
import type { FeedStatus } from "../store/live";

export const FIX_LABEL: Record<FixQuality, string> = {
  fixed: "RTK fixed",
  float: "RTK float",
  dgps: "DGPS",
  single: "Single",
  none: "No fix",
};

export const FIX_COLOR: Record<FixQuality, string> = {
  fixed: "#2f8f6f",
  float: "#d3a93c",
  dgps: "#3b7ea8",
  single: "#8a6420",
  none: "#cc3b2e",
};

export const STATUS_LABEL: Record<FeedStatus, string> = {
  idle: "Offline",
  connecting: "Connecting",
  live: "Live",
  stale: "Stale",
  down: "Disconnected",
};

export const STATUS_COLOR: Record<FeedStatus, string> = {
  idle: "#9aa2ab",
  connecting: "#d3a93c",
  live: "#2f8f6f",
  stale: "#d3a93c",
  down: "#cc3b2e",
};

export function formatAge(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, { hour12: false });
}

export function formatMillimetres(metres: number): string {
  return `${(metres * 1000).toFixed(0)} mm`;
}
