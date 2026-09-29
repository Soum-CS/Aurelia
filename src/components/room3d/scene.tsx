"use client";

import { useMemo, useRef, Suspense, useEffect, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, MeshReflectorMaterial } from "@react-three/drei";
import { QualityLevel, SceneConfig } from "@/lib/types";
import { PALETTES, ScenePalette } from "./palettes";
import { getFloorMaps, getPlasterRough, getPlasterNormalMap, getWeaveBump, getFabricNormalMap } from "./textures";
import {
  Artwork,
  Bathtub,
  Bed,
  Desk,
  Fireplace,
  FloorLamp,
  LoungeChair,
  NightstandLamp,
  Plant,
  Rug,
  Sofa,
} from "./furniture";
import { CityView, GardenView, MountainView, OceanView } from "./window-view";
import { GLBRoom } from "./glb-room";
import { createGlassMaterial, createPlasterWallMaterial } from "./materials";

export interface ViewPose {
  pos: [number, number, number];
  target: [number, number, number];
  fov?: number;
}

interface HotspotDef {
  id: string;
  label: string;
  position: [number, number, number];
  cam: ViewPose;
}

/** Default overview framing (photographed from the doorway corner). */
export const HOME_POSE: ViewPose = { pos: [4.8, 2.9, 5.2], target: [0, 0.9, -0.1] };

/** First-person walkthrough entry: eye height, facing the bed + window. */
export const WALK_START = {
  pos: [2.25, 1.55, 1.7] as [number, number, number],
  yaw: 0.9,
  pitch: -0.02,
};

export function getHotspots(config: SceneConfig): HotspotDef[] {
  const spots: HotspotDef[] = [
    {
      id: "bed",
      label: "The bed",
      position: [-0.35, 1.35, -0.7],
      cam: { pos: [1.6, 1.45, 0.6], target: [-0.35, 0.7, -0.9] },
    },
    {
      id: "view",
      label: "The view",
      position: [0, 1.7, 2.1],
      cam: { pos: [-0.4, 1.55, 0.2], target: [0.1, 1.6, 2.4] },
    },
    {
      id: "light",
      label: "Evening light",
      position: [2.5, 1.9, -1.5],
      cam: { pos: [1.1, 1.45, 0.4], target: [2.55, 1.45, -1.62] },
    },
  ];

  const extraSpots: Record<string, HotspotDef> = {
    desk: {
      id: "desk",
      label: "Workspace",
      position: [-2.25, 1.15, 0.85],
      cam: { pos: [-1.0, 1.45, 1.9], target: [-2.4, 0.8, 0.85] },
    },
    sofa: {
      id: "sofa",
      label: "Sofa",
      position: [1.7, 1.05, 1.1],
      cam: { pos: [0.1, 1.5, -0.7], target: [1.7, 0.65, 1.15] },
    },
    lounge: {
      id: "lounge",
      label: "Reading chair",
      position: [-1.85, 1.0, 1.25],
      cam: { pos: [-0.5, 1.4, -0.2], target: [-1.9, 0.65, 1.25] },
    },
    bathtub: {
      id: "bathtub",
      label: "Soaking tub",
      position: [2.05, 0.95, 1.35],
      cam: { pos: [0.6, 1.5, 0.3], target: [2.1, 0.65, 1.25] },
    },
    fireplace: {
      id: "fireplace",
      label: "Fireplace",
      position: [-2.75, 1.25, 0.15],
      cam: { pos: [-1.3, 1.45, 1.5], target: [-2.93, 0.85, 0.2] },
    },
  };

  for (const e of config.extras.slice(0, 2)) {
    if (extraSpots[e]) spots.push(extraSpots[e]);
  }
  return spots;
}

/** Soft XZ collision boxes for walkthrough mode. */
export function getColliders(config: SceneConfig): Array<{ min: [number, number]; max: [number, number] }> {
  const bedX = -0.35;
  const bedW = config.bed === "king" ? 2.1 : config.bed === "twin" ? 1.55 : 1.75;
  const half = bedW / 2;
  const boxes: Array<{ min: [number, number]; max: [number, number] }> = [
    { min: [bedX - half - 0.08, -2.0], max: [bedX + half + 0.08, 0.4] }, // bed
    { min: [bedX - half - 0.72, -2.16], max: [bedX - half - 0.12, -1.6] }, // nightstand L
    { min: [bedX + half + 0.12, -2.16], max: [bedX + half + 0.72, -1.6] }, // nightstand R
    { min: [2.3, -1.88], max: [2.85, -1.35] }, // floor lamp
    { min: [-2.85, -2.05], max: [-2.25, -1.5] }, // plant
  ];
  if (config.extras.includes("desk")) boxes.push({ min: [-2.85, 0.2], max: [-1.35, 1.6] });
  if (config.extras.includes("sofa")) boxes.push({ min: [0.65, 0.4], max: [2.65, 1.8] });
  if (config.extras.includes("lounge")) boxes.push({ min: [-2.4, 0.7], max: [-1.4, 1.7] });
  if (config.extras.includes("bathtub")) boxes.push({ min: [1.3, 0.8], max: [3.0, 1.9] });
  return boxes;
}

const tmpDir = new THREE.Vector3();

/**
 * Camera-adaptive exposure: looking toward the bright window stops the
 * lens down; turning toward a darker interior corner opens it up.
 */
function ExposureRig({ timeOfDay }: { timeOfDay: "day" | "golden" | "night" }) {
  const { gl, camera } = useThree();
  const current = useRef(1.2);
  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    camera.getWorldDirection(tmpDir);
    const facingWindow = Math.max(0, tmpDir.z);
    const isNight = timeOfDay === "night";
    const isGolden = timeOfDay === "golden";

    const baseMin = isNight ? 1.25 : isGolden ? 1.18 : 1.1;
    const baseMax = isNight ? 1.55 : isGolden ? 1.48 : 1.42;

    const target = THREE.MathUtils.lerp(baseMax, baseMin, facingWindow);
    const k = 1 - Math.exp(-2.6 * delta);
    current.current += (target - current.current) * k;
    gl.toneMappingExposure = current.current;
  });
  return null;
}

/** Multi-lightformer HDR Environment rig matched to time of day. */
function RoomEnvironment({
  timeOfDay,
  palette,
}: {
  timeOfDay: "day" | "golden" | "night";
  palette: ScenePalette;
}) {
  return (
    <Environment key={timeOfDay} resolution={512} frames={1}>
      <color attach="background" args={[timeOfDay === "night" ? "#09101f" : timeOfDay === "golden" ? "#b08554" : "#9db8cf"]} />
      {timeOfDay === "night" ? (
        <>
          {/* cool moonlit wash from above */}
          <Lightformer form="rect" intensity={0.25} color="#2b3b55" position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[15, 15]} />
          {/* moonlight through the window wall */}
          <Lightformer form="rect" intensity={0.65} color="#6d8bc4" scale={[3.2, 2.0]} position={[-1, 2.5, 9]} />
          {/* warm pools cast by practical lamps */}
          <Lightformer form="rect" intensity={2.8} color="#ffbe66" scale={[1.5, 1.5]} position={[-2.2, 1.0, -3.5]} />
          <Lightformer form="rect" intensity={2.8} color="#ffbe66" scale={[1.5, 1.5]} position={[1.2, 1.0, -3.5]} />
          <Lightformer form="rect" intensity={3.2} color="#ffc978" scale={[1.4, 2.0]} position={[3.4, 1.6, -3]} />
        </>
      ) : timeOfDay === "golden" ? (
        <>
          {/* warm golden afternoon sky */}
          <Lightformer form="rect" intensity={1.8} color="#fce2b8" position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[16, 16]} />
          {/* low golden sun streaming through the window */}
          <Lightformer form="rect" intensity={4.8} color="#ffa347" scale={[4.0, 4.5]} position={[3.0, 3.2, 9]} />
          {/* warm interior bounce */}
          <Lightformer form="rect" intensity={0.65} color="#dfaa78" scale={[8, 5]} position={[0, 3, -9]} />
          <Lightformer form="rect" intensity={0.45} color="#e0c29d" position={[0, -6, 0]} rotation-x={-Math.PI / 2} scale={[12, 12]} />
        </>
      ) : (
        <>
          {/* broad daylight sky */}
          <Lightformer form="rect" intensity={1.6} color="#e8f1f8" position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[16, 16]} />
          {/* bright sun streaming through the window */}
          <Lightformer form="rect" intensity={4.0} color={palette.sunDay} scale={[3.4, 4.2]} position={[2.6, 4.5, 9]} />
          {/* soft sky fill on opposite side */}
          <Lightformer form="rect" intensity={0.6} color="#cfdce8" scale={[8, 5]} position={[0, 3, -9]} />
          <Lightformer form="rect" intensity={0.35} color="#d8e2ec" scale={[5, 5]} position={[-9, 3, 0]} rotation-y={Math.PI / 2} />
          {/* warm floor bounce */}
          <Lightformer form="rect" intensity={0.4} color="#c8ab84" position={[0, -6, 0]} rotation-x={-Math.PI / 2} scale={[12, 12]} />
        </>
      )}
    </Environment>
  );
}

/** Subtle dust particles drifting in sunlight with Brownian motion. */
function DustMotes({ count = 120 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const data = useMemo(() => {
    const N = count;
    const positions = new Float32Array(N * 3);
    const base = new Float32Array(N * 3);
    const phase = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      base[i * 3] = -2.4 + Math.random() * 4.8;
      base[i * 3 + 1] = 0.25 + Math.random() * 2.1;
      base[i * 3 + 2] = -0.3 + Math.random() * 2.3;
      phase[i] = Math.random() * Math.PI * 2;
    }
    positions.set(base);
    return { positions, base, phase };
  }, [count]);

  useFrame(({ clock }) => {
    const pts = pointsRef.current;
    if (!pts) return;
    const t = clock.elapsedTime;
    const attr = pts.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < data.phase.length; i++) {
      const s = 0.05 + (i % 5) * 0.018;
      arr[i * 3] = data.base[i * 3] + Math.cos(t * s * 0.6 + data.phase[i]) * 0.08;
      arr[i * 3 + 1] = data.base[i * 3 + 1] + Math.sin(t * s + data.phase[i]) * 0.16;
      arr[i * 3 + 2] = data.base[i * 3 + 2] + Math.sin(t * s * 0.8 + data.phase[i] * 1.7) * 0.06;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.022}
        sizeAttenuation
        transparent
        opacity={0.35}
        color="#fff1d0"
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function WindowWall({
  p,
  night,
  curtainsClosed = false,
}: {
  p: ScenePalette;
  night: boolean;
  curtainsClosed?: boolean;
}) {
  const z = 2.2;
  const leftCurtain = useRef<THREE.Group>(null);
  const rightCurtain = useRef<THREE.Group>(null);
  const glassMat = useMemo(() => createGlassMaterial({ opacity: 0.08, transmission: 0.96 }), []);
  const plasterMat = useMemo(() => createPlasterWallMaterial(p.wall), [p.wall]);
  const fabricNormal = useMemo(() => getFabricNormalMap(), []);
  const weave = useMemo(() => getWeaveBump(), []);

  // Smooth curtain open/close lerp + subtle breeze animation
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const targetLeft = curtainsClosed ? -0.68 : -1.62;
    const targetRight = curtainsClosed ? 0.68 : 1.62;
    const k = 1 - Math.exp(-4.5 * Math.min(delta, 0.05));

    if (leftCurtain.current) {
      leftCurtain.current.position.x += (targetLeft - leftCurtain.current.position.x) * k;
      leftCurtain.current.rotation.x = Math.sin(t * 0.45) * 0.009;
      leftCurtain.current.rotation.y = Math.sin(t * 0.31 + 1.2) * 0.006;
    }
    if (rightCurtain.current) {
      rightCurtain.current.position.x += (targetRight - rightCurtain.current.position.x) * k;
      rightCurtain.current.rotation.x = Math.sin(t * 0.45 + 0.9) * 0.009;
      rightCurtain.current.rotation.y = Math.sin(t * 0.27) * 0.006;
    }
  });

  return (
    <group>
      {/* wall segments around window opening */}
      {[
        { pos: [-2.15, 1.35, z], size: [1.7, 2.7] },
        { pos: [2.15, 1.35, z], size: [1.7, 2.7] },
        { pos: [0, 0.425, z], size: [2.6, 0.85] },
        { pos: [0, 2.525, z], size: [2.6, 0.35] },
      ].map((s, i) => (
        <mesh key={i} position={s.pos as [number, number, number]} rotation={[0, Math.PI, 0]} receiveShadow>
          <planeGeometry args={[s.size[0], s.size[1]]} />
          <primitive object={plasterMat} attach="material" />
        </mesh>
      ))}

      {/* window mullions and frames */}
      {[
        { pos: [0, 2.37, z - 0.03], size: [2.76, 0.08, 0.09] },
        { pos: [0, 0.83, z - 0.03], size: [2.76, 0.08, 0.09] },
        { pos: [-1.33, 1.6, z - 0.03], size: [0.08, 1.62, 0.09] },
        { pos: [1.33, 1.6, z - 0.03], size: [0.08, 1.62, 0.09] },
        { pos: [0, 1.6, z - 0.03], size: [0.05, 1.54, 0.06] },
      ].map((f, i) => (
        <mesh key={`f${i}`} position={f.pos as [number, number, number]} castShadow>
          <boxGeometry args={f.size as [number, number, number]} />
          <meshStandardMaterial color={p.wallTrim} roughness={0.7} />
        </mesh>
      ))}

      {/* physical glass with realistic transmission */}
      <mesh position={[0, 1.6, z - 0.04]}>
        <planeGeometry args={[2.6, 1.5]} />
        <primitive object={glassMat} attach="material" />
      </mesh>

      {/* curtain rod in brushed brass */}
      <mesh position={[0, 2.47, z - 0.12]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 3.6, 12]} />
        <meshStandardMaterial color={p.metal} metalness={0.85} roughness={0.25} />
      </mesh>

      {/* sheer and blackout draped curtains */}
      {(
        [
          [-1.62, leftCurtain],
          [1.62, rightCurtain],
        ] as const
      ).map(([x, ref], i) => (
        <group key={`c${i}`} ref={ref} position={[x, 2.38, z - 0.12]}>
          <mesh position={[0, -0.8, 0]} castShadow>
            <boxGeometry args={[0.52, 1.82, 0.09]} />
            <meshPhysicalMaterial
              color={p.textileDark}
              roughness={0.95}
              bumpMap={weave}
              bumpScale={0.6}
              normalMap={fabricNormal}
              normalScale={new THREE.Vector2(0.35, 0.35)}
              sheen={0.8}
              sheenRoughness={0.4}
              sheenColor="#fff4e0"
              emissive={night ? "#000000" : p.sunDay}
              emissiveIntensity={night ? 0 : 0.06}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Baseboards({ p }: { p: ScenePalette }) {
  return (
    <group>
      <mesh position={[0, 0.045, -2.17]}>
        <boxGeometry args={[6, 0.09, 0.03]} />
        <meshStandardMaterial color={p.wallTrim} roughness={0.75} />
      </mesh>
      <mesh position={[-2.97, 0.045, 0]}>
        <boxGeometry args={[0.03, 0.09, 4.4]} />
        <meshStandardMaterial color={p.wallTrim} roughness={0.75} />
      </mesh>
      <mesh position={[2.97, 0.045, 0]}>
        <boxGeometry args={[0.03, 0.09, 4.4]} />
        <meshStandardMaterial color={p.wallTrim} roughness={0.75} />
      </mesh>
    </group>
  );
}

function Door({ p }: { p: ScenePalette }) {
  return (
    <group position={[2.955, 0, -1.05]} rotation={[0, -Math.PI / 2, 0]}>
      {/* trim */}
      {[
        { pos: [-0.53, 1.07, 0], size: [0.09, 2.14, 0.1] },
        { pos: [0.53, 1.07, 0], size: [0.09, 2.14, 0.1] },
        { pos: [0, 2.185, 0], size: [1.15, 0.09, 0.1] },
      ].map((f, i) => (
        <mesh key={`t${i}`} position={f.pos as [number, number, number]} castShadow>
          <boxGeometry args={f.size as [number, number, number]} />
          <meshStandardMaterial color={p.wallTrim} roughness={0.75} />
        </mesh>
      ))}
      {/* slab */}
      <mesh position={[0, 1.02, 0.01]} castShadow receiveShadow>
        <boxGeometry args={[0.96, 2.04, 0.05]} />
        <meshStandardMaterial color={p.textileDark} roughness={0.65} envMapIntensity={0.6} />
      </mesh>
      {/* recessed panels */}
      <mesh position={[0, 1.48, 0.045]}>
        <boxGeometry args={[0.66, 0.78, 0.012]} />
        <meshStandardMaterial color={p.wood} roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.58, 0.045]}>
        <boxGeometry args={[0.66, 0.66, 0.012]} />
        <meshStandardMaterial color={p.wood} roughness={0.65} />
      </mesh>
      {/* brass lever handle */}
      <group position={[-0.34, 1.04, 0.06]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.025, 16]} />
          <meshStandardMaterial color={p.metal} metalness={0.88} roughness={0.22} envMapIntensity={1.5} />
        </mesh>
        <mesh position={[0.055, -0.005, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.011, 0.011, 0.13, 12]} />
          <meshStandardMaterial color={p.metal} metalness={0.88} roughness={0.22} envMapIntensity={1.5} />
        </mesh>
      </group>
    </group>
  );
}

export function RoomScene({
  config,
  night,
  timeOfDay = night ? "night" : "day",
  quality = "balanced",
  artSeed = 1,
  curtainsClosed = false,
  practicalLampsOn,
}: {
  config: SceneConfig;
  night: boolean;
  timeOfDay?: "day" | "golden" | "night";
  quality?: QualityLevel;
  artSeed?: number;
  curtainsClosed?: boolean;
  practicalLampsOn?: boolean;
}) {
  const p = PALETTES[config.palette];
  const plasterMat = useMemo(() => createPlasterWallMaterial(p.wall), [p.wall]);
  const floorMaps = useMemo(() => getFloorMaps(p.floor, p.floorAlt), [p.floor, p.floorAlt]);

  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }
  }, []);

  const isNight = timeOfDay === "night";
  const isGolden = timeOfDay === "golden";
  const isLit = practicalLampsOn !== undefined ? practicalLampsOn : isNight;

  // Shadow map resolution based on quality tier
  const shadowMapSize = quality === "cinematic" ? [4096, 4096] : quality === "mobile" ? [1024, 1024] : [2048, 2048];
  const dustCount = quality === "cinematic" ? 200 : quality === "high" ? 140 : quality === "mobile" ? 30 : 80;

  // Real-time reflections enabled on High and Cinematic
  const enablePlanarFloor = quality === "high" || quality === "cinematic";

  return (
    <group>
      <color attach="background" args={[isNight ? "#12151e" : isGolden ? "#b89066" : "#e9e1d2"]} />

      {/* image-based lighting (IBL) matched to time of day */}
      <RoomEnvironment timeOfDay={timeOfDay} palette={p} />

      {/* keyed directional sunlight with soft penumbra */}
      <directionalLight
        position={isGolden ? [3.6, 3.8, 8.5] : [3.2, 5.5, 8]}
        intensity={(isNight ? 0 : isGolden ? 3.4 : 2.6) * (curtainsClosed ? 0.15 : 1.0)}
        color={isGolden ? "#ffaa50" : p.sunDay}
        castShadow
        shadow-mapSize={shadowMapSize as [number, number]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
      />

      <ambientLight
        intensity={isNight ? 0.08 : isGolden ? 0.16 : 0.15}
        color={isNight ? "#3e4d77" : isGolden ? "#ffe3bd" : "#fff6e8"}
      />
      {!isNight && (
        <hemisphereLight
          intensity={0.2}
          color={isGolden ? "#ffd4a0" : "#dfe8f2"}
          groundColor="#b09a78"
        />
      )}
      <directionalLight
        position={[-6, 9, -4]}
        intensity={isNight ? 0.14 : 0.24}
        color={isNight ? "#546592" : "#d6e2ef"}
      />

      {/* floor: real-time reflective parquet on High/Cinematic, textured PBR on Mobile/Balanced */}
      <mesh receiveShadow position={[0, -0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 4.4]} />
        {enablePlanarFloor ? (
          <MeshReflectorMaterial
            blur={[300, 100]}
            resolution={quality === "cinematic" ? 1024 : 512}
            mirror={0.4}
            mixBlur={0.85}
            mixStrength={0.5}
            roughness={0.65}
            depthScale={1.2}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color={p.floor}
            metalness={0.15}
            map={floorMaps.map}
            roughnessMap={floorMaps.roughnessMap}
            normalMap={floorMaps.normalMap}
            normalScale={new THREE.Vector2(0.4, 0.4)}
          />
        ) : (
          <meshStandardMaterial
            map={floorMaps.map}
            roughnessMap={floorMaps.roughnessMap}
            normalMap={floorMaps.normalMap}
            normalScale={new THREE.Vector2(0.4, 0.4)}
            roughness={0.64}
            envMapIntensity={0.8}
          />
        )}
      </mesh>

      {/* wool area rug */}
      <Rug p={p} />

      {/* plaster walls */}
      <mesh position={[0, 1.35, -2.2]} receiveShadow>
        <planeGeometry args={[6, 2.7]} />
        <primitive object={plasterMat} attach="material" />
      </mesh>
      <mesh position={[-3, 1.35, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[4.4, 2.7]} />
        <primitive object={plasterMat} attach="material" />
      </mesh>
      <mesh position={[3, 1.35, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[4.4, 2.7]} />
        <primitive object={plasterMat} attach="material" />
      </mesh>

      <WindowWall p={p} night={isNight} curtainsClosed={curtainsClosed} />
      <Baseboards p={p} />
      <Door p={p} />

      {/* camera-adaptive exposure */}
      <ExposureRig timeOfDay={timeOfDay} />

      {/* grounded soft contact shadows */}
      <ContactShadows
        position={[0, 0.002, 0]}
        scale={[7.2, 5]}
        far={1.5}
        blur={2.4}
        resolution={quality === "mobile" ? 256 : 512}
        frames={1}
        opacity={isNight ? 0.52 : 0.4}
        color="#342516"
      />

      {/* GLB Room model with Suspense and procedural fallback */}
      {config.modelUrl ? (
        <Suspense
          fallback={
            <group>
              <Bed p={p} bed={config.bed} position={[-0.35, 0, -1.15]} />
              <NightstandLamp p={p} night={isNight} lit={isLit} x={-1.85} />
              <NightstandLamp p={p} night={isNight} lit={isLit} x={1.15} />
              <Artwork p={p} position={[1.7, 1.72, -2.16]} wide />
              <Plant position={[-2.55, 0, -1.78]} scale={0.95} />
              <FloorLamp p={p} night={isNight} lit={isLit} position={[2.55, 0, -1.62]} />
              {config.extras.includes("desk") && <Desk p={p} />}
              {config.extras.includes("sofa") && <Sofa p={p} />}
              {config.extras.includes("lounge") && <LoungeChair p={p} />}
              {config.extras.includes("bathtub") && <Bathtub p={p} />}
              {config.extras.includes("fireplace") && <Fireplace p={p} night={isNight} lit={isLit} />}
            </group>
          }
        >
          <GLBRoom modelUrl={config.modelUrl} config={config} night={isNight} />
          {/* Dynamic practical point lights in GLB mode */}
          {isLit && (
            <group>
              <pointLight position={[-1.82, 0.95, -1.55]} intensity={2.2} distance={3.8} decay={2} color="#ffbe73" />
              <pointLight position={[1.12, 0.95, -1.55]} intensity={2.2} distance={3.8} decay={2} color="#ffbe73" />
              <pointLight position={[2.55, 1.62, -1.62]} intensity={3.0} distance={4.5} decay={2} color="#ffbe73" />
              {config.extras.includes("desk") && (
                <pointLight position={[-1.87, 1.22, 0.69]} intensity={1.8} distance={3.0} decay={2} color="#ffc47f" />
              )}
              {config.extras.includes("fireplace") && (
                <pointLight position={[-2.93, 0.4, 0.5]} intensity={3.6} distance={3.8} decay={2} color="#ff8c3a" />
              )}
            </group>
          )}
        </Suspense>
      ) : (
        <group>
          <Bed p={p} bed={config.bed} position={[-0.35, 0, -1.15]} />
          <NightstandLamp p={p} night={isNight} lit={isLit} x={-1.85} />
          <NightstandLamp p={p} night={isNight} lit={isLit} x={1.15} />
          <Artwork p={p} position={[1.7, 1.72, -2.16]} wide />
          <Plant position={[-2.55, 0, -1.78]} scale={0.95} />
          <FloorLamp p={p} night={isNight} lit={isLit} position={[2.55, 0, -1.62]} />
          {config.extras.includes("desk") && <Desk p={p} />}
          {config.extras.includes("sofa") && <Sofa p={p} />}
          {config.extras.includes("lounge") && <LoungeChair p={p} />}
          {config.extras.includes("bathtub") && <Bathtub p={p} />}
          {config.extras.includes("fireplace") && <Fireplace p={p} night={isNight} lit={isLit} />}
        </group>
      )}

      {/* dust particles drifting in sunlight (disabled if night or prefers-reduced-motion) */}
      {!isNight && !reducedMotion && <DustMotes count={dustCount} />}

      {/* outside window environment */}
      {config.windowView === "city" && <CityView p={p} night={isNight} seed={artSeed} />}
      {config.windowView === "ocean" && <OceanView p={p} night={isNight} seed={artSeed} />}
      {config.windowView === "garden" && <GardenView p={p} night={isNight} seed={artSeed} />}
      {(config.windowView === "alps" || config.windowView === "mountain") && (
        <MountainView p={p} night={isNight} seed={artSeed} />
      )}
    </group>
  );
}
