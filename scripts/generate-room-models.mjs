import * as THREE from 'three';
import { GLTFExporter } from 'three-stdlib';
import fs from 'fs';
import path from 'path';

// Helper for rounded box / chamfered geometries
function createBox(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}

function createCylinder(rTop, rBottom, height, segments = 24) {
  return new THREE.CylinderGeometry(rTop, rBottom, height, segments);
}

function createTorus(r, tube, radialSegments = 16, tubularSegments = 32, arc = Math.PI * 2) {
  return new THREE.TorusGeometry(r, tube, radialSegments, tubularSegments, arc);
}

// Materials definition with rich PBR properties
const materials = {
  wall: new THREE.MeshStandardMaterial({
    name: 'mat_plaster_wall',
    color: 0xede4d3,
    roughness: 0.92,
    metalness: 0.02,
  }),
  wallTrim: new THREE.MeshStandardMaterial({
    name: 'mat_wall_trim',
    color: 0xe0d4be,
    roughness: 0.75,
    metalness: 0.05,
  }),
  woodWalnut: new THREE.MeshStandardMaterial({
    name: 'mat_wood_walnut',
    color: 0x5a3e26,
    roughness: 0.65,
    metalness: 0.05,
  }),
  woodOak: new THREE.MeshStandardMaterial({
    name: 'mat_wood_oak',
    color: 0x8a6642,
    roughness: 0.6,
    metalness: 0.04,
  }),
  marble: new THREE.MeshStandardMaterial({
    name: 'mat_marble_calacatta',
    color: 0xf3f2ef,
    roughness: 0.15,
    metalness: 0.08,
  }),
  fabricLinen: new THREE.MeshStandardMaterial({
    name: 'mat_fabric_linen',
    color: 0xf7f3ea,
    roughness: 0.95,
    metalness: 0.0,
  }),
  fabricDuvet: new THREE.MeshStandardMaterial({
    name: 'mat_fabric_duvet',
    color: 0xdfbf96,
    roughness: 0.98,
    metalness: 0.0,
  }),
  fabricVelvet: new THREE.MeshStandardMaterial({
    name: 'mat_fabric_velvet',
    color: 0x8b6845,
    roughness: 0.9,
    metalness: 0.0,
  }),
  fabricThrow: new THREE.MeshStandardMaterial({
    name: 'mat_fabric_throw',
    color: 0x6e5238,
    roughness: 0.95,
    metalness: 0.0,
  }),
  rug: new THREE.MeshStandardMaterial({
    name: 'mat_fabric_rug',
    color: 0xdfd4bc,
    roughness: 0.96,
    metalness: 0.0,
  }),
  leather: new THREE.MeshStandardMaterial({
    name: 'mat_leather',
    color: 0x3d2b1f,
    roughness: 0.55,
    metalness: 0.1,
  }),
  brass: new THREE.MeshStandardMaterial({
    name: 'mat_metal_brass',
    color: 0xc8a65c,
    roughness: 0.24,
    metalness: 0.88,
  }),
  chrome: new THREE.MeshStandardMaterial({
    name: 'mat_metal_chrome',
    color: 0xe8edf2,
    roughness: 0.06,
    metalness: 0.98,
  }),
  blackMetal: new THREE.MeshStandardMaterial({
    name: 'mat_metal_black',
    color: 0x222224,
    roughness: 0.45,
    metalness: 0.8,
  }),
  glass: new THREE.MeshPhysicalMaterial({
    name: 'mat_glass_clear',
    color: 0xffffff,
    transparent: true,
    opacity: 0.12,
    roughness: 0.02,
    metalness: 0.0,
    transmission: 0.95,
    ior: 1.52,
    thickness: 0.08,
  }),
  glassFrosted: new THREE.MeshStandardMaterial({
    name: 'mat_glass_frosted',
    color: 0xf0f4f8,
    roughness: 0.35,
    metalness: 0.05,
    transparent: true,
    opacity: 0.85,
  }),
  mirror: new THREE.MeshStandardMaterial({
    name: 'mat_mirror_glass',
    color: 0xf5f8fc,
    roughness: 0.02,
    metalness: 0.98,
  }),
  porcelain: new THREE.MeshStandardMaterial({
    name: 'mat_porcelain_white',
    color: 0xfafafa,
    roughness: 0.12,
    metalness: 0.05,
  }),
  plantLeaf: new THREE.MeshStandardMaterial({
    name: 'mat_plant_leaf',
    color: 0x2e4b2d,
    roughness: 0.6,
    metalness: 0.05,
  }),
  plantSoil: new THREE.MeshStandardMaterial({
    name: 'mat_plant_soil',
    color: 0x241a12,
    roughness: 0.95,
  }),
  potCeramic: new THREE.MeshStandardMaterial({
    name: 'mat_pot_ceramic',
    color: 0xdfdcd5,
    roughness: 0.35,
  }),
  artworkCanvas: new THREE.MeshStandardMaterial({
    name: 'mat_artwork_canvas',
    color: 0xc49a62,
    roughness: 0.8,
  }),
};

export function buildHeroRoom() {
  const room = new THREE.Group();
  room.name = 'AureliaHeroRoom';

  // 1. ARCHITECTURAL ENVELOPE
  const shell = new THREE.Group();
  shell.name = 'ArchitecturalShell';

  // Crown molding (around perimeter at ceiling y = 2.65)
  const moldingBack = new THREE.Mesh(createBox(6, 0.08, 0.08), materials.wallTrim);
  moldingBack.position.set(0, 2.66, -2.16);
  shell.add(moldingBack);

  const moldingLeft = new THREE.Mesh(createBox(0.08, 0.08, 4.4), materials.wallTrim);
  moldingLeft.position.set(-2.96, 2.66, 0);
  shell.add(moldingLeft);

  const moldingRight = new THREE.Mesh(createBox(0.08, 0.08, 4.4), materials.wallTrim);
  moldingRight.position.set(2.96, 2.66, 0);
  shell.add(moldingRight);

  // Ceiling tray with recessed LED cove profile
  const ceilingFrame = new THREE.Mesh(createBox(5.2, 0.06, 3.6), materials.wallTrim);
  ceilingFrame.position.set(0, 2.68, 0);
  shell.add(ceilingFrame);

  // Recessed warm LED glow strip geometry
  const coveLight = new THREE.Mesh(createBox(4.9, 0.02, 3.3), new THREE.MeshBasicMaterial({ color: 0xfff1d6 }));
  coveLight.position.set(0, 2.66, 0);
  shell.add(coveLight);

  room.add(shell);

  // 2. LUXURY DESIGNER KING BED
  const bedGroup = new THREE.Group();
  bedGroup.name = 'BedGroup';
  bedGroup.position.set(-0.35, 0, -1.15);

  // Headboard with vertical channel fluting
  const headboardBase = new THREE.Mesh(createBox(2.3, 1.35, 0.1), materials.woodWalnut);
  headboardBase.position.set(0, 0.75, -0.56);
  bedGroup.add(headboardBase);

  // Fluted fabric padded channels
  const channels = 7;
  const channelWidth = 2.2 / channels;
  for (let i = 0; i < channels; i++) {
    const cx = -1.1 + channelWidth * (i + 0.5);
    const channelMesh = new THREE.Mesh(createBox(channelWidth - 0.02, 1.25, 0.05), materials.fabricVelvet);
    channelMesh.position.set(cx, 0.77, -0.5);
    bedGroup.add(channelMesh);
  }

  // Wooden platform frame
  const frame = new THREE.Mesh(createBox(2.14, 0.32, 2.18), materials.woodWalnut);
  frame.position.set(0, 0.22, 0.35);
  bedGroup.add(frame);

  // Brass-accented tapered legs
  const legPositions = [
    [-0.98, -0.65],
    [0.98, -0.65],
    [-0.98, 1.35],
    [0.98, 1.35],
  ];
  legPositions.forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(createCylinder(0.035, 0.02, 0.16, 16), materials.brass);
    leg.position.set(lx, 0.08, lz);
    bedGroup.add(leg);
  });

  // Mattress with welted border
  const mattress = new THREE.Mesh(createBox(1.98, 0.26, 2.05), materials.fabricLinen);
  mattress.position.set(0, 0.48, 0.35);
  mattress.name = 'bed';
  bedGroup.add(mattress);

  // Plush duvet layered on mattress
  const duvet = new THREE.Mesh(createBox(2.04, 0.12, 1.55), materials.fabricDuvet);
  duvet.position.set(0, 0.63, 0.45);
  duvet.name = 'duvet';
  bedGroup.add(duvet);

  // Folded duvet turnover lip
  const foldBack = new THREE.Mesh(createBox(2.04, 0.05, 0.32), materials.fabricLinen);
  foldBack.position.set(0, 0.67, -0.28);
  bedGroup.add(foldBack);

  // Folded waffle-knit throw blanket draped across the foot of the bed
  const throwBlanket = new THREE.Mesh(createBox(2.06, 0.04, 0.55), materials.fabricThrow);
  throwBlanket.position.set(0, 0.69, 0.88);
  bedGroup.add(throwBlanket);

  // 4 Sleeping Pillows with organic slight rotation and natural tilt
  const pillowData = [
    { x: -0.52, y: 0.7, z: -0.38, rx: -0.3, ry: 0.04, rz: -0.03 },
    { x: 0.52, y: 0.7, z: -0.38, rx: -0.28, ry: -0.05, rz: 0.02 },
    { x: -0.5, y: 0.74, z: -0.24, rx: -0.38, ry: 0.02, rz: 0.04 },
    { x: 0.5, y: 0.73, z: -0.25, rx: -0.36, ry: -0.03, rz: -0.02 },
  ];
  pillowData.forEach((p, idx) => {
    const pillow = new THREE.Mesh(createBox(0.78, 0.15, 0.42), materials.fabricLinen);
    pillow.name = `pillow_${idx + 1}`;
    pillow.position.set(p.x, p.y, p.z);
    pillow.rotation.set(p.rx, p.ry, p.rz);
    bedGroup.add(pillow);
  });

  // Decorative Accent Pillow & Lumbar Cushion
  const accentPillow = new THREE.Mesh(createBox(0.48, 0.34, 0.16), materials.fabricVelvet);
  accentPillow.position.set(-0.25, 0.76, -0.12);
  accentPillow.rotation.set(-0.42, 0.1, 0.05);
  bedGroup.add(accentPillow);

  const lumbarPillow = new THREE.Mesh(createBox(0.65, 0.22, 0.14), materials.fabricThrow);
  lumbarPillow.position.set(0.3, 0.74, -0.1);
  lumbarPillow.rotation.set(-0.38, -0.08, -0.04);
  bedGroup.add(lumbarPillow);

  room.add(bedGroup);

  // 3. FLOATING MARBLE NIGHTSTANDS (L & R)
  const nightstands = [
    { x: -1.82, name: 'Nightstand_L' },
    { x: 1.12, name: 'Nightstand_R' },
  ];

  nightstands.forEach((ns, i) => {
    const nsGroup = new THREE.Group();
    nsGroup.name = ns.name;
    nsGroup.position.set(ns.x, 0, -1.55);

    // Walnut body
    const body = new THREE.Mesh(createBox(0.58, 0.36, 0.44), materials.woodWalnut);
    body.position.set(0, 0.36, 0);
    nsGroup.add(body);

    // Italian Calacatta marble slab on top
    const marbleTop = new THREE.Mesh(createBox(0.62, 0.035, 0.48), materials.marble);
    marbleTop.position.set(0, 0.555, 0);
    nsGroup.add(marbleTop);

    // Brass drawer pull handle
    const handle = new THREE.Mesh(createCylinder(0.008, 0.008, 0.16, 12), materials.brass);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, 0.36, 0.23);
    nsGroup.add(handle);

    // Left nightstand accessories: glass carafe & tumbler
    if (i === 0) {
      const carafe = new THREE.Mesh(createCylinder(0.04, 0.065, 0.2, 16), materials.glass);
      carafe.position.set(-0.12, 0.67, 0.05);
      nsGroup.add(carafe);

      const glassTumbler = new THREE.Mesh(createCylinder(0.035, 0.03, 0.09, 16), materials.glass);
      glassTumbler.position.set(0.02, 0.62, 0.08);
      nsGroup.add(glassTumbler);

      // Bedside reading hardcover book
      const book = new THREE.Mesh(createBox(0.18, 0.03, 0.24), materials.leather);
      book.position.set(0.14, 0.59, -0.04);
      book.rotation.y = 0.25;
      nsGroup.add(book);
    } else {
      // Right nightstand accessories: ceramic bud vase & vintage clock
      const vase = new THREE.Mesh(createCylinder(0.03, 0.05, 0.16, 16), materials.potCeramic);
      vase.position.set(0.12, 0.65, 0.02);
      nsGroup.add(vase);

      const clock = new THREE.Mesh(createCylinder(0.04, 0.04, 0.03, 20), materials.brass);
      clock.rotation.x = Math.PI / 2;
      clock.position.set(-0.1, 0.61, 0.05);
      nsGroup.add(clock);
    }

    room.add(nsGroup);
  });

  // 4. EXECUTIVE WORKSPACE (Desk & Chair)
  const deskGroup = new THREE.Group();
  deskGroup.name = 'WorkspaceGroup';
  deskGroup.position.set(-2.25, 0, 0.85);

  // Oak desktop
  const desktop = new THREE.Mesh(createBox(1.3, 0.05, 0.68), materials.woodOak);
  desktop.position.set(0, 0.74, 0);
  desktop.name = 'desk';
  deskGroup.add(desktop);

  // Minimalist tapered metal legs
  [
    [-0.58, -0.28],
    [0.58, -0.28],
    [-0.58, 0.28],
    [0.58, 0.28],
  ].forEach(([dx, dz]) => {
    const leg = new THREE.Mesh(createCylinder(0.018, 0.014, 0.72, 16), materials.blackMetal);
    leg.position.set(dx, 0.36, dz);
    deskGroup.add(leg);
  });

  // Leather desk blotter / pad
  const deskPad = new THREE.Mesh(createBox(0.65, 0.008, 0.44), materials.leather);
  deskPad.position.set(0, 0.768, 0.04);
  deskGroup.add(deskPad);

  // Open hardcover art monograph
  const monographLeft = new THREE.Mesh(createBox(0.22, 0.015, 0.28), materials.fabricLinen);
  monographLeft.position.set(-0.11, 0.78, 0.04);
  monographLeft.rotation.y = 0.05;
  deskGroup.add(monographLeft);

  const monographRight = new THREE.Mesh(createBox(0.22, 0.015, 0.28), materials.fabricLinen);
  monographRight.position.set(0.11, 0.78, 0.04);
  monographRight.rotation.y = -0.05;
  deskGroup.add(monographRight);

  // Brass desk task lamp
  const lampBase = new THREE.Mesh(createCylinder(0.08, 0.08, 0.018, 20), materials.brass);
  lampBase.position.set(0.44, 0.774, -0.16);
  deskGroup.add(lampBase);

  const lampArm = new THREE.Mesh(createCylinder(0.008, 0.008, 0.42, 12), materials.brass);
  lampArm.position.set(0.44, 0.98, -0.16);
  lampArm.rotation.z = -0.18;
  deskGroup.add(lampArm);

  const lampHead = new THREE.Mesh(createCylinder(0.04, 0.07, 0.12, 16), materials.brass);
  lampHead.position.set(0.38, 1.18, -0.16);
  lampHead.rotation.z = Math.PI / 3;
  deskGroup.add(lampHead);

  // Designer desk chair
  const chairGroup = new THREE.Group();
  chairGroup.name = 'DeskChair';
  chairGroup.position.set(0, 0, 0.55);
  chairGroup.rotation.y = Math.PI;

  const seat = new THREE.Mesh(createBox(0.46, 0.06, 0.44), materials.fabricVelvet);
  seat.position.set(0, 0.46, 0);
  chairGroup.add(seat);

  const backrest = new THREE.Mesh(createBox(0.44, 0.42, 0.04), materials.woodOak);
  backrest.position.set(0, 0.7, -0.2);
  chairGroup.add(backrest);

  // Chair legs
  [
    [-0.18, -0.18],
    [0.18, -0.18],
    [-0.18, 0.18],
    [0.18, 0.18],
  ].forEach(([cx, cz]) => {
    const chairLeg = new THREE.Mesh(createCylinder(0.016, 0.012, 0.44, 12), materials.blackMetal);
    chairLeg.position.set(cx, 0.22, cz);
    chairGroup.add(chairLeg);
  });

  deskGroup.add(chairGroup);
  room.add(deskGroup);

  // 5. LOUNGE SEATING (Sofa, Coffee Table, Armchair)
  const loungeGroup = new THREE.Group();
  loungeGroup.name = 'LoungeGroup';

  // Deep curved sofa
  const sofaGroup = new THREE.Group();
  sofaGroup.name = 'sofa';
  sofaGroup.position.set(1.7, 0, 0.95);
  sofaGroup.rotation.y = -Math.PI / 12;

  // Base
  const sofaBase = new THREE.Mesh(createBox(1.85, 0.22, 0.85), materials.fabricVelvet);
  sofaBase.position.set(0, 0.22, 0);
  sofaGroup.add(sofaBase);

  // Cushions
  const cushionL = new THREE.Mesh(createBox(0.86, 0.14, 0.74), materials.fabricDuvet);
  cushionL.position.set(-0.44, 0.38, 0.03);
  sofaGroup.add(cushionL);

  const cushionR = new THREE.Mesh(createBox(0.86, 0.14, 0.74), materials.fabricDuvet);
  cushionR.position.set(0.44, 0.38, 0.03);
  sofaGroup.add(cushionR);

  // Backrest & arms
  const sofaBack = new THREE.Mesh(createBox(1.85, 0.42, 0.18), materials.fabricVelvet);
  sofaBack.position.set(0, 0.52, -0.34);
  sofaGroup.add(sofaBack);

  const armL = new THREE.Mesh(createBox(0.18, 0.34, 0.85), materials.fabricVelvet);
  armL.position.set(-0.84, 0.42, 0);
  sofaGroup.add(armL);

  const armR = new THREE.Mesh(createBox(0.18, 0.34, 0.85), materials.fabricVelvet);
  armR.position.set(0.84, 0.42, 0);
  sofaGroup.add(armR);

  // Throw cushions on sofa
  const sofaThrow = new THREE.Mesh(createBox(0.38, 0.38, 0.12), materials.fabricThrow);
  sofaThrow.position.set(-0.62, 0.5, -0.15);
  sofaThrow.rotation.set(-0.2, 0.3, 0.1);
  sofaGroup.add(sofaThrow);

  loungeGroup.add(sofaGroup);

  // Marble & Brass Coffee Table
  const coffeeTable = new THREE.Group();
  coffeeTable.name = 'CoffeeTable';
  coffeeTable.position.set(0.8, 0, 0.85);

  const tableTop = new THREE.Mesh(createCylinder(0.38, 0.38, 0.03, 32), materials.marble);
  tableTop.position.set(0, 0.36, 0);
  coffeeTable.add(tableTop);

  const tablePedestal = new THREE.Mesh(createCylinder(0.04, 0.18, 0.34, 24), materials.brass);
  tablePedestal.position.set(0, 0.17, 0);
  coffeeTable.add(tablePedestal);

  // Coffee table accessories: magazine & ceramic cup
  const magazine = new THREE.Mesh(createBox(0.24, 0.015, 0.3), materials.fabricLinen);
  magazine.position.set(-0.06, 0.385, 0.04);
  magazine.rotation.y = 0.3;
  coffeeTable.add(magazine);

  const cup = new THREE.Mesh(createCylinder(0.035, 0.025, 0.055, 16), materials.porcelain);
  cup.position.set(0.12, 0.405, -0.06);
  coffeeTable.add(cup);

  loungeGroup.add(coffeeTable);
  room.add(loungeGroup);

  // 6. LUXURY FREESTANDING SOAKING TUB & BATH EN-SUITE
  const bathGroup = new THREE.Group();
  bathGroup.name = 'BathtubArea';
  bathGroup.position.set(2.05, 0, -0.2);

  // Bathtub outer body (sculpted smooth rounded tub)
  const tubOuter = new THREE.Mesh(createBox(1.55, 0.62, 0.82), materials.porcelain);
  tubOuter.position.set(0, 0.31, 0);
  tubOuter.name = 'bathtub';
  bathGroup.add(tubOuter);

  // Inner water surface
  const tubWater = new THREE.Mesh(createBox(1.35, 0.01, 0.62), materials.glass);
  tubWater.position.set(0, 0.52, 0);
  bathGroup.add(tubWater);

  // Floor-mounted chrome tub filler faucet
  const faucetPole = new THREE.Mesh(createCylinder(0.018, 0.018, 0.88, 16), materials.chrome);
  faucetPole.position.set(-0.75, 0.44, 0);
  bathGroup.add(faucetPole);

  const faucetSpout = new THREE.Mesh(createTorus(0.1, 0.016, 12, 24, Math.PI), materials.chrome);
  faucetSpout.rotation.z = -Math.PI / 2;
  faucetSpout.position.set(-0.75, 0.88, 0);
  bathGroup.add(faucetSpout);

  // Freestanding Arched Vanity Mirror
  const mirrorGroup = new THREE.Group();
  mirrorGroup.name = 'VanityMirror';
  mirrorGroup.position.set(0.85, 0, -0.2);
  mirrorGroup.rotation.y = -Math.PI / 2;

  const mirrorFrame = new THREE.Mesh(createBox(0.68, 1.65, 0.04), materials.brass);
  mirrorFrame.position.set(0, 0.95, 0);
  mirrorGroup.add(mirrorFrame);

  const mirrorGlass = new THREE.Mesh(createBox(0.6, 1.55, 0.01), materials.mirror);
  mirrorGlass.position.set(0, 0.95, 0.02);
  mirrorGlass.name = 'mirror';
  mirrorGroup.add(mirrorGlass);

  bathGroup.add(mirrorGroup);
  room.add(bathGroup);

  // 7. SUBTLE REALISM & ACCESSORIES
  // Soft hotel slippers beside the bed
  const slipperL = new THREE.Mesh(createBox(0.12, 0.035, 0.26), materials.fabricLinen);
  slipperL.position.set(0.68, 0.02, 0.15);
  slipperL.rotation.y = -0.15;
  room.add(slipperL);

  const slipperR = new THREE.Mesh(createBox(0.12, 0.035, 0.26), materials.fabricLinen);
  slipperR.position.set(0.84, 0.02, 0.18);
  slipperR.rotation.y = -0.08;
  room.add(slipperR);

  // Architectural floor lamp
  const floorLamp = new THREE.Group();
  floorLamp.name = 'FloorLamp';
  floorLamp.position.set(2.55, 0, -1.62);

  const flBase = new THREE.Mesh(createCylinder(0.16, 0.16, 0.025, 24), materials.brass);
  flBase.position.set(0, 0.015, 0);
  floorLamp.add(flBase);

  const flPole = new THREE.Mesh(createCylinder(0.014, 0.014, 1.65, 16), materials.brass);
  flPole.position.set(0, 0.84, 0);
  floorLamp.add(flPole);

  const flShade = new THREE.Mesh(createCylinder(0.24, 0.3, 0.38, 24), materials.fabricLinen);
  flShade.position.set(0, 1.62, 0);
  floorLamp.add(flShade);

  room.add(floorLamp);

  // Fiddle Leaf Fig plant in fluted pot
  const plantGroup = new THREE.Group();
  plantGroup.name = 'PottedPlant';
  plantGroup.position.set(-2.55, 0, -1.78);

  const pot = new THREE.Mesh(createCylinder(0.22, 0.16, 0.44, 24), materials.potCeramic);
  pot.position.set(0, 0.22, 0);
  plantGroup.add(pot);

  const soil = new THREE.Mesh(createCylinder(0.2, 0.2, 0.02, 24), materials.plantSoil);
  soil.position.set(0, 0.42, 0);
  plantGroup.add(soil);

  const stem = new THREE.Mesh(createCylinder(0.018, 0.022, 1.1, 12), materials.woodOak);
  stem.position.set(0, 0.85, 0);
  plantGroup.add(stem);

  // Broad leaves
  const leafAngles = [0, 1.2, 2.4, 3.6, 4.8];
  leafAngles.forEach((ang, li) => {
    const leaf = new THREE.Mesh(createBox(0.22, 0.01, 0.35), materials.plantLeaf);
    const ly = 0.65 + li * 0.12;
    leaf.position.set(Math.cos(ang) * 0.12, ly, Math.sin(ang) * 0.12);
    leaf.rotation.set(0.3, ang, 0.2);
    plantGroup.add(leaf);
  });

  room.add(plantGroup);

  // Framed gallery art on back wall
  const artwork = new THREE.Group();
  artwork.name = 'FramedArtwork';
  artwork.position.set(1.7, 1.72, -2.16);

  const artFrame = new THREE.Mesh(createBox(1.52, 1.02, 0.04), materials.brass);
  artwork.add(artFrame);

  const artMat = new THREE.Mesh(createBox(1.42, 0.92, 0.01), materials.fabricLinen);
  artMat.position.set(0, 0, 0.02);
  artwork.add(artMat);

  const artCanvas = new THREE.Mesh(createBox(1.18, 0.72, 0.01), materials.artworkCanvas);
  artCanvas.position.set(0, 0, 0.025);
  artwork.add(artCanvas);

  room.add(artwork);

  return room;
}

export function buildPenthouseSuite() {
  const room = buildHeroRoom();
  room.name = 'AureliaPenthouseSuite';

  // Add Stone Fireplace to Penthouse Suite
  const fpGroup = new THREE.Group();
  fpGroup.name = 'fireplace';
  fpGroup.position.set(-2.92, 0, 0.2);
  fpGroup.rotation.y = Math.PI / 2;

  const mantel = new THREE.Mesh(createBox(1.35, 1.05, 0.18), materials.marble);
  mantel.position.set(0, 0.52, 0);
  fpGroup.add(mantel);

  const hearth = new THREE.Mesh(createBox(0.88, 0.5, 0.12), materials.blackMetal);
  hearth.position.set(0, 0.35, 0.06);
  fpGroup.add(hearth);

  const coals = new THREE.Mesh(createBox(0.62, 0.22, 0.06), materials.leather);
  coals.position.set(0, 0.24, 0.1);
  fpGroup.add(coals);

  const shelf = new THREE.Mesh(createBox(1.48, 0.06, 0.32), materials.woodWalnut);
  shelf.position.set(0, 1.08, 0.06);
  fpGroup.add(shelf);

  room.add(fpGroup);
  return room;
}

// Generate and export both models
const outDir = path.resolve('public/models/rooms');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function exportScene(scene, fileName, callback) {
  const outFile = path.join(outDir, fileName);
  const exporter = new GLTFExporter();
  exporter.parse(
    scene,
    (gltf) => {
      fs.writeFileSync(outFile, Buffer.from(gltf));
      const sizeKb = (fs.statSync(outFile).size / 1024).toFixed(1);
      console.log(`Successfully exported ${fileName} (${sizeKb} KB) to ${outFile}`);
      if (callback) callback();
    },
    (err) => {
      console.error(`Error exporting ${fileName}:`, err);
      process.exit(1);
    },
    { binary: true }
  );
}

console.log('Generating luxury hotel room models...');

const heroScene = new THREE.Scene();
heroScene.add(buildHeroRoom());
exportScene(heroScene, 'hero-room.glb', () => {
  const penthouseScene = new THREE.Scene();
  penthouseScene.add(buildPenthouseSuite());
  exportScene(penthouseScene, 'penthouse-suite.glb', () => {
    console.log('All GLB room models successfully generated.');
  });
});
