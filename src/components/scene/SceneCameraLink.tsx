import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { cameraChanged, mapToOrbit, orbitToMap, type MapCamera } from "../../lib/camera";
import { useViewport } from "../../store/viewport";
import { useSceneOrigin } from "./StrataScene";

export function SceneCameraLink() {
  const origin = useSceneOrigin();
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  const height = useThree((s) => s.size.height);
  const last = useRef<MapCamera | null>(null);

  useEffect(() => {
    useViewport.getState().setSceneHeight(height);
  }, [height]);

  useEffect(() => {
    if (!controls) return;
    let seen = useViewport.getState().revision;
    return useViewport.subscribe((state) => {
      if (state.revision === seen) return;
      seen = state.revision;
      if (state.emitter !== "map" || !state.linked) return;
      const orbit = mapToOrbit(state.camera, origin, controls.target.y, height);
      controls.target.set(...orbit.target);
      camera.position.set(...orbit.position);
      controls.update();
      last.current = state.camera;
    });
  }, [camera, controls, height, origin]);

  useFrame(() => {
    if (!controls) return;
    const next = orbitToMap(
      {
        target: [controls.target.x, controls.target.y, controls.target.z],
        position: [camera.position.x, camera.position.y, camera.position.z],
      },
      origin,
      height,
    );
    if (last.current && !cameraChanged(last.current, next)) return;
    last.current = next;
    if (useViewport.getState().linked) useViewport.getState().setCamera(next, "scene");
  });

  return null;
}
