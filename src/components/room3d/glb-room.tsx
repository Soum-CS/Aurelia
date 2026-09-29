"use client";

import { useMemo, useEffect, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { SceneConfig } from "@/lib/types";
import { PALETTES, ScenePalette } from "./palettes";
import {
  createFabricMaterial,
  createGlassMaterial,
  createMarbleMaterial,
  createChromeMaterial,
  createBrassMaterial,
  createWoodMaterial,
  createPlasterWallMaterial,
} from "./materials";

// Preload default hero room and penthouse models with Draco decoders in /draco/
if (typeof window !== "undefined") {
  try {
    useGLTF.preload("/models/rooms/hero-room.glb", "/draco/");
    useGLTF.preload("/models/rooms/penthouse-suite.glb", "/draco/");
  } catch {
    // Ignore in SSR
  }
}

interface GLBRoomProps {
  modelUrl?: string;
  config: SceneConfig;
  night: boolean;
  onLoaded?: () => void;
}

export function GLBRoom({ modelUrl = "/models/rooms/hero-room.glb", config, night, onLoaded }: GLBRoomProps) {
  // Load GLB with Draco decoder configured to use local /draco/ folder
  const gltf = useGLTF(modelUrl, "/draco/");
  const p: ScenePalette = PALETTES[config.palette];
  const clonedScene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!loadedRef.current && onLoaded) {
      loadedRef.current = true;
      onLoaded();
    }
  }, [onLoaded]);

  // Upgrade materials on the cloned GLTF hierarchy
  useMemo(() => {
    const fabricDuvetMat = createFabricMaterial({
      color: p.textile,
      sheenColor: "#fff8ea",
      sheenIntensity: 0.65,
      sheenRoughness: 0.45,
    });
    const fabricVelvetMat = createFabricMaterial({
      color: p.textileDark,
      sheenColor: "#ffe6cc",
      sheenIntensity: 0.8,
      sheenRoughness: 0.35,
    });
    const fabricThrowMat = createFabricMaterial({
      color: p.textileDark,
      sheenIntensity: 0.7,
    });
    const fabricLinenMat = createFabricMaterial({
      color: "#f8f5ee",
      sheenIntensity: 0.4,
      roughness: 0.92,
    });
    const woodWalnutMat = createWoodMaterial(p.wood, 0.62);
    const woodOakMat = createWoodMaterial(p.wood, 0.58);
    const brassMat = createBrassMaterial(p.metal);
    const chromeMat = createChromeMaterial("#f4f7fb");
    const glassClearMat = createGlassMaterial();
    const marbleMat = createMarbleMaterial();
    const wallTrimMat = new THREE.MeshStandardMaterial({
      color: p.wallTrim,
      roughness: 0.72,
    });
    const plasterMat = createPlasterWallMaterial(p.wall);
    const rugMat = createFabricMaterial({
      color: p.rug,
      sheenIntensity: 0.3,
      roughness: 0.98,
    });

    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        // Apply material upgrades based on material name or mesh name
        const mat = child.material as THREE.MeshStandardMaterial | undefined;
        const matName = mat?.name ?? "";
        const meshName = child.name.toLowerCase();

        if (matName.includes("fabric_duvet") || meshName.includes("duvet")) {
          child.material = fabricDuvetMat;
        } else if (matName.includes("fabric_velvet")) {
          child.material = fabricVelvetMat;
        } else if (matName.includes("fabric_throw")) {
          child.material = fabricThrowMat;
        } else if (matName.includes("fabric_linen") || meshName.includes("pillow") || meshName.includes("mattress")) {
          child.material = fabricLinenMat;
        } else if (matName.includes("fabric_rug") || meshName.includes("rug")) {
          child.material = rugMat;
        } else if (matName.includes("wood_walnut") || meshName.includes("headboard") || meshName.includes("frame")) {
          child.material = woodWalnutMat;
        } else if (matName.includes("wood_oak") || meshName.includes("desk")) {
          child.material = woodOakMat;
        } else if (matName.includes("metal_brass") || meshName.includes("brass") || meshName.includes("handle")) {
          child.material = brassMat;
        } else if (matName.includes("metal_chrome") || meshName.includes("faucet") || meshName.includes("chrome")) {
          child.material = chromeMat;
        } else if (matName.includes("glass_clear") || meshName.includes("glass") || meshName.includes("water") || meshName.includes("carafe")) {
          child.material = glassClearMat;
          child.castShadow = false;
        } else if (matName.includes("marble") || meshName.includes("marble")) {
          child.material = marbleMat;
        } else if (matName.includes("wall_trim")) {
          child.material = wallTrimMat;
        } else if (matName.includes("plaster_wall")) {
          child.material = plasterMat;
        }
      }

      // Filter extras based on SceneConfig.extras
      const n = child.name.toLowerCase();
      if (n.includes("workspace") || n === "desk") {
        child.visible = config.extras.includes("desk");
      }
      if (n.includes("sofa") || n.includes("lounge")) {
        child.visible = config.extras.includes("sofa") || config.extras.includes("lounge");
      }
      if (n.includes("bathtub") || n.includes("vanitymirror")) {
        child.visible = config.extras.includes("bathtub");
      }
    });
  }, [clonedScene, p, config.extras]);

  return <primitive object={clonedScene} />;
}
