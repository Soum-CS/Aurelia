"use client";

import * as THREE from "three";
import { getFabricNormalMap, getMarbleMaps, getPlasterNormalMap, getPlasterRough, getWeaveBump } from "./textures";
import { ScenePalette } from "./palettes";

/**
 * Photorealistic PBR material factories for Aurelia 3D room engine.
 * Calibrated for physical accuracy under HDRI & directional sunlight.
 */

export function createFabricMaterial(options: {
  color: string;
  sheenColor?: string;
  sheenIntensity?: number;
  sheenRoughness?: number;
  bumpScale?: number;
  roughness?: number;
}): THREE.MeshPhysicalMaterial {
  const normalMap = getFabricNormalMap();
  const bump = getWeaveBump();
  return new THREE.MeshPhysicalMaterial({
    color: options.color,
    roughness: options.roughness ?? 0.95,
    metalness: 0.0,
    normalMap,
    normalScale: new THREE.Vector2(0.4, 0.4),
    bumpMap: bump,
    bumpScale: options.bumpScale ?? 0.35,
    sheen: options.sheenIntensity ?? 0.75,
    sheenRoughness: options.sheenRoughness ?? 0.45,
    sheenColor: new THREE.Color(options.sheenColor ?? "#fff5e6"),
  });
}

export function createGlassMaterial(options?: {
  opacity?: number;
  roughness?: number;
  transmission?: number;
  ior?: number;
  thickness?: number;
}): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: options?.opacity ?? 0.1,
    roughness: options?.roughness ?? 0.02,
    metalness: 0.0,
    transmission: options?.transmission ?? 0.96,
    ior: options?.ior ?? 1.52,
    thickness: options?.thickness ?? 0.08,
    envMapIntensity: 1.6,
    reflectivity: 0.5,
  });
}

export function createMarbleMaterial(baseHex = "#f5f4f0", veinHex = "#8f8b84"): THREE.MeshPhysicalMaterial {
  const maps = getMarbleMaps(baseHex, veinHex);
  return new THREE.MeshPhysicalMaterial({
    map: maps.map,
    roughnessMap: maps.roughnessMap,
    normalMap: maps.normalMap,
    roughness: 0.14,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.5,
  });
}

export function createChromeMaterial(tint = "#ffffff"): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: tint,
    metalness: 0.98,
    roughness: 0.05,
    envMapIntensity: 2.0,
  });
}

export function createBrassMaterial(color = "#c8a65c"): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.88,
    roughness: 0.22,
    envMapIntensity: 1.6,
  });
}

export function createPlasterWallMaterial(wallColor: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: wallColor,
    roughness: 0.92,
    roughnessMap: getPlasterRough(),
    normalMap: getPlasterNormalMap(),
    normalScale: new THREE.Vector2(0.25, 0.25),
    metalness: 0.01,
  });
}

export function createWoodMaterial(woodColor: string, roughness = 0.65): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: woodColor,
    roughness,
    metalness: 0.04,
    bumpMap: getWeaveBump(),
    bumpScale: 0.12,
    envMapIntensity: 0.8,
  });
}
