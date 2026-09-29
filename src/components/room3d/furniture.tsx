"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ScenePalette } from "./palettes";
import { getWeaveBump, getFabricNormalMap } from "./textures";
import {
  createFabricMaterial,
  createGlassMaterial,
  createMarbleMaterial,
  createChromeMaterial,
  createBrassMaterial,
} from "./materials";

/** Subtle organic intensity wobble for practical filament lights. */
export function useLampFlicker(ref: React.RefObject<THREE.PointLight | null>, base: number) {
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.intensity =
      base * (1 + Math.sin(t * 9.3) * 0.025 + Math.sin(t * 23.7) * 0.015 + Math.cos(t * 37.1) * 0.01);
  });
}

function Wood({
  w,
  h,
  d,
  color,
  woven = false,
  ...rest
}: { w: number; h: number; d: number; color?: string; woven?: boolean } & Record<string, unknown>) {
  const weave = woven ? getWeaveBump() : undefined;
  return (
    <mesh castShadow receiveShadow {...rest}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} roughness={woven ? 1 : 0.65} bumpMap={weave} bumpScale={woven ? 0.4 : 0} />
    </mesh>
  );
}

export function Bed({
  p,
  bed,
  position = [0, 0, -1.15],
}: {
  p: ScenePalette;
  bed: "king" | "queen" | "twin";
  position?: [number, number, number];
}) {
  const weave = getWeaveBump();
  const fabricNormal = getFabricNormalMap();
  const width = bed === "king" ? 2.0 : bed === "queen" ? 1.7 : 1.5;

  const duvetMaterial = useMemo(
    () =>
      createFabricMaterial({
        color: p.textile,
        sheenColor: "#fff8ea",
        sheenIntensity: 0.65,
        sheenRoughness: 0.45,
      }),
    [p.textile]
  );

  const linenMaterial = useMemo(
    () =>
      createFabricMaterial({
        color: "#f8f5ee",
        sheenColor: "#ffffff",
        sheenIntensity: 0.35,
        roughness: 0.94,
      }),
    []
  );

  const velvetMaterial = useMemo(
    () =>
      createFabricMaterial({
        color: p.textileDark,
        sheenColor: "#ffd9aa",
        sheenIntensity: 0.85,
        sheenRoughness: 0.35,
      }),
    [p.textileDark]
  );

  return (
    <group position={position}>
      {/* fluted wooden headboard */}
      <Wood w={width + 0.3} h={1.3} d={0.09} color={p.wood} position={[0, 0.74, -0.56]} />
      {/* channel tufted velvet inserts */}
      {[-0.6, -0.2, 0.2, 0.6].map((ox, i) => (
        <mesh key={i} position={[ox * (width / 1.8), 0.76, -0.51]} castShadow>
          <boxGeometry args={[width * 0.18, 1.18, 0.03]} />
          <meshPhysicalMaterial
            color={p.textileDark}
            roughness={0.9}
            sheen={0.8}
            sheenColor="#ffd9aa"
            sheenRoughness={0.4}
            normalMap={fabricNormal}
            normalScale={new THREE.Vector2(0.3, 0.3)}
          />
        </mesh>
      ))}

      {/* frame & platform */}
      <Wood w={width + 0.16} h={0.32} d={2.15} color={p.wood} position={[0, 0.22, 0.35]} />

      {/* tapered brass legs */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <mesh key={i} position={[(sx * (width + 0.16)) / 2 - sx * 0.05, 0.08, 0.35 + sz * 1.02]}>
          <cylinderGeometry args={[0.024, 0.016, 0.16, 16]} />
          <meshStandardMaterial color={p.metal} metalness={0.85} roughness={0.25} />
        </mesh>
      ))}

      {/* mattress + piped border */}
      <mesh castShadow receiveShadow position={[0, 0.48, 0.35]}>
        <boxGeometry args={[width, 0.24, 2.05]} />
        <primitive object={linenMaterial} attach="material" />
      </mesh>

      {/* layered plush duvet with realistic sheen */}
      <mesh castShadow position={[0, 0.62, 0.45]}>
        <boxGeometry args={[width + 0.06, 0.11, 1.55]} />
        <primitive object={duvetMaterial} attach="material" />
      </mesh>

      {/* folded turnover sheet */}
      <mesh position={[0, 0.67, -0.28]} castShadow>
        <boxGeometry args={[width + 0.06, 0.04, 0.34]} />
        <meshStandardMaterial color={p.rug} roughness={0.95} bumpMap={weave} bumpScale={0.4} />
      </mesh>

      {/* folded waffle-knit throw blanket draped across the foot */}
      <mesh position={[0, 0.685, 0.88]} castShadow>
        <boxGeometry args={[width + 0.08, 0.035, 0.52]} />
        <primitive object={velvetMaterial} attach="material" />
      </mesh>

      {/* 4 layered sleeping pillows: organic slight tilt, natural imperfection */}
      {[
        { x: -width * 0.24, y: 0.71, z: -0.38, rx: -0.3, ry: 0.04, rz: -0.03 },
        { x: width * 0.24, y: 0.7, z: -0.38, rx: -0.28, ry: -0.05, rz: 0.02 },
        { x: -width * 0.23, y: 0.75, z: -0.23, rx: -0.38, ry: 0.02, rz: 0.04 },
        { x: width * 0.23, y: 0.74, z: -0.24, rx: -0.36, ry: -0.03, rz: -0.02 },
      ].map((pos, idx) => (
        <mesh
          key={idx}
          castShadow
          position={[pos.x, pos.y, pos.z]}
          rotation={[pos.rx, pos.ry, pos.rz]}
        >
          <boxGeometry args={[width * 0.38, 0.14, 0.42]} />
          <primitive object={linenMaterial} attach="material" />
        </mesh>
      ))}

      {/* throw pillow + lumbar accent cushion */}
      <mesh castShadow position={[-width * 0.1, 0.76, -0.12]} rotation={[-0.42, 0.1, 0.05]}>
        <boxGeometry args={[width * 0.26, 0.26, 0.12]} />
        <primitive object={velvetMaterial} attach="material" />
      </mesh>
      <mesh castShadow position={[width * 0.12, 0.74, -0.1]} rotation={[-0.38, -0.08, -0.04]}>
        <boxGeometry args={[width * 0.34, 0.18, 0.1]} />
        <meshStandardMaterial color={p.textileDark} roughness={0.9} bumpMap={weave} bumpScale={0.5} />
      </mesh>

      {/* subtle realism: plush slippers casually angled on floor beside bed */}
      <group position={[width * 0.5 + 0.32, 0.02, 0.35]} rotation={[0, -0.25, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.11, 0.03, 0.26]} />
          <primitive object={linenMaterial} attach="material" />
        </mesh>
        <mesh castShadow position={[0.15, 0, 0.04]} rotation={[0, 0.12, 0]}>
          <boxGeometry args={[0.11, 0.03, 0.26]} />
          <primitive object={linenMaterial} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

export function NightstandLamp({
  p,
  night,
  lit,
  x,
}: {
  p: ScenePalette;
  night: boolean;
  lit?: boolean;
  x: number;
}) {
  const isLit = lit !== undefined ? lit : night;
  const lightRef = useRef<THREE.PointLight>(null);
  useLampFlicker(lightRef, 2.4);

  const marbleMat = useMemo(() => createMarbleMaterial(), []);
  const glassMat = useMemo(() => createGlassMaterial({ opacity: 0.12 }), []);

  const isLeft = x < 0;

  return (
    <group position={[x, 0, -1.9]}>
      {/* walnut nightstand body */}
      <Wood w={0.56} h={0.46} d={0.44} color={p.wood} position={[0, 0.23, 0]} />
      {/* polished marble slab top */}
      <mesh position={[0, 0.47, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.58, 0.03, 0.46]} />
        <primitive object={marbleMat} attach="material" />
      </mesh>
      {/* brass drawer pull */}
      <mesh position={[0, 0.26, 0.23]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.007, 0.007, 0.16, 12]} />
        <meshStandardMaterial color={p.metal} metalness={0.88} roughness={0.22} />
      </mesh>

      {/* accessories: carafe & tumbler on left, clock/vase on right */}
      {isLeft ? (
        <group position={[-0.12, 0.49, 0.06]}>
          <mesh position={[0, 0.09, 0]}>
            <cylinderGeometry args={[0.035, 0.05, 0.18, 16]} />
            <primitive object={glassMat} attach="material" />
          </mesh>
          <mesh position={[0.12, 0.05, 0.02]}>
            <cylinderGeometry args={[0.03, 0.025, 0.09, 16]} />
            <primitive object={glassMat} attach="material" />
          </mesh>
        </group>
      ) : (
        <group position={[0.12, 0.49, 0.06]}>
          <mesh position={[0, 0.07, 0]}>
            <cylinderGeometry args={[0.025, 0.045, 0.14, 16]} />
            <meshStandardMaterial color="#dedad2" roughness={0.4} />
          </mesh>
        </group>
      )}

      {/* lamp base & arm */}
      <mesh position={[isLeft ? 0.14 : -0.14, 0.5, -0.06]}>
        <cylinderGeometry args={[0.05, 0.07, 0.02, 16]} />
        <meshStandardMaterial color={p.metal} metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[isLeft ? 0.14 : -0.14, 0.68, -0.06]}>
        <cylinderGeometry args={[0.012, 0.012, 0.36, 12]} />
        <meshStandardMaterial color={p.metal} metalness={0.85} roughness={0.25} />
      </mesh>
      {/* frosted lamp shade */}
      <mesh castShadow position={[isLeft ? 0.14 : -0.14, 0.88, -0.06]}>
        <coneGeometry args={[0.15, 0.22, 20, 1, true]} />
        <meshStandardMaterial
          color={isLit ? "#ffe7be" : "#fbf8f0"}
          emissive={isLit ? "#ffb854" : "#000000"}
          emissiveIntensity={isLit ? 1.6 : 0}
          side={THREE.DoubleSide}
          roughness={0.75}
        />
      </mesh>

      {isLit && (
        <pointLight
          ref={lightRef}
          position={[isLeft ? 0.14 : -0.14, 0.82, -0.06]}
          intensity={2.4}
          distance={3.8}
          decay={2}
          color="#ffbe73"
        />
      )}
    </group>
  );
}

export function Rug({ p }: { p: ScenePalette }) {
  const weave = getWeaveBump();
  return (
    <mesh receiveShadow position={[0, 0.008, 0.75]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[3.2, 2.2]} />
      <meshStandardMaterial color={p.rug} roughness={0.98} bumpMap={weave} bumpScale={0.8} />
    </mesh>
  );
}

export function Sofa({ p, position = [1.65, 0, 1.1] }: { p: ScenePalette; position?: [number, number, number] }) {
  const velvetMat = useMemo(
    () =>
      createFabricMaterial({
        color: p.textile,
        sheenColor: "#fff0da",
        sheenIntensity: 0.7,
      }),
    [p.textile]
  );
  const marbleMat = useMemo(() => createMarbleMaterial(), []);

  return (
    <group position={position} rotation={[0, -0.45, 0]}>
      {/* sofa base */}
      <Wood w={1.8} h={0.34} d={0.86} color={p.textile} position={[0, 0.3, 0]} />
      {/* backrest */}
      <Wood w={1.8} h={0.52} d={0.2} color={p.textile} position={[0, 0.68, -0.33]} />
      {/* arms */}
      <Wood w={0.2} h={0.36} d={0.86} color={p.textile} position={[-0.8, 0.62, 0]} />
      <Wood w={0.2} h={0.36} d={0.86} color={p.textile} position={[0.8, 0.62, 0]} />

      {/* deep plush cushions */}
      {[-1, 1].map((s) => (
        <mesh key={s} castShadow position={[s * 0.44, 0.54, 0.04]}>
          <boxGeometry args={[0.78, 0.15, 0.64]} />
          <primitive object={velvetMat} attach="material" />
        </mesh>
      ))}

      {/* accent throw pillow */}
      <mesh castShadow position={[-0.56, 0.65, -0.15]} rotation={[-0.2, 0.3, 0.1]}>
        <boxGeometry args={[0.36, 0.36, 0.12]} />
        <meshStandardMaterial color={p.textileDark} roughness={0.85} />
      </mesh>

      {/* low coffee table in front of sofa */}
      <group position={[-0.6, 0, 0.75]}>
        <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.34, 0.34, 0.03, 28]} />
          <primitive object={marbleMat} attach="material" />
        </mesh>
        <mesh position={[0, 0.13, 0]}>
          <cylinderGeometry args={[0.03, 0.14, 0.27, 20]} />
          <meshStandardMaterial color={p.metal} metalness={0.85} roughness={0.25} />
        </mesh>
      </group>
    </group>
  );
}

export function LoungeChair({ p, position = [-1.9, 0, 1.2] }: { p: ScenePalette; position?: [number, number, number] }) {
  const velvetMat = useMemo(
    () =>
      createFabricMaterial({
        color: p.textileDark,
        sheenColor: "#ffd6a0",
        sheenIntensity: 0.8,
      }),
    [p.textileDark]
  );
  return (
    <group position={position} rotation={[0, 0.85, 0]}>
      <mesh castShadow position={[0, 0.34, 0]}>
        <boxGeometry args={[0.76, 0.28, 0.76]} />
        <primitive object={velvetMat} attach="material" />
      </mesh>
      <mesh castShadow position={[0, 0.68, -0.28]} rotation={[0.15, 0, 0]}>
        <boxGeometry args={[0.76, 0.44, 0.18]} />
        <primitive object={velvetMat} attach="material" />
      </mesh>
      {[
        [-0.3, -0.3],
        [0.3, -0.3],
        [-0.3, 0.3],
        [0.3, 0.3],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.09, z]}>
          <cylinderGeometry args={[0.018, 0.014, 0.18, 12]} />
          <meshStandardMaterial color={p.metal} metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

export function Desk({ p, position = [-2.45, 0, 0.9] }: { p: ScenePalette; position?: [number, number, number] }) {
  const brassMat = useMemo(() => createBrassMaterial(p.metal), [p.metal]);
  return (
    <group position={position} rotation={[0, Math.PI / 2, 0]}>
      {/* solid oak top */}
      <Wood w={1.25} h={0.05} d={0.6} color={p.wood} position={[0, 0.74, 0]} />
      {/* black metal / brass tapered legs */}
      {[
        [-0.56, -0.24],
        [0.56, -0.24],
        [-0.56, 0.24],
        [0.56, 0.24],
      ].map(([dx, dz], i) => (
        <mesh key={i} position={[dx, 0.36, dz]}>
          <cylinderGeometry args={[0.018, 0.012, 0.72, 12]} />
          <meshStandardMaterial color="#222224" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}

      {/* leather desk blotter pad */}
      <mesh position={[0, 0.77, 0.02]}>
        <boxGeometry args={[0.68, 0.008, 0.44]} />
        <meshStandardMaterial color="#35271d" roughness={0.6} />
      </mesh>

      {/* open art monograph */}
      <group position={[-0.08, 0.78, 0.02]}>
        <mesh position={[-0.1, 0.008, 0]} rotation={[0, 0.06, 0]}>
          <boxGeometry args={[0.18, 0.012, 0.26]} />
          <meshStandardMaterial color="#f7f4ec" roughness={0.9} />
        </mesh>
        <mesh position={[0.1, 0.008, 0]} rotation={[0, -0.06, 0]}>
          <boxGeometry args={[0.18, 0.012, 0.26]} />
          <meshStandardMaterial color="#f7f4ec" roughness={0.9} />
        </mesh>
      </group>

      {/* sleek brass task lamp */}
      <group position={[0.42, 0.77, -0.15]}>
        <mesh position={[0, 0.01, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.016, 16]} />
          <primitive object={brassMat} attach="material" />
        </mesh>
        <mesh position={[0, 0.22, 0]} rotation={[0, 0, -0.15]}>
          <cylinderGeometry args={[0.007, 0.007, 0.42, 10]} />
          <primitive object={brassMat} attach="material" />
        </mesh>
        <mesh position={[-0.05, 0.42, 0]} rotation={[0, 0, Math.PI / 3]}>
          <cylinderGeometry args={[0.035, 0.06, 0.1, 16]} />
          <primitive object={brassMat} attach="material" />
        </mesh>
      </group>

      {/* designer desk chair */}
      <group position={[0, 0, 0.72]}>
        <mesh castShadow position={[0, 0.46, 0]}>
          <boxGeometry args={[0.46, 0.06, 0.44]} />
          <meshStandardMaterial color={p.textileDark} roughness={0.8} />
        </mesh>
        <mesh castShadow position={[0, 0.74, -0.19]}>
          <boxGeometry args={[0.44, 0.44, 0.05]} />
          <meshStandardMaterial color={p.wood} roughness={0.65} />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.44, 12]} />
          <meshStandardMaterial color="#222224" metalness={0.7} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

export function Bathtub({ p, position = [2.15, 0, 1.35] }: { p: ScenePalette; position?: [number, number, number] }) {
  const chromeMat = useMemo(() => createChromeMaterial("#f4f7fb"), []);
  const marbleMat = useMemo(() => createMarbleMaterial(), []);
  const waterMat = useMemo(() => createGlassMaterial({ transmission: 0.94, roughness: 0.03 }), []);

  return (
    <group position={position} rotation={[0, -Math.PI / 2, 0]}>
      {/* marble wall backing slab */}
      <mesh position={[0, 1.0, -0.55]} receiveShadow>
        <planeGeometry args={[1.8, 2.0]} />
        <primitive object={marbleMat} attach="material" />
      </mesh>

      {/* porcelain soaking tub */}
      <mesh castShadow receiveShadow position={[0, 0.32, 0]}>
        <boxGeometry args={[1.5, 0.62, 0.84]} />
        <meshStandardMaterial color="#fafafa" roughness={0.12} metalness={0.04} />
      </mesh>

      {/* water surface */}
      <mesh position={[0, 0.54, 0]}>
        <boxGeometry args={[1.34, 0.01, 0.68]} />
        <primitive object={waterMat} attach="material" />
      </mesh>

      {/* floor-mounted polished chrome faucet */}
      <group position={[-0.72, 0, 0]}>
        <mesh position={[0, 0.48, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.92, 14]} />
          <primitive object={chromeMat} attach="material" />
        </mesh>
        <mesh position={[0, 0.94, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.18, 12]} />
          <primitive object={chromeMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

export function Fireplace({
  p,
  night,
  lit,
  position = [-2.93, 0, 0.2],
}: {
  p: ScenePalette;
  night: boolean;
  lit?: boolean;
  position?: [number, number, number];
}) {
  const isLit = lit !== undefined ? lit : night;
  const flameRef = useRef<THREE.MeshStandardMaterial>(null);
  const fireLightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!isLit) return;
    const t = clock.elapsedTime;
    const f = 1 + Math.sin(t * 11) * 0.08 + Math.sin(t * 29.3) * 0.05;
    if (flameRef.current) flameRef.current.emissiveIntensity = 2.4 * f;
    if (fireLightRef.current) fireLightRef.current.intensity = 3.6 * f;
  });

  return (
    <group position={position} rotation={[0, Math.PI / 2, 0]}>
      <Wood w={1.3} h={1.05} d={0.16} color={p.wallTrim} position={[0, 0.52, 0]} />
      <mesh position={[0, 0.34, 0.06]}>
        <boxGeometry args={[0.86, 0.5, 0.1]} />
        <meshStandardMaterial color="#1a1410" roughness={1} />
      </mesh>
      <mesh position={[0, 0.26, 0.1]}>
        <boxGeometry args={[0.6, 0.26, 0.04]} />
        <meshStandardMaterial
          ref={flameRef}
          color={isLit ? "#ff9a3c" : "#5a4432"}
          emissive={isLit ? "#ff7a1e" : "#000000"}
          emissiveIntensity={isLit ? 2.4 : 0}
          roughness={0.7}
        />
      </mesh>
      {isLit && (
        <pointLight
          ref={fireLightRef}
          position={[0, 0.4, 0.5]}
          intensity={3.6}
          distance={3.8}
          decay={2}
          color="#ff8c3a"
        />
      )}
      <Wood w={1.44} h={0.07} d={0.3} color={p.wood} position={[0, 1.08, 0.05]} />
    </group>
  );
}

function Foliage({ leaves }: { leaves: number[][] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.rotation.z = Math.sin(t * 0.7) * 0.02;
    ref.current.rotation.x = Math.cos(t * 0.53) * 0.012;
  });
  return (
    <group ref={ref}>
      {leaves.map(([x, y, z, s], i) => (
        <mesh key={i} castShadow position={[x, y, z]} rotation={[0.2 * i, i, 0.15 * i]}>
          <icosahedronGeometry args={[s, 1]} />
          <meshStandardMaterial color={i % 2 ? "#3b5c35" : "#4a7042"} roughness={0.75} />
        </mesh>
      ))}
    </group>
  );
}

export function Plant({ position = [-2.55, 0, -1.75], scale = 1 }: { position?: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.18, 0.14, 0.44, 20]} />
        <meshStandardMaterial color="#dfdcd5" roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.02, 16]} />
        <meshStandardMaterial color="#241a12" roughness={0.95} />
      </mesh>
      <Foliage
        leaves={[
          [0, 0.82, 0, 0.36],
          [0.18, 0.65, 0.09, 0.28],
          [-0.17, 0.6, -0.07, 0.26],
          [0.06, 0.52, 0.15, 0.22],
        ]}
      />
    </group>
  );
}

export function Artwork({ p, position = [0.9, 1.75, -2.12], wide = false }: { p: ScenePalette; position?: [number, number, number]; wide?: boolean }) {
  const w = wide ? 1.3 : 0.72;
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[w, w * 0.78, 0.05]} />
        <meshStandardMaterial color={p.metal} metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, 0.032]}>
        <planeGeometry args={[w - 0.1, w * 0.78 - 0.1]} />
        <meshStandardMaterial color="#f8f5ee" roughness={0.95} />
      </mesh>
      <mesh position={[w * 0.14, -w * 0.08, 0.036]} rotation={[0, 0, 0.4]}>
        <circleGeometry args={[w * 0.18, 28]} />
        <meshStandardMaterial color={p.art} roughness={0.8} />
      </mesh>
    </group>
  );
}

export function FloorLamp({
  p,
  night,
  lit,
  position = [2.55, 0, -1.6],
}: {
  p: ScenePalette;
  night: boolean;
  lit?: boolean;
  position?: [number, number, number];
}) {
  const isLit = lit !== undefined ? lit : night;
  const lightRef = useRef<THREE.PointLight>(null);
  useLampFlicker(lightRef, 3.2);
  return (
    <group position={position}>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.18, 0.2, 0.04, 20]} />
        <meshStandardMaterial color={p.metal} metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 1.5, 12]} />
        <meshStandardMaterial color={p.metal} metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh castShadow position={[0, 1.62, 0]}>
        <coneGeometry args={[0.24, 0.34, 24, 1, true]} />
        <meshStandardMaterial
          color={isLit ? "#ffe7be" : "#fbf8f0"}
          emissive={isLit ? "#ffb854" : "#000000"}
          emissiveIntensity={isLit ? 1.5 : 0}
          side={THREE.DoubleSide}
          roughness={0.75}
        />
      </mesh>
      {isLit && (
        <pointLight
          ref={lightRef}
          position={[0, 1.55, 0]}
          intensity={3.2}
          distance={4.5}
          decay={2}
          color="#ffbe73"
        />
      )}
    </group>
  );
}
