import * as THREE from "three";

/**
 * High-performance procedural textures & normal maps for photorealistic PBR materials.
 * Generated on demand and cached in memory — zero external network requests.
 */

const cache = new Map<string, THREE.Texture>();

function shade(hex: string, amt: number): string {
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  const n = parseInt(clean, 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) =>
    Math.max(0, Math.min(255, Math.round(v + amt)))
  );
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function mulberry(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function finish(t: THREE.CanvasTexture, srgb: boolean, repeat?: [number, number]): THREE.Texture {
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}

/** Convert heightmap data into a tangent-space normal map (RGB: X, Y, Z) */
function heightToNormalCanvas(
  heightCv: HTMLCanvasElement,
  strength: number = 2.0
): HTMLCanvasElement {
  const W = heightCv.width;
  const H = heightCv.height;
  const hCtx = heightCv.getContext("2d")!;
  const hData = hCtx.getImageData(0, 0, W, H).data;

  const nCv = document.createElement("canvas");
  nCv.width = W;
  nCv.height = H;
  const nCtx = nCv.getContext("2d")!;
  const nImg = nCtx.createImageData(W, H);
  const nData = nImg.data;

  const getH = (x: number, y: number) => {
    const px = ((x + W) % W);
    const py = ((y + H) % H);
    return hData[(py * W + px) * 4] / 255;
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const left = getH(x - 1, y);
      const right = getH(x + 1, y);
      const up = getH(x, y - 1);
      const down = getH(x, y + 1);

      const dx = (right - left) * strength;
      const dy = (down - up) * strength;
      const dz = 1.0;

      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const nx = (dx / len) * 0.5 + 0.5;
      const ny = (-dy / len) * 0.5 + 0.5;
      const nz = (dz / len) * 0.5 + 0.5;

      const idx = (y * W + x) * 4;
      nData[idx] = Math.round(nx * 255);
      nData[idx + 1] = Math.round(ny * 255);
      nData[idx + 2] = Math.round(nz * 255);
      nData[idx + 3] = 255;
    }
  }

  nCtx.putImageData(nImg, 0, 0);
  return nCv;
}

/** Wood-plank colour + roughness maps sized to the 6 x 4.4 m floor. */
export function getFloorMaps(base: string, alt: string): { map: THREE.Texture; roughnessMap: THREE.Texture; normalMap: THREE.Texture } {
  const key = `floor|${base}|${alt}`;
  const hit = cache.get(key);
  if (hit) return {
    map: hit,
    roughnessMap: cache.get(`${key}|r`)!,
    normalMap: cache.get(`${key}|n`)!,
  };

  const rnd = mulberry(7);
  const W = 1024;
  const H = 758; // ~6:4.4 aspect
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  const rv = document.createElement("canvas");
  rv.width = W;
  rv.height = H;
  const gr = rv.getContext("2d")!;
  const hv = document.createElement("canvas");
  hv.width = W;
  hv.height = H;
  const gh = hv.getContext("2d")!;

  const planks = 9;
  const pw = W / planks;

  // roughness base
  gr.fillStyle = "#8a8a8a";
  gr.fillRect(0, 0, W, H);

  // height base
  gh.fillStyle = "#808080";
  gh.fillRect(0, 0, W, H);

  for (let i = 0; i < planks; i++) {
    const x = i * pw;
    const tint = Math.round((rnd() - 0.5) * 26);
    g.fillStyle = shade(rnd() > 0.72 ? alt : base, tint);
    g.fillRect(x, 0, pw, H);

    // grain streaks running along the plank
    for (let s = 0; s < 90; s++) {
      const gx = x + rnd() * pw;
      const gw = 0.5 + rnd() * 1.6;
      const alpha = 0.03 + rnd() * 0.07;
      g.strokeStyle = rnd() > 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha * 0.7})`;
      g.lineWidth = gw;
      g.beginPath();
      const y0 = rnd() * H;
      g.moveTo(gx, y0);
      g.bezierCurveTo(gx + (rnd() - 0.5) * 8, y0 + H * 0.33, gx + (rnd() - 0.5) * 8, y0 + H * 0.66, gx + (rnd() - 0.5) * 4, y0 + H);
      g.stroke();

      gr.strokeStyle = rnd() > 0.5 ? `rgba(120,120,120,${alpha})` : `rgba(190,190,190,${alpha})`;
      gr.lineWidth = gw;
      gr.beginPath();
      gr.moveTo(gx, y0);
      gr.lineTo(gx + (rnd() - 0.5) * 4, y0 + H);
      gr.stroke();

      gh.strokeStyle = rnd() > 0.5 ? `rgba(90,90,90,${alpha * 1.2})` : `rgba(170,170,170,${alpha * 1.2})`;
      gh.lineWidth = gw;
      gh.beginPath();
      gh.moveTo(gx, y0);
      gh.lineTo(gx + (rnd() - 0.5) * 4, y0 + H);
      gh.stroke();
    }

    // board end-joint
    if (rnd() > 0.45) {
      const jy = rnd() * H;
      g.fillStyle = "rgba(20,12,4,0.3)";
      g.fillRect(x, jy, pw, 2.5);
      gr.fillStyle = "rgba(230,230,230,0.6)";
      gr.fillRect(x, jy, pw, 2.5);
      gh.fillStyle = "rgba(30,30,30,0.7)";
      gh.fillRect(x, jy, pw, 3);
    }

    // seam between boards
    g.fillStyle = "rgba(20,12,4,0.42)";
    g.fillRect(x - 1, 0, 2.2, H);
    gr.fillStyle = "rgba(230,230,230,0.6)";
    gr.fillRect(x - 1, 0, 2.2, H);
    gh.fillStyle = "rgba(20,20,20,0.8)";
    gh.fillRect(x - 1.5, 0, 3, H);
  }

  // subtle sheen variation
  for (let s = 0; s < 24; s++) {
    gr.fillStyle = `rgba(${rnd() > 0.5 ? "70,70,70" : "200,200,200"},0.05)`;
    gr.beginPath();
    gr.ellipse(rnd() * W, rnd() * H, 60 + rnd() * 160, 30 + rnd() * 90, rnd() * Math.PI, 0, Math.PI * 2);
    gr.fill();
  }

  const map = finish(new THREE.CanvasTexture(cv), true);
  const roughnessMap = finish(new THREE.CanvasTexture(rv), false);
  const normalMap = finish(new THREE.CanvasTexture(heightToNormalCanvas(hv, 2.5)), false);

  cache.set(key, map);
  cache.set(`${key}|r`, roughnessMap);
  cache.set(`${key}|n`, normalMap);
  return { map, roughnessMap, normalMap };
}

/** Tangent-space normal map for luxury micro-twill textile weave. */
export function getFabricNormalMap(): THREE.Texture {
  const key = "fabric_normal";
  const hit = cache.get(key);
  if (hit) return hit;

  const S = 128;
  const hv = document.createElement("canvas");
  hv.width = S;
  hv.height = S;
  const g = hv.getContext("2d")!;
  g.fillStyle = "#808080";
  g.fillRect(0, 0, S, S);

  const step = 4;
  for (let y = 0; y < S; y += step) {
    for (let x = 0; x < S; x += step) {
      const diagonal = Math.sin(((x + y) / step) * Math.PI) * 0.5 + 0.5;
      const val = Math.round(100 + diagonal * 55);
      g.fillStyle = `rgb(${val},${val},${val})`;
      g.fillRect(x, y, step, step);
    }
  }

  const t = finish(new THREE.CanvasTexture(heightToNormalCanvas(hv, 3.2)), false, [8, 8]);
  cache.set(key, t);
  return t;
}

/** Fine fabric weave bump shared by duvet, pillows, rugs and curtains. */
export function getWeaveBump(): THREE.Texture {
  const key = "weave";
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 96;
  const cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#808080";
  g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 3) {
    for (let x = 0; x < S; x += 3) {
      const over = ((x + y) / 3) % 2 === 0;
      g.fillStyle = over ? "#9a9a9a" : "#6f6f6f";
      g.fillRect(x, y, 2.4, 2.4);
    }
  }
  const t = finish(new THREE.CanvasTexture(cv), false, [6, 6]);
  cache.set(key, t);
  return t;
}

/** Plaster mottling for walls (roughness map). */
export function getPlasterRough(): THREE.Texture {
  const key = "plaster_rough";
  const hit = cache.get(key);
  if (hit) return hit;
  const rnd = mulberry(21);
  const S = 256;
  const cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#b4b4b4";
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 220; i++) {
    g.fillStyle = `rgba(${rnd() > 0.5 ? "140,140,140" : "205,205,205"},${0.04 + rnd() * 0.06})`;
    g.beginPath();
    g.ellipse(rnd() * S, rnd() * S, 8 + rnd() * 42, 8 + rnd() * 42, rnd() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  const t = finish(new THREE.CanvasTexture(cv), false, [2, 2]);
  cache.set(key, t);
  return t;
}

/** Tangent-space normal map for plaster wall micro-texture. */
export function getPlasterNormalMap(): THREE.Texture {
  const key = "plaster_normal";
  const hit = cache.get(key);
  if (hit) return hit;

  const rnd = mulberry(43);
  const S = 256;
  const hv = document.createElement("canvas");
  hv.width = S;
  hv.height = S;
  const g = hv.getContext("2d")!;
  g.fillStyle = "#808080";
  g.fillRect(0, 0, S, S);

  for (let i = 0; i < 300; i++) {
    const gray = Math.round(110 + rnd() * 35);
    g.fillStyle = `rgba(${gray},${gray},${gray},0.08)`;
    g.beginPath();
    g.arc(rnd() * S, rnd() * S, 3 + rnd() * 12, 0, Math.PI * 2);
    g.fill();
  }

  const t = finish(new THREE.CanvasTexture(heightToNormalCanvas(hv, 1.8)), false, [3, 3]);
  cache.set(key, t);
  return t;
}

/** Procedural Italian Calacatta marble maps (diffuse, roughness, normal). */
export function getMarbleMaps(baseHex = "#f5f4f0", veinHex = "#8f8b84"): {
  map: THREE.Texture;
  roughnessMap: THREE.Texture;
  normalMap: THREE.Texture;
} {
  const key = `marble|${baseHex}|${veinHex}`;
  const hit = cache.get(key);
  if (hit) return {
    map: hit,
    roughnessMap: cache.get(`${key}|r`)!,
    normalMap: cache.get(`${key}|n`)!,
  };

  const rnd = mulberry(89);
  const S = 512;
  const cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  const g = cv.getContext("2d")!;

  const rv = document.createElement("canvas");
  rv.width = S;
  rv.height = S;
  const gr = rv.getContext("2d")!;

  const hv = document.createElement("canvas");
  hv.width = S;
  hv.height = S;
  const gh = hv.getContext("2d")!;

  // base fill
  g.fillStyle = baseHex;
  g.fillRect(0, 0, S, S);

  // high polish roughness (mostly very smooth)
  gr.fillStyle = "#222222";
  gr.fillRect(0, 0, S, S);

  gh.fillStyle = "#808080";
  gh.fillRect(0, 0, S, S);

  // delicate meandering veins
  const numVeins = 5;
  for (let v = 0; v < numVeins; v++) {
    let vx = rnd() * S;
    let vy = 0;
    g.strokeStyle = veinHex;
    g.lineWidth = 1.5 + rnd() * 2.5;
    g.beginPath();
    g.moveTo(vx, vy);

    while (vy < S) {
      vy += 15 + rnd() * 30;
      vx += (rnd() - 0.5) * 50;
      g.lineTo(vx, vy);
    }
    g.stroke();

    // slight roughness in veins
    gr.strokeStyle = "#444444";
    gr.lineWidth = 2 + rnd() * 3;
    gr.beginPath();
    gr.moveTo(vx, 0);
    gr.stroke();
  }

  // soft smoky clouding
  for (let c = 0; c < 18; c++) {
    g.fillStyle = `rgba(180,175,168,0.06)`;
    g.beginPath();
    g.ellipse(rnd() * S, rnd() * S, 40 + rnd() * 90, 20 + rnd() * 60, rnd() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }

  const map = finish(new THREE.CanvasTexture(cv), true);
  const roughnessMap = finish(new THREE.CanvasTexture(rv), false);
  const normalMap = finish(new THREE.CanvasTexture(heightToNormalCanvas(hv, 1.2)), false);

  cache.set(key, map);
  cache.set(`${key}|r`, roughnessMap);
  cache.set(`${key}|n`, normalMap);
  return { map, roughnessMap, normalMap };
}

/** Tangent-space animated ocean wave normal map generator. */
export function getOceanWaveNormalMap(): THREE.Texture {
  const key = "ocean_wave_normal";
  const hit = cache.get(key);
  if (hit) return hit;

  const S = 256;
  const hv = document.createElement("canvas");
  hv.width = S;
  hv.height = S;
  const g = hv.getContext("2d")!;
  g.fillStyle = "#808080";
  g.fillRect(0, 0, S, S);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const wave1 = Math.sin((x * 0.08) + (y * 0.04));
      const wave2 = Math.sin((x * 0.04) - (y * 0.06));
      const wave3 = Math.cos(((x + y) * 0.05));
      const v = Math.round(128 + (wave1 * 0.4 + wave2 * 0.35 + wave3 * 0.25) * 45);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, y, 1, 1);
    }
  }

  const t = finish(new THREE.CanvasTexture(heightToNormalCanvas(hv, 3.8)), false, [12, 12]);
  cache.set(key, t);
  return t;
}
