import { Palette } from "@/lib/types";

export interface ScenePalette {
  floor: string;
  floorAlt: string;
  wall: string;
  wallTrim: string;
  textile: string;
  textileDark: string;
  wood: string;
  metal: string;
  rug: string;
  art: string;
  skyDay: string;
  skyNight: string;
  sunDay: string;
}

export const PALETTES: Record<Palette, ScenePalette> = {
  sand: {
    floor: "#c9a878",
    floorAlt: "#b8935f",
    wall: "#efe5d2",
    wallTrim: "#e3d5bb",
    textile: "#d9b98c",
    textileDark: "#a97f4f",
    wood: "#8a6538",
    metal: "#b08d57",
    rug: "#e6d6b4",
    art: "#c98f4e",
    skyDay: "#cfe0ea",
    skyNight: "#131c2b",
    sunDay: "#fff3d6",
  },
  terracotta: {
    floor: "#a9713f",
    floorAlt: "#96602f",
    wall: "#f2e2cf",
    wallTrim: "#e4cdb2",
    textile: "#c4693c",
    textileDark: "#96482a",
    wood: "#7c4a24",
    metal: "#b07a45",
    rug: "#e8cfae",
    art: "#b96a4c",
    skyDay: "#f0dcc4",
    skyNight: "#181420",
    sunDay: "#ffe9c9",
  },
  azure: {
    floor: "#e6ddca",
    floorAlt: "#d5cab2",
    wall: "#f4efe4",
    wallTrim: "#e7dfcd",
    textile: "#6fa3bf",
    textileDark: "#4a7d99",
    wood: "#a58a5f",
    metal: "#c0a065",
    rug: "#dbe7e6",
    art: "#5f8ea8",
    skyDay: "#bfe0ef",
    skyNight: "#0e1626",
    sunDay: "#fff6da",
  },
  forest: {
    floor: "#7d5936",
    floorAlt: "#6b4927",
    wall: "#e9e1cd",
    wallTrim: "#d8cbae",
    textile: "#3e5c48",
    textileDark: "#2c4434",
    wood: "#5d3d1e",
    metal: "#8f7748",
    rug: "#cfd6bd",
    art: "#55704f",
    skyDay: "#d7e2e6",
    skyNight: "#101820",
    sunDay: "#fdf3d9",
  },
  noir: {
    floor: "#4d4339",
    floorAlt: "#3d352c",
    wall: "#3b352e",
    wallTrim: "#574e42",
    textile: "#8a6f4d",
    textileDark: "#6b543a",
    wood: "#2e261e",
    metal: "#c9a25e",
    rug: "#5c5044",
    art: "#c9a25e",
    skyDay: "#9db4c4",
    skyNight: "#090c14",
    sunDay: "#ffeec8",
  },
};

export const VIEW_COPY: Record<string, string> = {
  city: "the city skyline stretching to the horizon",
  ocean: "open water meeting the sky at the horizon line",
  garden: "greenery and blossoms just beyond your window",
  alps: "snow-capped peaks under wide mountain light",
};
