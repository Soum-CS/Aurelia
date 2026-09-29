"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ViewPose, WALK_START } from "./scene";

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export interface WalkInput {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
}

export function makeWalkInput(): WalkInput {
  return { forward: false, back: false, left: false, right: false };
}

function quatLookingAt(pos: THREE.Vector3, target: THREE.Vector3): THREE.Quaternion {
  const m = new THREE.Matrix4().lookAt(pos, target, new THREE.Vector3(0, 1, 0));
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

export interface CinematicPreset {
  id: "hero" | "bed" | "bathroom" | "window" | "workspace";
  label: string;
  icon: string;
  pose: ViewPose;
}

export const CINEMATIC_PRESETS: CinematicPreset[] = [
  {
    id: "hero",
    label: "Hero view",
    icon: "🏠",
    pose: { pos: [4.8, 2.9, 5.2], target: [0, 0.9, -0.1], fov: 56 },
  },
  {
    id: "bed",
    label: "The bed",
    icon: "🛏️",
    pose: { pos: [1.6, 1.45, 0.6], target: [-0.35, 0.7, -0.9], fov: 42 },
  },
  {
    id: "bathroom",
    label: "Bathroom & tub",
    icon: "🛁",
    pose: { pos: [0.6, 1.5, 0.3], target: [2.1, 0.65, 1.25], fov: 48 },
  },
  {
    id: "window",
    label: "Window view",
    icon: "🪟",
    pose: { pos: [-0.4, 1.55, 0.2], target: [0.1, 1.6, 2.4], fov: 44 },
  },
  {
    id: "workspace",
    label: "Workspace",
    icon: "💼",
    pose: { pos: [-1.0, 1.45, 1.9], target: [-2.4, 0.8, 0.85], fov: 46 },
  },
];

/**
 * Eases the orbit camera between framings — a photographer repositioning,
 * never a teleport. Disables user input while gliding.
 * Respects prefers-reduced-motion for instant cut.
 * Smoothly interpolates camera lens FOV for authentic cinematic framing.
 */
export function OrbitDirector({
  controls,
  goal,
  active,
}: {
  controls: React.RefObject<OrbitControlsImpl | null>;
  goal: { pose: ViewPose; key: number } | null;
  active: boolean;
}) {
  const { camera } = useThree();
  const tween = useRef<{
    fromPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toPos: THREE.Vector3;
    toTarget: THREE.Vector3;
    fromFov: number;
    toFov: number;
    start: number;
    dur: number;
  } | null>(null);
  const elapsed = useRef(0);

  useEffect(() => {
    if (!goal || !active) return;
    const c = controls.current;
    if (!c) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const perspCamera = camera as THREE.PerspectiveCamera;
    const targetFov = goal.pose.fov ?? 55;

    if (reducedMotion) {
      camera.position.set(...goal.pose.pos);
      c.target.set(...goal.pose.target);
      if (perspCamera.isPerspectiveCamera && perspCamera.fov !== targetFov) {
        perspCamera.fov = targetFov;
        perspCamera.updateProjectionMatrix();
      }
      c.update();
      return;
    }

    tween.current = {
      fromPos: camera.position.clone(),
      fromTarget: c.target.clone(),
      toPos: new THREE.Vector3(...goal.pose.pos),
      toTarget: new THREE.Vector3(...goal.pose.target),
      fromFov: perspCamera.isPerspectiveCamera ? perspCamera.fov : 55,
      toFov: targetFov,
      start: 0,
      dur: 1.35,
    };
    elapsed.current = 0;
    c.enabled = false;
  }, [goal, active, camera, controls]);

  // drop any in-flight glide when leaving orbit mode
  useEffect(() => {
    if (!active) tween.current = null;
  }, [active]);

  useFrame((_, delta) => {
    if (!active) return;
    const tw = tween.current;
    const c = controls.current;
    if (!tw || !c) return;
    elapsed.current += delta;
    const k = Math.min(elapsed.current / tw.dur, 1);
    const e = easeInOutCubic(k);
    camera.position.lerpVectors(tw.fromPos, tw.toPos, e);
    c.target.lerpVectors(tw.fromTarget, tw.toTarget, e);

    const perspCamera = camera as THREE.PerspectiveCamera;
    if (perspCamera.isPerspectiveCamera && tw.fromFov !== tw.toFov) {
      perspCamera.fov = THREE.MathUtils.lerp(tw.fromFov, tw.toFov, e);
      perspCamera.updateProjectionMatrix();
    }

    c.update();
    if (k >= 1) {
      tween.current = null;
      if (active) c.enabled = true;
    }
  });

  return null;
}

/**
 * First-person walkthrough at eye height: drag to look, WASD/arrows to glide,
 * soft collisions against walls and furniture, damped settle on release.
 */
export function WalkMode({
  active,
  controls,
  colliders,
  input,
}: {
  active: boolean;
  controls: React.RefObject<OrbitControlsImpl | null>;
  colliders: Array<{ min: [number, number]; max: [number, number] }>;
  input: React.RefObject<WalkInput>;
}) {
  const { camera, gl } = useThree();
  const phase = useRef<"idle" | "enter" | "live" | "exit">("idle");
  const trans = useRef({
    t: 0,
    dur: 1.1,
    fromPos: new THREE.Vector3(),
    fromQuat: new THREE.Quaternion(),
    toPos: new THREE.Vector3(),
    toQuat: new THREE.Quaternion(),
    savedPos: new THREE.Vector3(),
    savedTarget: new THREE.Vector3(),
  });
  const yaw = useRef(WALK_START.yaw);
  const pitch = useRef(WALK_START.pitch);
  const yawCur = useRef(WALK_START.yaw);
  const pitchCur = useRef(WALK_START.pitch);
  const vel = useRef(new THREE.Vector3());
  const look = useRef({ dragging: false, x: 0, y: 0 });
  const wasActive = useRef(false);
  const bobTimer = useRef(0);

  // enter / exit transitions
  useEffect(() => {
    const c = controls.current;
    if (active && !wasActive.current) {
      wasActive.current = true;
      if (!c) return;
      trans.current.savedTarget.copy(c.target);
      trans.current.savedPos.copy(camera.position);
      trans.current.fromPos.copy(camera.position);
      trans.current.fromQuat.copy(camera.quaternion);
      trans.current.toPos.set(...WALK_START.pos);
      trans.current.toQuat = quatLookingAt(
        trans.current.toPos,
        new THREE.Vector3(-0.5, 1.45, -0.6)
      );
      trans.current.t = 0;
      phase.current = "enter";
      c.enabled = false;
    } else if (!active && wasActive.current) {
      wasActive.current = false;
      if (!c) return;
      trans.current.fromPos.copy(camera.position);
      trans.current.fromQuat.copy(camera.quaternion);
      // glide back to the exact viewpoint the user left from
      trans.current.toPos.copy(trans.current.savedPos);
      trans.current.toQuat = quatLookingAt(trans.current.toPos, trans.current.savedTarget);
      trans.current.t = 0;
      phase.current = "exit";
    }
  }, [active, camera, controls]);

  // keyboard
  useEffect(() => {
    if (!active) return;
    const setKey = (e: KeyboardEvent, v: boolean) => {
      const i = input.current;
      if (!i) return true;
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          i.forward = v;
          break;
        case "KeyS":
        case "ArrowDown":
          i.back = v;
          break;
        case "KeyA":
        case "ArrowLeft":
          i.left = v;
          break;
        case "KeyD":
        case "ArrowRight":
          i.right = v;
          break;
        default:
          return true;
      }
      e.preventDefault();
      return false;
    };
    const down = (e: KeyboardEvent) => setKey(e, true);
    const up = (e: KeyboardEvent) => setKey(e, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [active, input]);

  // drag-to-look (grab-the-world, like a street view)
  useEffect(() => {
    if (!active) return;
    const el = gl.domElement;
    const down = (e: PointerEvent) => {
      look.current.dragging = true;
      look.current.x = e.clientX;
      look.current.y = e.clientY;
    };
    const move = (e: PointerEvent) => {
      if (!look.current.dragging) return;
      const dx = e.clientX - look.current.x;
      const dy = e.clientY - look.current.y;
      look.current.x = e.clientX;
      look.current.y = e.clientY;
      yaw.current += dx * 0.0032;
      pitch.current = Math.max(-1.05, Math.min(1.05, pitch.current + dy * 0.0026));
    };
    const up = () => {
      look.current.dragging = false;
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [active, gl]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const tr = trans.current;

    if (phase.current === "enter" || phase.current === "exit") {
      tr.t += delta / tr.dur;
      const e = easeInOutCubic(Math.min(tr.t, 1));
      camera.position.lerpVectors(tr.fromPos, tr.toPos, e);
      camera.quaternion.slerpQuaternions(tr.fromQuat, tr.toQuat, e);
      if (tr.t >= 1) {
        if (phase.current === "enter") {
          phase.current = "live";
          vel.current.set(0, 0, 0);
        } else {
          phase.current = "idle";
          const c = controls.current;
          if (c) {
            c.target.copy(tr.savedTarget);
            c.enabled = true;
            c.update();
          }
        }
      }
      return;
    }

    if (phase.current !== "live") return;

    // damped look
    const lk = 1 - Math.exp(-14 * delta);
    yawCur.current += (yaw.current - yawCur.current) * lk;
    pitchCur.current += (pitch.current - pitchCur.current) * lk;
    camera.rotation.set(pitchCur.current, yawCur.current, 0, "YXZ");

    // damped glide with settle
    const i = input.current;
    let f = 0;
    let s = 0;
    if (i?.forward) f += 1;
    if (i?.back) f -= 1;
    if (i?.right) s += 1;
    if (i?.left) s -= 1;
    const sinY = Math.sin(yawCur.current);
    const cosY = Math.cos(yawCur.current);
    // forward = (-sinYaw, -cosYaw), right = (cosYaw, -sinYaw)
    const ax = (-sinY * f + cosY * s) * 7.5;
    const az = (-cosY * f - sinY * s) * 7.5;
    vel.current.x += ax * delta;
    vel.current.z += az * delta;
    const damp = Math.exp(-5.2 * delta);
    vel.current.x *= damp;
    vel.current.z *= damp;
    const sp = Math.hypot(vel.current.x, vel.current.z);
    const maxSp = 1.25;
    if (sp > maxSp) {
      vel.current.x *= maxSp / sp;
      vel.current.z *= maxSp / sp;
    }
    camera.position.x += vel.current.x * delta;
    camera.position.z += vel.current.z * delta;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (sp > 0.08 && !reducedMotion) {
      bobTimer.current += delta * 8.5;
      camera.position.y = WALK_START.pos[1] + Math.sin(bobTimer.current) * 0.016;
    } else {
      camera.position.y = THREE.MathUtils.lerp(
        camera.position.y,
        WALK_START.pos[1],
        1 - Math.exp(-8 * delta)
      );
    }

    // soft collision: walls first, then furniture boxes
    const r = 0.26;
    const px = Math.max(-2.68 + r, Math.min(2.68 - r, camera.position.x));
    const pz = Math.max(-1.9 + r, Math.min(1.92 - r, camera.position.z));
    camera.position.x = px;
    camera.position.z = pz;
    for (const b of colliders) {
      const minX = b.min[0] - r;
      const maxX = b.max[0] + r;
      const minZ = b.min[1] - r;
      const maxZ = b.max[1] + r;
      if (px > minX && px < maxX && pz > minZ && pz < maxZ) {
        const dl = px - minX;
        const dr = maxX - px;
        const dn = pz - minZ;
        const df = maxZ - pz;
        const m = Math.min(dl, dr, dn, df);
        if (m === dl) {
          camera.position.x = minX;
          vel.current.x = Math.min(vel.current.x, 0);
        } else if (m === dr) {
          camera.position.x = maxX;
          vel.current.x = Math.max(vel.current.x, 0);
        } else if (m === dn) {
          camera.position.z = minZ;
          vel.current.z = Math.min(vel.current.z, 0);
        } else {
          camera.position.z = maxZ;
          vel.current.z = Math.max(vel.current.z, 0);
        }
      }
    }
    camera.position.y = WALK_START.pos[1];
  });

  return null;
}
