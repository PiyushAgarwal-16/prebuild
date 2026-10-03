import { IMAGERY_LAYERS } from "../config.js";
import type { ImageryFrame } from "../types.js";

const captured = new Map<string, number>(IMAGERY_LAYERS.map((l) => [l.id, Date.now()]));
const cloud = new Map<string, number>(IMAGERY_LAYERS.map((l) => [l.id, Math.random() * 0.2]));

export function stepImagery(): ImageryFrame[] {
  return IMAGERY_LAYERS.map((layer) => {
    if (Math.random() < 0.35) captured.set(layer.id, Date.now());
    const next = Math.min(0.9, Math.max(0, (cloud.get(layer.id) ?? 0) + (Math.random() - 0.5) * 0.06));
    cloud.set(layer.id, next);
    return {
      layerId: layer.id,
      label: layer.label,
      capturedAt: new Date(captured.get(layer.id) ?? Date.now()).toISOString(),
      gsdCm: layer.gsdCm,
      cloudCover: Number(next.toFixed(3)),
    };
  });
}
