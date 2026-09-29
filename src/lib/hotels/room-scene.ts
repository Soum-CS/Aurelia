import { parseScene } from "@/lib/types";

/**
 * Deterministic concept-twin configuration for dataset rooms.
 * Visual styling only — every displayed fact (name, price, availability)
 * still comes verbatim from the CSV record.
 */
export function datasetRoomScene(hotelId: string, roomType: string): string {
  const paletteByType: Array<[RegExp, string]> = [
    [/suite|president|luxur/i, "noir"],
    [/deluxe|premier|executive/i, "terracotta"],
    [/superior|classic/i, "azure"],
    [/standard|deluxe/i, "sand"],
  ];
  const palette = paletteByType.find(([re]) => re.test(roomType))?.[1] ?? "forest";
  const bed = /king/i.test(roomType) ? "king" : /twin|double/i.test(roomType) ? "twin" : "queen";
  const views = ["city", "garden", "ocean", "alps"] as const;
  const view = views[[...hotelId].reduce((a, c) => a + c.charCodeAt(0), 0) % views.length];
  const isSuite = /suite|president|luxur/i.test(roomType);
  return JSON.stringify({
    palette,
    windowView: view,
    bed,
    extras: isSuite ? ["fireplace", "bathtub", "sofa", "desk"] : ["desk", "sofa"],
    modelUrl: isSuite ? "/models/rooms/penthouse-suite.glb" : "/models/rooms/hero-room.glb",
    roomStyle: isSuite ? "penthouse" : "contemporary",
  });
}

export function datasetSceneOk(json: string): boolean {
  try { parseScene(json); return true; } catch { return false; }
}
