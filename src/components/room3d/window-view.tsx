"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ScenePalette } from "./palettes";
import { getOceanWaveNormalMap } from "./textures";

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ViewProps {
  p: ScenePalette;
  night: boolean;
  seed?: number;
}

export function WindowView({ p, night }: ViewProps) {
  return (
    <group>
      {/* atmospheric sky dome / backdrop */}
      <mesh position={[0, 4.0, 16]}>
        <planeGeometry args={[56, 26]} />
        <meshBasicMaterial color={night ? p.skyNight : p.skyDay} />
      </mesh>
      <SunMoon p={p} night={night} />
    </group>
  );
}

function SunMoon({ p, night }: { p: ScenePalette; night: boolean }) {
  return (
    <mesh position={[night ? -3.4 : 3.8, night ? 5.2 : 4.4, 15.4]}>
      <circleGeometry args={[night ? 0.6 : 1.1, 36]} />
      <meshBasicMaterial color={night ? "#f0f4fc" : p.sunDay} />
    </mesh>
  );
}

/**
 * Photorealistic City View:
 * Multi-depth 3D skyline with architectural tiers, glass curtain walls,
 * illuminated nighttime windows, and blinking red aviation beacons.
 */
export function CityView({ p, night, seed = 1 }: ViewProps) {
  const rand = useMemo(() => mulberry32(seed * 131 + 7), [seed]);
  const beaconRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (night && beaconRef.current) {
      const t = clock.elapsedTime;
      // aviation strobe blink
      const blink = (t % 1.4) < 0.12 ? 1 : 0.05;
      beaconRef.current.opacity = blink;
    }
  });

  const towers = useMemo(() => {
    return Array.from({ length: 16 }, (_, i) => {
      const r = rand();
      const x = -13 + i * 1.7 + r * 0.4;
      const w = 1.0 + r * 1.1;
      const h = 2.8 + r * 6.5;
      const z = 7 + rand() * 5;
      const hasSpire = r > 0.45;
      return { x, w, h, z, hasSpire };
    });
  }, [rand]);

  const windowLights = useMemo(() => {
    const lights: Array<{ x: number; y: number; z: number; on: boolean }> = [];
    towers.forEach((t) => {
      const floors = Math.floor(t.h * 4);
      const cols = Math.floor(t.w * 4);
      for (let f = 1; f < floors; f++) {
        for (let c = 0; c < cols; c++) {
          if (rand() > 0.55) {
            lights.push({
              x: t.x - t.w / 2 + (c + 0.5) * (t.w / cols),
              y: f * 0.24 - 0.3,
              z: t.z - 0.49,
              on: rand() > 0.3,
            });
          }
        }
      }
    });
    return lights.slice(0, 180);
  }, [towers, rand]);

  return (
    <group>
      <WindowView p={p} night={night} seed={seed} />

      {/* multi-tier skyscrapers */}
      {towers.map((t, i) => (
        <group key={i} position={[t.x, t.h / 2 - 0.4, t.z]}>
          {/* main tower body */}
          <mesh receiveShadow>
            <boxGeometry args={[t.w, t.h, 1]} />
            <meshStandardMaterial
              color={night ? "#141822" : i % 2 ? "#4f5866" : "#636d7d"}
              roughness={0.7}
              metalness={0.3}
            />
          </mesh>

          {/* stepped crown / setback */}
          <mesh position={[0, t.h / 2 + 0.25, 0]}>
            <boxGeometry args={[t.w * 0.68, 0.5, 0.68]} />
            <meshStandardMaterial
              color={night ? "#10141d" : "#5a6473"}
              roughness={0.7}
            />
          </mesh>

          {/* architectural spire with red aviation beacon */}
          {t.hasSpire && (
            <group position={[0, t.h / 2 + 0.7, 0]}>
              <mesh>
                <cylinderGeometry args={[0.012, 0.035, 0.6, 8]} />
                <meshStandardMaterial color="#8a94a0" metalness={0.8} roughness={0.2} />
              </mesh>
              {night && (
                <mesh position={[0, 0.32, 0]}>
                  <sphereGeometry args={[0.045, 8, 8]} />
                  <meshBasicMaterial
                    ref={beaconRef}
                    color="#ff3333"
                    transparent
                    opacity={1}
                  />
                </mesh>
              )}
            </group>
          )}
        </group>
      ))}

      {/* illuminated nighttime office windows */}
      {night &&
        windowLights.map((l, i) =>
          l.on ? (
            <mesh key={`wl_${i}`} position={[l.x, l.y, l.z]}>
              <planeGeometry args={[0.09, 0.12]} />
              <meshBasicMaterial color={i % 3 === 0 ? "#fff2c6" : "#ffd485"} />
            </mesh>
          ) : null
        )}
    </group>
  );
}

/**
 * Photorealistic Ocean View:
 * Animated specular water plane with animated ripples, shimmering horizon,
 * coastal headlands, and distant sailing yacht.
 */
export function OceanView({ p, night, seed = 1 }: ViewProps) {
  const waterRef = useRef<THREE.Mesh>(null);
  const normalMap = useMemo(() => getOceanWaveNormalMap(), []);

  useFrame(({ clock }) => {
    if (waterRef.current) {
      const t = clock.elapsedTime;
      normalMap.offset.x = (t * 0.018) % 1;
      normalMap.offset.y = (t * 0.012) % 1;
    }
  });

  return (
    <group>
      <WindowView p={p} night={night} seed={seed} />

      {/* animated specular sea surface */}
      <mesh ref={waterRef} position={[0, -0.55, 9]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[56, 15, 32, 32]} />
        <meshStandardMaterial
          color={night ? "#122033" : "#3d7391"}
          roughness={0.22}
          metalness={night ? 0.1 : 0.25}
          normalMap={normalMap}
          normalScale={new THREE.Vector2(0.5, 0.5)}
        />
      </mesh>

      {/* horizon shimmer band */}
      <mesh position={[0, 0.02, 15.2]}>
        <planeGeometry args={[56, 0.08]} />
        <meshBasicMaterial color={night ? "#324b6f" : "#d8edf0"} />
      </mesh>

      {/* distant coastal headland / island silhouette */}
      <mesh position={[8, 0.35, 14.2]} rotation={[0, -0.2, 0]}>
        <coneGeometry args={[4.2, 1.1, 7]} />
        <meshStandardMaterial
          color={night ? "#111822" : "#4a686b"}
          roughness={0.95}
        />
      </mesh>
      <mesh position={[-9.5, 0.25, 14.5]} rotation={[0, 0.3, 0]}>
        <coneGeometry args={[3.6, 0.8, 6]} />
        <meshStandardMaterial
          color={night ? "#101620" : "#435f63"}
          roughness={0.95}
        />
      </mesh>

      {/* luxury sailing yacht */}
      <group position={[-3.8, 0.06, 8.8]} rotation={[0, 0.25, 0]}>
        {/* hull */}
        <mesh>
          <boxGeometry args={[0.7, 0.12, 0.22]} />
          <meshStandardMaterial color="#f8f5ee" roughness={0.3} metalness={0.1} />
        </mesh>
        {/* mast */}
        <mesh position={[0.04, 0.5, 0]}>
          <cylinderGeometry args={[0.008, 0.012, 0.95, 8]} />
          <meshStandardMaterial color="#c0c8d0" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* mainsail */}
        <mesh position={[0.06, 0.48, 0]}>
          <coneGeometry args={[0.32, 0.85, 3]} />
          <meshStandardMaterial color="#ffffff" roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Photorealistic Garden View:
 * Multi-species lush trees with wind sway, manicured lawns,
 * stone walkway, flowering bushes, and architectural landscape lighting.
 */
export function GardenView({ p, night, seed = 1 }: ViewProps) {
  const rand = useMemo(() => mulberry32(seed * 173 + 3), [seed]);

  const trees = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      x: -8.8 + i * 2.5 + rand() * 1.1,
      s: 0.85 + rand() * 0.65,
      z: 5.0 + rand() * 2.6,
      type: rand() > 0.4 ? "deciduous" : "cypress",
    }));
  }, [rand]);

  return (
    <group>
      <WindowView p={p} night={night} seed={seed} />

      {/* manicured lawn */}
      <mesh position={[0, -0.52, 7.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[56, 12]} />
        <meshStandardMaterial
          color={night ? "#1c2b1a" : "#6c8e49"}
          roughness={0.96}
        />
      </mesh>

      {/* trees & foliage */}
      {trees.map((t, i) => (
        <group key={i} position={[t.x, -0.5, t.z]} scale={t.s}>
          {/* trunk */}
          <mesh position={[0, 0.75, 0]}>
            <cylinderGeometry args={[0.08, 0.14, 1.5, 10]} />
            <meshStandardMaterial color="#543a23" roughness={1} />
          </mesh>

          {/* layered foliage */}
          {[0, 1, 2].map((j) => (
            <mesh
              key={j}
              position={[(j - 1) * 0.28, 1.7 + j * 0.32, j * 0.12 - 0.08]}
            >
              <icosahedronGeometry args={[0.68 - j * 0.08, 1]} />
              <meshStandardMaterial
                color={night ? "#21321f" : j % 2 ? "#4f7244" : "#5e8552"}
                roughness={0.88}
              />
            </mesh>
          ))}

          {/* landscape uplight for night */}
          {night && i % 2 === 0 && (
            <pointLight
              position={[0.2, 0.2, 0.2]}
              intensity={1.8}
              distance={2.8}
              decay={2}
              color="#d4e8b8"
            />
          )}
        </group>
      ))}

      {/* curving natural stone flagstone path */}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh
          key={`path_${i}`}
          position={[0.35 + Math.sin(i * 0.9) * 0.6, -0.49, 4.4 + i * 0.75]}
          rotation={[-Math.PI / 2, 0, i * 0.4]}
        >
          <circleGeometry args={[0.32, 9]} />
          <meshStandardMaterial
            color={night ? "#2a2a26" : "#b8ac97"}
            roughness={0.92}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Photorealistic Mountain / Alps View:
 * Dramatic alpine peaks with craggy snowcaps, tiered evergreen pine forests,
 * and atmospheric valley mist.
 */
export function MountainView({ p, night, seed = 1 }: ViewProps) {
  const rand = useMemo(() => mulberry32(seed * 211 + 11), [seed]);

  const peaks = [
    { x: -5.2, h: 8.5, r: 5.2, z: 12.0 },
    { x: 1.6, h: 9.8, r: 5.8, z: 13.5 },
    { x: 7.4, h: 7.6, r: 4.6, z: 11.8 },
    { x: -9.8, h: 6.8, r: 4.2, z: 12.8 },
  ];

  const pines = useMemo(() => {
    return Array.from({ length: 11 }, (_, i) => ({
      x: -8.5 + i * 1.8 + rand() * 0.8,
      s: 0.75 + rand() * 0.65,
      z: 5.5 + rand() * 2.2,
    }));
  }, [rand]);

  return (
    <group>
      <WindowView p={p} night={night} seed={seed} />

      {/* valley floor */}
      <mesh position={[0, -0.6, 9]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[56, 14]} />
        <meshStandardMaterial
          color={night ? "#18241e" : "#7c9a78"}
          roughness={0.98}
        />
      </mesh>

      {/* alpine mountain peaks */}
      {peaks.map((m, i) => (
        <group key={i} position={[m.x, 0, m.z]}>
          {/* rocky lower mountain body */}
          <mesh position={[0, m.h / 2 - 1.2, 0]}>
            <coneGeometry args={[m.r, m.h, 7]} />
            <meshStandardMaterial
              color={night ? "#1c2430" : "#6c7d8e"}
              flatShading
              roughness={0.92}
            />
          </mesh>

          {/* jagged snowcap */}
          <mesh position={[0, m.h - 1.2 - m.h * 0.2, 0]}>
            <coneGeometry args={[m.r * 0.38, m.h * 0.4, 7]} />
            <meshStandardMaterial
              color={night ? "#d4dfea" : "#f5f9fc"}
              flatShading
              roughness={0.65}
            />
          </mesh>
        </group>
      ))}

      {/* dense tiered evergreen pine forest */}
      {pines.map((t, i) => (
        <group key={`pine_${i}`} position={[t.x, -0.55, t.z]} scale={t.s}>
          {/* trunk */}
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.04, 0.06, 0.5, 6]} />
            <meshStandardMaterial color="#382618" roughness={1} />
          </mesh>
          {/* tiered pine cones */}
          <mesh position={[0, 0.65, 0]}>
            <coneGeometry args={[0.48, 1.2, 8]} />
            <meshStandardMaterial
              color={night ? "#16241b" : "#324d36"}
              flatShading
              roughness={0.95}
            />
          </mesh>
          <mesh position={[0, 1.35, 0]}>
            <coneGeometry args={[0.34, 0.9, 8]} />
            <meshStandardMaterial
              color={night ? "#1a2c20" : "#3c5c41"}
              flatShading
              roughness={0.95}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// AlpsView alias for backward compatibility
export const AlpsView = MountainView;
