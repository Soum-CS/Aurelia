"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, DepthOfField, Vignette, Bloom, N8AO, ToneMapping } from "@react-three/postprocessing";
import { useEffect, useRef, useState } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { LightingPreset, QualityLevel, parseScene } from "@/lib/types";
import { getColliders, getHotspots, HOME_POSE, RoomScene, ViewPose } from "./scene";
import { Hotspot } from "./hotspot";
import { CINEMATIC_PRESETS, OrbitDirector, WalkMode, makeWalkInput } from "./camera-rig";
import { VIEW_COPY } from "./palettes";
import { soundscape } from "./soundscape";

export interface ExplorerMeta {
  roomName: string;
  hotelName: string;
  bedType: string;
  viewLabel: string;
  capacity: number;
  sizeSqm: number;
  artSeed: number;
}

function hotspotBody(id: string, meta: ExplorerMeta): { title: string; text: string } {
  switch (id) {
    case "bed":
      return {
        title: meta.bedType,
        text: "Custom upholstered headboard with vertical fluting, layered Italian cotton linens, tailored duvet, and plush sleeping pillows.",
      };
    case "view":
      return {
        title: `View · ${meta.viewLabel}`,
        text: `From the floor-to-ceiling panoramic window you will see ${VIEW_COPY[meta.viewLabel.toLowerCase()] ?? "the surrounding scenery"}.`,
      };
    case "light":
      return {
        title: "Atmospheric lighting",
        text: "Calibrated 2700K warm practical lighting, recessed architectural ceiling cove, and blackout drapes.",
      };
    case "desk":
      return { title: "Executive Workspace", text: "Solid oak cantilevered desk, ergonomic designer chair, leather blotter, and focused task illumination." };
    case "sofa":
      return { title: "Lounge Seating", text: "Deep-seated curved bouclé sofa with tailored cushions and a sculptural marble coffee table." };
    case "lounge":
      return { title: "Reading Chair", text: "Corner armchair with brushed metal accents and soft reading lighting." };
    case "bathtub":
      return { title: "Soaking Tub & En-suite", text: "Freestanding oval soaking tub with floor-mounted chrome gooseneck filler and vanity mirror." };
    case "fireplace":
      return { title: "Fireplace", text: "Natural fireplace laid and lit at turndown with glowing warm ember illumination." };
    default:
      return { title: "Detail", text: "" };
  }
}

type Mode = "orbit" | "walk";

export default function RoomExplorer({
  sceneJson,
  meta,
}: {
  sceneJson: string;
  meta: ExplorerMeta;
}) {
  const config = parseScene(sceneJson);
  const [timeOfDay, setTimeOfDay] = useState<LightingPreset>(config.lightingPreset ?? "day");
  const [quality, setQuality] = useState<QualityLevel>(config.quality ?? "balanced");
  const [mode, setMode] = useState<Mode>("orbit");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string>("hero");
  const [goal, setGoal] = useState<{ pose: ViewPose; key: number } | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  const [curtainsClosed, setCurtainsClosed] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [practicalLampsOn, setPracticalLampsOn] = useState(config.lightingPreset === "night");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const controlsRef = useRef<OrbitControlsImpl>(null);
  const inputRef = useRef(makeWalkInput());
  const hotspots = getHotspots(config);
  const colliders = getColliders(config);

  // Auto-detect mobile devices or reduced motion
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isSmall = window.matchMedia("(max-width: 767px)").matches;
    setReducedMotion(reduced);
    if (isSmall && !config.quality) {
      setQuality("mobile");
    }
  }, [config.quality]);

  // Sync ambient soundscape when view or day/night changes
  useEffect(() => {
    if (soundOn && soundscape) {
      soundscape.updateView(config.windowView, timeOfDay === "night");
    }
  }, [soundOn, timeOfDay, config.windowView]);

  // Cleanup audio nodes on unmount
  useEffect(() => {
    return () => {
      soundscape?.stop();
    };
  }, []);

  // Listen for fullscreen change events (e.g. user pressing Esc)
  useEffect(() => {
    const handleFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFs);
    return () => document.removeEventListener("fullscreenchange", handleFs);
  }, []);

  const changeTimeOfDay = (preset: LightingPreset) => {
    setTimeOfDay(preset);
    if (preset === "night") {
      setPracticalLampsOn(true);
    }
  };

  const toggleSound = () => {
    if (!soundscape) return;
    const isPlaying = soundscape.toggle(config.windowView, timeOfDay === "night");
    setSoundOn(isPlaying);
  };

  const toggleCurtains = () => {
    setCurtainsClosed((c) => !c);
  };

  const toggleLamps = () => {
    setPracticalLampsOn((l) => !l);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Fullscreen not supported or blocked
    }
  };

  const frameHotspot = (id: string) => {
    if (mode !== "orbit") return;
    const spot = hotspots.find((h) => h.id === id);
    if (!spot) return;
    setActiveId(id);
    setActivePreset("");
    setGoal((g) => ({ pose: spot.cam, key: (g?.key ?? 0) + 1 }));
  };

  const applyPreset = (id: string, pose: ViewPose) => {
    if (mode !== "orbit") return;
    setActiveId(null);
    setActivePreset(id);
    setGoal((g) => ({ pose, key: (g?.key ?? 0) + 1 }));
  };

  const closeHotspot = () => setActiveId(null);

  const resetView = () => {
    if (mode !== "orbit") return;
    setActiveId(null);
    setActivePreset("hero");
    setGoal((g) => ({ pose: HOME_POSE, key: (g?.key ?? 0) + 1 }));
  };

  const enterWalk = () => {
    setActiveId(null);
    setMode("walk");
  };

  const exitWalk = () => setMode("orbit");

  const holdInput = (key: keyof ReturnType<typeof makeWalkInput>, v: boolean) => () => {
    inputRef.current[key] = v;
  };

  const dprRange: [number, number] =
    quality === "cinematic"
      ? [1, 2]
      : quality === "high"
      ? [1, 1.75]
      : quality === "balanced"
      ? [1, 1.5]
      : [1, 1];

  const night = timeOfDay === "night";

  return (
    <div
      ref={containerRef}
      className={`card overflow-hidden p-0 transition-all ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none h-screen w-screen bg-black" : ""
      }`}
    >
      <div className={`relative w-full ${isFullscreen ? "h-screen" : "aspect-[4/3] sm:aspect-[16/10]"}`}>
        <Canvas
          shadows={quality !== "mobile"}
          dpr={dprRange}
          camera={{ position: HOME_POSE.pos, fov: 55 }}
          aria-label={`Interactive 3D model of ${meta.roomName} at ${meta.hotelName}. ${
            mode === "walk"
              ? "Drag to look around, WASD or arrow keys to move."
              : "Drag to orbit, scroll to zoom."
          }`}
          role="application"
        >
          <RoomScene
            config={config}
            night={night}
            timeOfDay={timeOfDay}
            quality={quality}
            artSeed={meta.artSeed}
            curtainsClosed={curtainsClosed}
            practicalLampsOn={practicalLampsOn}
          />

          {mode === "orbit" &&
            hotspots.map((h) => (
              <Hotspot
                key={h.id}
                position={h.position}
                label={h.label}
                active={activeId === h.id}
                onSelect={() => frameHotspot(h.id)}
              />
            ))}

          <OrbitControls
            ref={controlsRef}
            makeDefault
            target={HOME_POSE.target}
            minDistance={2.0}
            maxDistance={12}
            maxPolarAngle={1.52}
            enableDamping
            dampingFactor={0.06}
            zoomSpeed={0.7}
            rotateSpeed={0.75}
          />
          <OrbitDirector controls={controlsRef} goal={goal} active={mode === "orbit"} />
          <WalkMode active={mode === "walk"} controls={controlsRef} colliders={colliders} input={inputRef} />

          {/* postprocessing stack calibrated by quality tier */}
          {quality !== "mobile" && !reducedMotion && (
            <EffectComposer multisampling={quality === "cinematic" ? 8 : 4}>
              {/* N8AO Screen-Space Ambient Occlusion on High/Cinematic */}
              {(quality === "high" || quality === "cinematic") && (
                <N8AO
                  halfRes={quality !== "cinematic"}
                  aoRadius={1.2}
                  distanceFalloff={2.4}
                  intensity={1.5}
                />
              )}
              {/* Soft bloom on practical lights and sun reflections */}
              <Bloom
                luminanceThreshold={0.88}
                luminanceSmoothing={0.4}
                intensity={quality === "cinematic" ? 0.65 : 0.45}
              />
              {/* Subtle cinematic Depth of Field */}
              {(quality === "high" || quality === "cinematic") && (
                <DepthOfField
                  target={[-0.35, 0.62, -0.9]}
                  worldFocusRange={3.4}
                  focalLength={0.035}
                  bokehScale={quality === "cinematic" ? 2.0 : 1.5}
                />
              )}
              <Vignette offset={0.24} darkness={0.34} />
              {quality === "cinematic" && <ToneMapping />}
            </EffectComposer>
          )}
        </Canvas>

        {/* top-left status chip & quality indicator */}
        <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap items-center gap-2">
          <span
            className="rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-medium tracking-wide text-white backdrop-blur-md"
            role="status"
          >
            {mode === "walk"
              ? "Walkthrough · drag to look · WASD / arrows to move"
              : "Interactive 3D · drag to orbit"}
          </span>
          <span className="rounded-full border border-white/20 bg-black/40 px-2.5 py-1 text-[10px] font-semibold tracking-wider text-white/90 uppercase backdrop-blur-md">
            {quality} quality
          </span>
        </div>

        {/* top-right quality & lighting options */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {/* Quality dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowQualityMenu((v) => !v)}
              aria-label="Select graphics quality"
              aria-expanded={showQualityMenu}
              className="flex items-center gap-1.5 rounded-full border border-line bg-raised/90 px-3 py-1.5 text-xs font-semibold shadow-md backdrop-blur-md transition-colors hover:bg-background"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span className="capitalize">{quality}</span>
              <span className="text-[9px] opacity-60">▾</span>
            </button>

            {showQualityMenu && (
              <div className="absolute right-0 mt-1.5 w-36 rounded-xl border border-line bg-raised/95 p-1 shadow-xl backdrop-blur-md z-30">
                {(["mobile", "balanced", "high", "cinematic"] as QualityLevel[]).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setQuality(q);
                      setShowQualityMenu(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-medium capitalize transition-colors ${
                      quality === q ? "bg-accent text-on-accent font-semibold" : "hover:bg-background"
                    }`}
                  >
                    <span>{q}</span>
                    {quality === q && <span>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fullscreen toggle button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen view"}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-raised/90 text-xs font-semibold shadow-md backdrop-blur-md transition-colors hover:bg-background"
          >
            {isFullscreen ? (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            )}
          </button>
        </div>

        {/* walkthrough mobile touch d-pad */}
        {mode === "walk" && (
          <div className="absolute bottom-16 left-3 grid grid-cols-3 gap-1 sm:hidden z-20" aria-hidden>
            <span />
            <button type="button" tabIndex={-1} className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/50 text-white backdrop-blur-sm" onPointerDown={holdInput("forward", true)} onPointerUp={holdInput("forward", false)} onPointerLeave={holdInput("forward", false)}>▲</button>
            <span />
            <button type="button" tabIndex={-1} className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/50 text-white backdrop-blur-sm" onPointerDown={holdInput("left", true)} onPointerUp={holdInput("left", false)} onPointerLeave={holdInput("left", false)}>◀</button>
            <button type="button" tabIndex={-1} className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/50 text-white backdrop-blur-sm" onPointerDown={holdInput("back", true)} onPointerUp={holdInput("back", false)} onPointerLeave={holdInput("back", false)}>▼</button>
            <button type="button" tabIndex={-1} className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/50 text-white backdrop-blur-sm" onPointerDown={holdInput("right", true)} onPointerUp={holdInput("right", false)} onPointerLeave={holdInput("right", false)}>▶</button>
          </div>
        )}

        {/* active hotspot card */}
        {activeId && (
          <div className="animate-fade-up absolute bottom-[4.8rem] left-3 right-3 max-w-sm rounded-2xl border border-line bg-raised/95 p-4 shadow-xl backdrop-blur-md sm:right-auto z-20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">In this room</p>
                <h4 className="font-display mt-1 text-lg font-semibold">
                  {hotspotBody(activeId, meta).title}
                </h4>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                  {hotspotBody(activeId, meta).text}
                </p>
              </div>
              <button
                type="button"
                onClick={closeHotspot}
                aria-label="Close details"
                className="focus-visible:outline-accent -mt-1 -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-background focus-visible:outline-2"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* bottom navigation & lighting control bar */}
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-line bg-raised/90 p-1 shadow-lg backdrop-blur-md max-w-[95%] overflow-x-auto z-20">
          {/* view mode */}
          <div className="flex items-center gap-0.5 rounded-full p-0.5" style={{ background: "var(--background)" }} role="group" aria-label="View mode">
            <button
              type="button"
              onClick={exitWalk}
              aria-pressed={mode === "orbit"}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                mode === "orbit" ? "" : "hover:bg-raised"
              }`}
              style={mode === "orbit" ? { background: "var(--accent)", color: "var(--on-accent)" } : undefined}
            >
              Orbit
            </button>
            <button
              type="button"
              onClick={enterWalk}
              aria-pressed={mode === "walk"}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                mode === "walk" ? "" : "hover:bg-raised"
              }`}
              style={mode === "walk" ? { background: "var(--accent)", color: "var(--on-accent)" } : undefined}
            >
              Step inside
            </button>
          </div>

          <span aria-hidden className="mx-0.5 h-5 w-px" style={{ background: "var(--line)" }} />

          {/* Time of day presets: Day, Golden Hour, Night */}
          <div className="flex items-center gap-0.5 rounded-full p-0.5" style={{ background: "var(--background)" }} role="group" aria-label="Lighting mood">
            <button
              type="button"
              onClick={() => changeTimeOfDay("day")}
              aria-pressed={timeOfDay === "day"}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                timeOfDay === "day" ? "" : "hover:bg-raised"
              }`}
              style={timeOfDay === "day" ? { background: "var(--pine)", color: "var(--background)" } : undefined}
            >
              ☀️ Day
            </button>
            <button
              type="button"
              onClick={() => changeTimeOfDay("golden")}
              aria-pressed={timeOfDay === "golden"}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                timeOfDay === "golden" ? "" : "hover:bg-raised"
              }`}
              style={timeOfDay === "golden" ? { background: "var(--pine)", color: "var(--background)" } : undefined}
            >
              🌅 Golden
            </button>
            <button
              type="button"
              onClick={() => changeTimeOfDay("night")}
              aria-pressed={timeOfDay === "night"}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                timeOfDay === "night" ? "" : "hover:bg-raised"
              }`}
              style={timeOfDay === "night" ? { background: "var(--pine)", color: "var(--background)" } : undefined}
            >
              🌙 Night
            </button>
          </div>

          <span aria-hidden className="mx-0.5 h-5 w-px" style={{ background: "var(--line)" }} />

          {/* Environmental controls: Curtains, Practical Lamps, Ambient Sound */}
          <div className="flex items-center gap-0.5 rounded-full p-0.5" style={{ background: "var(--background)" }} role="group" aria-label="Atmosphere controls">
            <button
              type="button"
              onClick={toggleCurtains}
              aria-pressed={curtainsClosed}
              title={curtainsClosed ? "Open sheer and blackout curtains" : "Draw curtains closed"}
              aria-label={curtainsClosed ? "Curtains closed. Click to open." : "Curtains open. Click to close."}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                curtainsClosed ? "" : "hover:bg-raised"
              }`}
              style={curtainsClosed ? { background: "var(--accent)", color: "var(--on-accent)" } : undefined}
            >
              <span>🪟</span>
              <span className="hidden sm:inline">{curtainsClosed ? "Curtains closed" : "Curtains open"}</span>
            </button>

            <button
              type="button"
              onClick={toggleLamps}
              aria-pressed={practicalLampsOn}
              title={practicalLampsOn ? "Turn off practical lighting" : "Turn on practical 2700K lighting"}
              aria-label={practicalLampsOn ? "Practical lamps on" : "Practical lamps off"}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                practicalLampsOn ? "" : "hover:bg-raised"
              }`}
              style={practicalLampsOn ? { background: "var(--pine)", color: "var(--background)" } : undefined}
            >
              <span>💡</span>
              <span className="hidden sm:inline">{practicalLampsOn ? "Lamps on" : "Lamps off"}</span>
            </button>

            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={soundOn}
              title={soundOn ? "Mute ambient audio" : "Play ambient procedural soundscape"}
              aria-label={soundOn ? "Ambient sound on. Click to mute." : "Ambient sound off. Click to play."}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                soundOn ? "" : "hover:bg-raised"
              }`}
              style={soundOn ? { background: "var(--pine)", color: "var(--background)" } : undefined}
            >
              <span>{soundOn ? "🔊" : "🔇"}</span>
              <span className="hidden sm:inline">{soundOn ? "Sound on" : "Sound"}</span>
            </button>
          </div>

          {mode === "orbit" && (
            <>
              <span aria-hidden className="mx-0.5 h-5 w-px" style={{ background: "var(--line)" }} />
              <button
                type="button"
                onClick={resetView}
                aria-label="Reset camera view"
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-background"
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Reset
              </button>
            </>
          )}
        </div>
      </div>

      {/* cinematic camera presets & hotspot chips bar */}
      {mode === "orbit" && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
          {/* Cinematic presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: "var(--muted)" }}>
              Cinematic views
            </span>
            {CINEMATIC_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id, p.pose)}
                aria-pressed={activePreset === p.id}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  activePreset === p.id ? "border-transparent" : "hover:bg-raised"
                }`}
                style={
                  activePreset === p.id
                    ? { background: "var(--accent)", color: "var(--on-accent)" }
                    : { borderColor: "var(--line)" }
                }
              >
                <span aria-hidden>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>

          {/* Hotspots */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: "var(--muted)" }}>
              Features
            </span>
            {hotspots.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => (activeId === h.id ? closeHotspot() : frameHotspot(h.id))}
                aria-pressed={activeId === h.id}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  activeId === h.id ? "border-transparent" : "hover:bg-raised"
                }`}
                style={
                  activeId === h.id
                    ? { background: "var(--pine)", color: "var(--background)" }
                    : { borderColor: "var(--line)" }
                }
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
