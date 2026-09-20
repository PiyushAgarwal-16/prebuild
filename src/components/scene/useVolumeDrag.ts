import { useCallback, useRef } from "react";
import * as THREE from "three";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { LngLat, Ring, Stratum } from "../../types";
import { project, unproject } from "../../lib/geo";
import { useRegistry } from "../../store/registry";
import { useViewport } from "../../store/viewport";

export interface VolumeDragHandlers {
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
}

export function useVolumeDrag(stratum: Stratum, origin: LngLat, enabled: boolean): VolumeDragHandlers {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const updateStratum = useRegistry((s) => s.updateStratum);
  const plane = useRef(new THREE.Plane());
  const anchor = useRef<THREE.Vector3 | null>(null);
  const startRing = useRef<Ring>([]);

  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (e.button !== 0 || !enabled) return;
      e.stopPropagation();
      const midpoint = (stratum.zMin + stratum.zMax) / 2;
      plane.current.set(new THREE.Vector3(0, 1, 0), -midpoint);
      const hit = new THREE.Vector3();
      if (!e.ray.intersectPlane(plane.current, hit)) return;
      anchor.current = hit.clone();
      startRing.current = stratum.footprint;
      (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
      if (controls) controls.enabled = false;
      useViewport.getState().beginEdit({
        stratumId: stratum.id,
        footprint: stratum.footprint,
        zMin: stratum.zMin,
        zMax: stratum.zMax,
      });
    },
    [controls, enabled, stratum],
  );

  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!anchor.current) return;
      e.stopPropagation();
      const hit = new THREE.Vector3();
      if (!e.ray.intersectPlane(plane.current, hit)) return;
      const dx = hit.x - anchor.current.x;
      const dz = hit.z - anchor.current.z;
      const moved = startRing.current.map((p) => {
        const [x, z] = project(origin, p);
        return unproject(origin, x + dx, z + dz);
      });
      useViewport.getState().updateEdit({ footprint: moved });
    },
    [origin],
  );

  const onPointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!anchor.current) return;
      e.stopPropagation();
      anchor.current = null;
      (e.target as Element | null)?.releasePointerCapture?.(e.pointerId);
      if (controls) controls.enabled = true;
      const edit = useViewport.getState().liveEdit;
      if (edit && edit.stratumId === stratum.id) {
        updateStratum(stratum.id, { footprint: edit.footprint });
      }
      useViewport.getState().endEdit();
    },
    [controls, stratum.id, updateStratum],
  );

  return { onPointerDown, onPointerMove, onPointerUp };
}
