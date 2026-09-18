import { useMemo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import type { LngLat, Stratum } from "../../types";
import { useRegistry } from "../../store/registry";
import { useUI } from "../../store/ui";
import { project, ringCentroid } from "../../lib/geo";
import { CONFLICT_COLOR, TENURE_COLOR, USE_COLOR } from "../../lib/palette";

export const volumeRegistry = new Map<string, THREE.Object3D>();

export function useSceneOrigin(): LngLat {
  const parcels = useRegistry((s) => s.parcels);
  return useMemo(() => {
    if (!parcels.length) return [77.5946, 12.9716];
    let lng = 0;
    let lat = 0;
    let n = 0;
    for (const p of parcels) {
      for (const [x, y] of p.ring) {
        lng += x;
        lat += y;
        n++;
      }
    }
    return [lng / n, lat / n] as LngLat;
  }, [parcels]);
}

function shapeFor(origin: LngLat, footprint: LngLat[]): THREE.Shape {
  const shape = new THREE.Shape();
  footprint.forEach((p, i) => {
    const [x, z] = project(origin, p);
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  return shape;
}

function Volume({
  stratum,
  origin,
  color,
  dimmed,
  selected,
  muted,
  flagged,
  lift,
}: {
  stratum: Stratum;
  origin: LngLat;
  color: string;
  dimmed: boolean;
  selected: boolean;
  muted: boolean;
  flagged: boolean;
  lift: number;
}) {
  const selectStratum = useRegistry((s) => s.selectStratum);
  const height = Math.max(stratum.zMax - stratum.zMin, 0.05);

  const geometry = useMemo(() => {
    const shape = shapeFor(origin, stratum.footprint);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [origin, stratum.footprint, height]);

  const edges = useMemo(() => new THREE.EdgesGeometry(geometry, 25), [geometry]);

  const labelAt = useMemo(() => {
    const [x, z] = project(origin, ringCentroid(stratum.footprint));
    return [x, height + 1.4, z] as [number, number, number];
  }, [origin, stratum.footprint, height]);
  const opacity = selected ? 0.97 : dimmed ? 0.16 : muted ? 0.28 : 0.68;

  return (
    <group
      position={[0, stratum.zMin + lift, 0]}
      ref={(node) => {
        if (node) volumeRegistry.set(stratum.id, node);
        else volumeRegistry.delete(stratum.id);
      }}
    >
      <mesh
        geometry={geometry}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          selectStratum(stratum.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "default";
        }}
      >
        <meshStandardMaterial
          color={color}
          transparent
          opacity={opacity}
          roughness={0.62}
          metalness={0.04}
          depthWrite={opacity > 0.9}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.22 : 0}
        />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial
          color={flagged ? CONFLICT_COLOR : selected ? "#1c1a17" : "#3a3631"}
          transparent
          opacity={flagged ? 0.95 : dimmed ? 0.18 : 0.5}
        />
      </lineSegments>
      {selected && (
        <Html position={labelAt} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-sm border border-line bg-surface/95 px-2 py-1 font-mono text-[10px] tracking-wide text-text shadow-soft">
            {stratum.ulpin}
          </div>
        </Html>
      )}
    </group>
  );
}

function ParcelOutlines({ origin }: { origin: LngLat }) {
  const parcels = useRegistry((s) => s.parcels);
  const selectedParcelId = useRegistry((s) => s.selectedParcelId);
  const selectParcel = useRegistry((s) => s.selectParcel);

  return (
    <>
      {parcels.map((p) => {
        const pts = p.ring.map((c) => {
          const [x, z] = project(origin, c);
          return new THREE.Vector3(x, 0.05, z);
        });
        const geo = new THREE.BufferGeometry().setFromPoints([...pts, pts[0]]);
        const active = p.id === selectedParcelId;
        const shape = shapeFor(origin, p.ring);
        return (
          <group key={p.id}>
            <lineLoop geometry={geo}>
              <lineBasicMaterial color={active ? "#1c1a17" : "#6d6660"} linewidth={2} transparent opacity={active ? 0.9 : 0.4} />
            </lineLoop>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.02, 0]}
              receiveShadow
              onClick={(e) => {
                e.stopPropagation();
                selectParcel(p.id);
              }}
            >
              <shapeGeometry args={[shape]} />
              <meshStandardMaterial
                color={active ? "#cfc7b8" : "#bdb6ab"}
                roughness={1}
                transparent
                opacity={active ? 0.95 : 0.6}
              />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

export function StrataScene() {
  const origin = useSceneOrigin();
  const strata = useRegistry((s) => s.strata);
  const conflicts = useRegistry((s) => s.conflicts);
  const selectedParcelId = useRegistry((s) => s.selectedParcelId);
  const selectedStratumId = useRegistry((s) => s.selectedStratumId);
  const colorBy = useUI((s) => s.colorBy);
  const bands = useUI((s) => s.bands);
  const explode = useUI((s) => s.explode);

  const flagged = useMemo(() => {
    const set = new Set<string>();
    for (const c of conflicts) if (c.severity === "critical") c.subjects.forEach((id) => set.add(id));
    return set;
  }, [conflicts]);

  const visible = useMemo(() => strata.filter((s) => bands[s.band]), [strata, bands]);

  const lifts = useMemo(() => {
    const map = new Map<string, number>();
    const byParcel = new Map<string, Stratum[]>();
    for (const s of visible) {
      const list = byParcel.get(s.parcelId) ?? [];
      list.push(s);
      byParcel.set(s.parcelId, list);
    }
    for (const list of byParcel.values()) {
      const sorted = [...list].sort((a, b) => a.zMin - b.zMin);
      sorted.forEach((s, i) => map.set(s.id, explode * i * 1.4));
    }
    return map;
  }, [visible, explode]);

  return (
    <>
      <ParcelOutlines origin={origin} />
      {visible.map((s) => (
        <Volume
          key={s.id}
          stratum={s}
          origin={origin}
          color={colorBy === "use" ? USE_COLOR[s.use] : TENURE_COLOR[s.tenure]}
          dimmed={selectedParcelId !== null && s.parcelId !== selectedParcelId}
          selected={s.id === selectedStratumId}
          muted={selectedStratumId !== null && s.id !== selectedStratumId}
          flagged={flagged.has(s.id)}
          lift={lifts.get(s.id) ?? 0}
        />
      ))}
    </>
  );
}
