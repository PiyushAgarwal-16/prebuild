import { useCallback, useRef, useState } from "react";
import type { FloorPlan, PlanUnit } from "../../lib/plan";
import { clampToFootprint, snap, type PlanReport } from "../../lib/planValidation";
import { USE_COLOR } from "../../lib/palette";

const KIND_COLOR: Record<string, string> = {
  apartment: USE_COLOR.residential,
  commercial: USE_COLOR.commercial,
  common: USE_COLOR.common,
  circulation: USE_COLOR.common,
  service: USE_COLOR.utility,
  parking: USE_COLOR.parking,
};

type Handle = "nw" | "ne" | "sw" | "se";
type Drag =
  | { mode: "move"; index: number; grabX: number; grabZ: number; start: PlanUnit }
  | { mode: "resize"; index: number; handle: Handle; start: PlanUnit };

const PAD = 1.5;

export function PlanEditor({
  plan,
  report,
  image,
  showImage,
  underlay,
  selected,
  onSelect,
  onChange,
}: {
  plan: FloorPlan;
  report: PlanReport;
  image: string | null;
  showImage: boolean;
  underlay: { x: number; z: number; scale: number };
  selected: number | null;
  onSelect: (index: number | null) => void;
  onChange: (units: PlanUnit[]) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const viewW = plan.buildingW + PAD * 2;
  const viewD = plan.buildingD + PAD * 2;

  const toPlan = useCallback(
    (clientX: number, clientY: number) => {
      const node = svg.current;
      if (!node) return { x: 0, z: 0 };
      const rect = node.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * viewW - viewW / 2,
        z: ((clientY - rect.top) / rect.height) * viewD - viewD / 2,
      };
    },
    [viewW, viewD],
  );

  const onPointerDownUnit = (e: React.PointerEvent, index: number) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toPlan(e.clientX, e.clientY);
    const unit = plan.units[index];
    onSelect(index);
    setDrag({ mode: "move", index, grabX: p.x - unit.x, grabZ: p.z - unit.z, start: unit });
  };

  const onPointerDownHandle = (e: React.PointerEvent, index: number, handle: Handle) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    onSelect(index);
    setDrag({ mode: "resize", index, handle, start: plan.units[index] });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toPlan(e.clientX, e.clientY);
    const units = [...plan.units];

    if (drag.mode === "move") {
      units[drag.index] = clampToFootprint(
        { ...drag.start, x: snap(p.x - drag.grabX), z: snap(p.z - drag.grabZ) },
        plan,
      );
    } else {
      const s = drag.start;
      const left = s.x - s.w / 2;
      const right = s.x + s.w / 2;
      const top = s.z - s.d / 2;
      const bottom = s.z + s.d / 2;
      const nx = snap(p.x);
      const nz = snap(p.z);
      const x0 = drag.handle === "nw" || drag.handle === "sw" ? Math.min(nx, right - 0.2) : left;
      const x1 = drag.handle === "ne" || drag.handle === "se" ? Math.max(nx, left + 0.2) : right;
      const z0 = drag.handle === "nw" || drag.handle === "ne" ? Math.min(nz, bottom - 0.2) : top;
      const z1 = drag.handle === "sw" || drag.handle === "se" ? Math.max(nz, top + 0.2) : bottom;
      units[drag.index] = clampToFootprint(
        { ...s, x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 },
        plan,
      );
    }
    onChange(units);
  };

  const endDrag = () => setDrag(null);

  return (
    <svg
      ref={svg}
      viewBox={`${-viewW / 2} ${-viewD / 2} ${viewW} ${viewD}`}
      className="h-[440px] w-full touch-none rounded-sm border border-line bg-base"
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onPointerDown={() => onSelect(null)}
    >
      {image && showImage && (
        <image
          href={image}
          x={-(plan.buildingW * underlay.scale) / 2 + underlay.x}
          y={-(plan.buildingD * underlay.scale) / 2 + underlay.z}
          width={plan.buildingW * underlay.scale}
          height={plan.buildingD * underlay.scale}
          preserveAspectRatio="xMidYMid meet"
          opacity={0.5}
        />
      )}

      <rect
        x={-plan.buildingW / 2}
        y={-plan.buildingD / 2}
        width={plan.buildingW}
        height={plan.buildingD}
        fill="none"
        stroke="var(--color-line-strong)"
        strokeWidth={0.18}
      />

      {plan.units.map((u, i) => {
        const bad = report.invalid.has(i);
        const active = selected === i;
        const colour = KIND_COLOR[u.kind] ?? "#8a8a8a";
        return (
          <g key={i}>
            <rect
              x={u.x - u.w / 2}
              y={u.z - u.d / 2}
              width={u.w}
              height={u.d}
              fill={bad ? "#cc3b2e" : colour}
              fillOpacity={bad ? 0.26 : active ? 0.44 : 0.28}
              stroke={bad ? "#cc3b2e" : active ? "#252527" : colour}
              strokeWidth={active ? 0.18 : 0.1}
              style={{ cursor: "move" }}
              onPointerDown={(e) => onPointerDownUnit(e, i)}
            />
            <text
              x={u.x}
              y={u.z}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={Math.max(0.5, Math.min(0.95, (u.w / Math.max(u.label.length, 5)) * 1.7))}
              fill="var(--color-text)"
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {u.label}
            </text>
            {active &&
              (["nw", "ne", "sw", "se"] as Handle[]).map((h) => {
                const hx = u.x + (h === "nw" || h === "sw" ? -u.w / 2 : u.w / 2);
                const hz = u.z + (h === "nw" || h === "ne" ? -u.d / 2 : u.d / 2);
                return (
                  <rect
                    key={h}
                    x={hx - 0.34}
                    y={hz - 0.34}
                    width={0.68}
                    height={0.68}
                    fill="#ffffff"
                    stroke="#252527"
                    strokeWidth={0.1}
                    style={{ cursor: h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize" }}
                    onPointerDown={(e) => onPointerDownHandle(e, i, h)}
                  />
                );
              })}
          </g>
        );
      })}
    </svg>
  );
}
