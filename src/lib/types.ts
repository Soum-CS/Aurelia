export type WindowView = "city" | "ocean" | "garden" | "alps" | "mountain";

export type Palette = "sand" | "terracotta" | "azure" | "forest" | "noir";

export type RoomExtra = "sofa" | "desk" | "lounge" | "bathtub" | "fireplace";

export type QualityLevel = "mobile" | "balanced" | "high" | "cinematic";

export type LightingPreset = "day" | "golden" | "night";

export interface SceneConfig {
  palette: Palette;
  windowView: WindowView;
  bed: "king" | "queen" | "twin";
  extras: RoomExtra[];
  modelUrl?: string;
  quality?: QualityLevel;
  lightingPreset?: LightingPreset;
  roomStyle?: "contemporary" | "classic" | "minimal" | "penthouse";
}

export function parseScene(json: string): SceneConfig {
  try {
    const raw = JSON.parse(json) as Partial<SceneConfig>;
    return {
      palette: raw.palette ?? "sand",
      windowView: raw.windowView ?? "city",
      bed: raw.bed ?? "king",
      extras: Array.isArray(raw.extras) ? raw.extras : [],
      modelUrl: raw.modelUrl,
      quality: raw.quality,
      lightingPreset: raw.lightingPreset,
      roomStyle: raw.roomStyle,
    };
  } catch {
    return { palette: "sand", windowView: "city", bed: "king", extras: [] };
  }
}

export interface Addon {
  id: string;
  label: string;
  description: string;
  price: number;
  perNight?: boolean;
  perGuest?: boolean;
}

export interface ParsedBookingAddon {
  id: string;
  label: string;
  amount: number;
}
