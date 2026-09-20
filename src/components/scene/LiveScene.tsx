import { useMemo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import type { LngLat } from "../../types";
import { project } from "../../lib/geo";
import { FIX_COLOR, FIX_LABEL } from "../../live/format";
import { useLive } from "../../store/live";
import { useSceneOrigin } from "./StrataScene";

const TRACK_Y = 0.35;

function TrackLine({ origin, track }: { origin: LngLat; track: LngLat[] }) {
  const geometry = useMemo(() => {
    const points = track.map((p) => {
      const [x, z] = project(origin, p);
      return new THREE.Vector3(x, TRACK_Y, z);
    });
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [origin, track]);

  if (track.length < 2) return null;

  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color="#3b7ea8" transparent opacity={0.8} />
    </line>
  );
}

export function LiveScene() {
  const origin = useSceneOrigin();
  const rover = useLive((s) => s.rover);
  const track = useLive((s) => s.track);

  const position = useMemo(() => {
    if (!rover) return null;
    const [x, z] = project(origin, rover.position);
    return [x, 0, z] as [number, number, number];
  }, [origin, rover]);

  return (
    <>
      <TrackLine origin={origin} track={track} />
      {rover && position && (
        <group position={position}>
          <mesh position={[0, 1.6, 0]} castShadow>
            <coneGeometry args={[0.85, 1.8, 16]} />
            <meshStandardMaterial
              color={FIX_COLOR[rover.fix]}
              emissive={FIX_COLOR[rover.fix]}
              emissiveIntensity={0.35}
              roughness={0.4}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
            <ringGeometry args={[1.6, 2.2, 32]} />
            <meshBasicMaterial color={FIX_COLOR[rover.fix]} transparent opacity={0.45} />
          </mesh>
          <Html position={[0, 3.6, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
            <div className="whitespace-nowrap rounded-sm border border-line bg-surface/95 px-2 py-1 font-mono text-[10px] tracking-wide text-text shadow-soft">
              {rover.id} · {FIX_LABEL[rover.fix]} · ±{(rover.horizontalRmsM * 1000).toFixed(0)} mm
            </div>
          </Html>
        </group>
      )}
    </>
  );
}
