import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { StrataScene, useSceneOrigin } from "./StrataScene";
import { SceneCameraLink } from "./SceneCameraLink";
import { LiveScene } from "./LiveScene";
import { useRegistry } from "../../store/registry";
import { project, ringCentroid } from "../../lib/geo";
import { MAX_PITCH } from "../../lib/camera";

function CameraRig() {
  const origin = useSceneOrigin();
  const parcels = useRegistry((s) => s.parcels);
  const strata = useRegistry((s) => s.strata);
  const selectedParcelId = useRegistry((s) => s.selectedParcelId);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  const target = useRef(new THREE.Vector3(0, 12, 0));
  const camGoal = useRef(new THREE.Vector3(70, 55, 90));
  const active = useRef(false);

  useEffect(() => {
    const parcel = parcels.find((p) => p.id === selectedParcelId);
    if (!parcel) return;
    const flat = parcel.ring.map((c) => project(origin, c));
    const xs = flat.map((p) => p[0]);
    const zs = flat.map((p) => p[1]);
    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...zs) - Math.min(...zs);
    const own = strata.filter((s) => s.parcelId === parcel.id);
    const top = own.reduce((h, s) => Math.max(h, s.zMax), 12);
    const bottom = own.reduce((h, s) => Math.min(h, s.zMin), 0);
    const [x, z] = project(origin, ringCentroid(parcel.ring));
    const radius = Math.max(width, depth, top - bottom) / 2;
    const distance = radius * 2.9 + 30;
    target.current.set(x, (top + bottom) / 2, z);
    camGoal.current.set(x + distance * 0.58, (top + bottom) / 2 + distance * 0.52, z + distance * 0.72);
    active.current = true;
  }, [origin, parcels, strata, selectedParcelId]);

  useFrame((_, dt) => {
    if (!active.current || !controls) return;
    const k = 1 - Math.exp(-3.2 * Math.min(dt, 0.1));
    controls.target.lerp(target.current, k);
    camera.position.lerp(camGoal.current, k);
    controls.update();
    if (controls.target.distanceTo(target.current) < 0.3) active.current = false;
  });

  return null;
}

function SnapshotHandler() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const onRequest = (e: Event) => {
      const { scale } = (e as CustomEvent<{ scale?: number }>).detail;
      const prev = new THREE.Vector2();
      gl.getSize(prev);
      const ratio = gl.getPixelRatio();
      const w = Math.round(prev.x * (scale ?? 1));
      const h = Math.round(prev.y * (scale ?? 1));
      const cam = camera as THREE.PerspectiveCamera;
      try {
        gl.setPixelRatio(1);
        gl.setSize(w, h, false);
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
        gl.render(scene, camera);
        window.dispatchEvent(
          new CustomEvent("ulpin:snapshot", { detail: gl.domElement.toDataURL("image/png") }),
        );
      } catch {
        window.dispatchEvent(new CustomEvent("ulpin:snapshot", { detail: "" }));
      } finally {
        gl.setPixelRatio(ratio);
        gl.setSize(prev.x, prev.y, false);
        cam.aspect = prev.x / prev.y;
        cam.updateProjectionMatrix();
        gl.render(scene, camera);
      }
    };
    window.addEventListener("ulpin:snapshot-request", onRequest);
    return () => window.removeEventListener("ulpin:snapshot-request", onRequest);
  }, [gl, scene, camera]);

  return null;
}

function GroundPlane() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color="#b9b1a4" roughness={1} transparent opacity={0.42} />
      </mesh>
      <Grid
        position={[0, 0.001, 0]}
        args={[600, 600]}
        cellSize={5}
        cellThickness={0.5}
        sectionSize={25}
        sectionThickness={1}
        cellColor="#8d857a"
        sectionColor="#6f6860"
        fadeDistance={520}
        fadeStrength={1.2}
        infiniteGrid
      />
    </>
  );
}

export function Viewport3D() {
  const selectStratum = useRegistry((s) => s.selectStratum);

  return (
    <Canvas
      shadows="soft"
      dpr={[1, 2]}
      camera={{ fov: 44, near: 0.5, far: 3000, position: [80, 62, 96] }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.06;
        scene.background = new THREE.Color("#d8d3c9");
        scene.fog = new THREE.Fog("#d8d3c9", 420, 900);
      }}
      onPointerMissed={() => selectStratum(null)}
    >
      <hemisphereLight args={["#e8eef4", "#9c9384", 0.85]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        castShadow
        position={[120, 180, 90]}
        intensity={1.9}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-180}
        shadow-camera-right={180}
        shadow-camera-top={180}
        shadow-camera-bottom={-180}
        shadow-camera-far={600}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
      />
      <GroundPlane />
      <StrataScene />
      <LiveScene />
      <SceneCameraLink />
      <CameraRig />
      <SnapshotHandler />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={12}
        maxDistance={700}
        maxPolarAngle={(MAX_PITCH * Math.PI) / 180}
      />
    </Canvas>
  );
}
