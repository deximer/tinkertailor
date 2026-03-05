"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { VignetteShader } from "three/addons/shaders/VignetteShader.js";
import { useDesignSession } from "@/lib/store/design-session";

// ── Constants ──

const MODEL_FILES: Record<string, string> = {
  heavy: "TT-PAT-SIL-038-000-000-140709-heavy.obj",
  light: "TT-PAT-SIL-038-000-000-140709-light.obj",
};

// Cache signed URLs so we don't re-fetch for the same variant
const signedUrlCache: Record<string, { url: string; expiresAt: number }> = {};

async function getModelUrl(variant: string): Promise<string> {
  const filename = MODEL_FILES[variant];
  if (!filename) throw new Error(`Unknown variant: ${variant}`);
  return getSignedModelUrl(variant, filename);
}

async function getSignedModelUrl(cacheKey: string, filename: string): Promise<string> {
  const cached = signedUrlCache[cacheKey];
  // Use cached URL if it expires more than 5 minutes from now
  if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cached.url;
  }

  const res = await fetch(
    `/api/models/signed-url?name=${encodeURIComponent(filename)}`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as Record<string, string>).error ?? `HTTP ${res.status}`,
    );
  }
  const { url } = (await res.json()) as { url: string };
  signedUrlCache[cacheKey] = { url, expiresAt: Date.now() + 3600 * 1000 };
  return url;
}

// ── Procedural fabric texture helpers ──

const S = 512;

function createCanvas(size = S): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  return c;
}

function canvasToTexture(canvas: HTMLCanvasElement, repeat = 8): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function texSilk(): THREE.CanvasTexture {
  const c = createCanvas(256);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#c8c8c8";
  ctx.fillRect(0, 0, 256, 256);
  const rng = seeded(101);
  for (let y = 0; y < 256; y++) {
    const v = 180 + rng() * 20;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, 256, 1);
  }
  return canvasToTexture(c, 10);
}

function texSatin(): THREE.CanvasTexture {
  const size = 256;
  const c = createCanvas(size);
  const ctx = c.getContext("2d")!;
  const rng = seeded(303);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 200 + Math.round(rng() * 12);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvasToTexture(c, 10);
}

function texCotton(): THREE.CanvasTexture {
  const c = createCanvas(128);
  const ctx = c.getContext("2d")!;
  const rng = seeded(202);
  ctx.fillStyle = "#b0b0b0";
  ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 4) {
    for (let x = 0; x < 128; x += 4) {
      const v = 155 + rng() * 40;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 3, 3);
    }
  }
  return canvasToTexture(c, 12);
}

function texLinen(): THREE.CanvasTexture {
  const c = createCanvas(256);
  const ctx = c.getContext("2d")!;
  const rng = seeded(303);
  ctx.fillStyle = "#b8b0a0";
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 3) {
    const v = 140 + rng() * 50;
    const h = 1 + Math.floor(rng() * 2);
    ctx.fillStyle = `rgb(${v},${v},${Math.round(v * 0.9)})`;
    ctx.fillRect(0, y, 256, h);
  }
  for (let x = 0; x < 256; x += 4) {
    const v = 150 + rng() * 40;
    ctx.fillStyle = `rgba(${v},${v},${Math.round(v * 0.9)},0.4)`;
    ctx.fillRect(x, 0, 1, 256);
  }
  for (let i = 0; i < 40; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    const w = 2 + rng() * 6;
    const v = 120 + rng() * 40;
    ctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
    ctx.fillRect(x, y, w, 2);
  }
  return canvasToTexture(c, 8);
}

function texChiffon(): THREE.CanvasTexture {
  const c = createCanvas(128);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#d8d8d8";
  ctx.fillRect(0, 0, 128, 128);
  const rng = seeded(404);
  for (let y = 0; y < 128; y += 6) {
    for (let x = 0; x < 128; x += 6) {
      const v = 200 + rng() * 30;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 5, 5);
      ctx.fillStyle = `rgb(${v - 15},${v - 15},${v - 15})`;
      ctx.fillRect(x + 5, y, 1, 6);
      ctx.fillRect(x, y + 5, 6, 1);
    }
  }
  return canvasToTexture(c, 12);
}

function texVelvet(): THREE.CanvasTexture {
  const c = createCanvas(256);
  const ctx = c.getContext("2d")!;
  const rng = seeded(505);
  for (let x = 0; x < 256; x++) {
    for (let y = 0; y < 256; y += 2) {
      const pile = Math.sin(x * 0.3 + rng() * 2) * 8;
      const v = 140 + pile + rng() * 15;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 1, 2);
    }
  }
  return canvasToTexture(c, 8);
}

function texDenim(): THREE.CanvasTexture {
  const c = createCanvas(128);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#a0a0a0";
  ctx.fillRect(0, 0, 128, 128);
  const rng = seeded(606);
  for (let y = 0; y < 128; y += 2) {
    for (let x = 0; x < 128; x += 2) {
      const diag = (x + y) % 8 < 4 ? 1 : 0;
      const v = diag ? 155 + rng() * 25 : 130 + rng() * 20;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  return canvasToTexture(c, 10);
}

function texWool(): THREE.CanvasTexture {
  const c = createCanvas(256);
  const ctx = c.getContext("2d")!;
  const rng = seeded(707);
  ctx.fillStyle = "#b0a898";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6000; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    const len = 3 + rng() * 8;
    const angle = rng() * Math.PI;
    const v = 100 + rng() * 80;
    ctx.strokeStyle = `rgba(${v},${v},${v},0.3)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  return canvasToTexture(c, 6);
}


// ── Data definitions ──

interface FabricDef {
  name: string;
  roughness: number;
  metalness: number;
  texture: () => THREE.CanvasTexture;
  sheen?: number;
  sheenRoughness?: number;
  sheenColor?: string;
  transmission?: number;
  thickness?: number;

}

const FABRICS: FabricDef[] = [
  { name: "Silk", roughness: 0.5, metalness: 0.0, texture: texSilk, sheen: 0.3, sheenRoughness: 0.4, transmission: 0.08, thickness: 0.5 },
  { name: "Satin", roughness: 0.4, metalness: 0.0, texture: texSatin },
  { name: "Cotton", roughness: 0.65, metalness: 0.0, texture: texCotton },
  { name: "Linen", roughness: 0.75, metalness: 0.0, texture: texLinen },
  { name: "Chiffon", roughness: 0.55, metalness: 0.0, texture: texChiffon, transmission: 0.15, thickness: 0.3, sheen: 0.1 },
  { name: "Velvet", roughness: 0.85, metalness: 0.0, texture: texVelvet, sheen: 0.9, sheenRoughness: 0.6, sheenColor: "#6a4a6a" },
  { name: "Denim", roughness: 0.7, metalness: 0.0, texture: texDenim },
  { name: "Wool", roughness: 0.8, metalness: 0.0, texture: texWool, sheen: 0.5, sheenRoughness: 0.8 },
];

interface ColorDef {
  name: string;
  hex: string;
}

const COLORS: ColorDef[] = [
  { name: "Champagne", hex: "#f5e6c8" },
  { name: "Blush", hex: "#e8b4b8" },
  { name: "Petal", hex: "#d4788a" },
  { name: "Crimson", hex: "#9b1a2a" },
  { name: "Garnet", hex: "#6e1423" },
  { name: "Bordeaux", hex: "#4a0e1a" },
  { name: "Mauve", hex: "#b07a8a" },
  { name: "Orchid", hex: "#8b3a6b" },
  { name: "Plum", hex: "#4a1040" },
  { name: "Midnight", hex: "#0e0e24" },
  { name: "Sapphire", hex: "#1a2a6e" },
  { name: "Emerald", hex: "#1a4a30" },
  { name: "Cognac", hex: "#8b4a20" },
  { name: "Gold", hex: "#c4943a" },
  { name: "Slate", hex: "#4a5060" },
  { name: "Noir", hex: "#0a0a0a" },
];

// ── HDR environment presets ──

interface HdriPreset {
  name: string;
  file: string;
}

const HDRI_PRESETS: HdriPreset[] = [
  { name: "Studio", file: "/hdri/studio.hdr" },
  { name: "Sunset", file: "/hdri/sunset.hdr" },
  { name: "Overcast", file: "/hdri/overcast.hdr" },
  { name: "Ballroom", file: "/hdri/ballroom.hdr" },
];

// ── Camera presets ──

interface CameraPreset {
  name: string;
  position: [number, number, number];
  target: [number, number, number];
}

const CAMERA_PRESETS: CameraPreset[] = [
  { name: "Front", position: [0, 50, 120], target: [0, 40, 0] },
  { name: "Back", position: [0, 50, -120], target: [0, 40, 0] },
  { name: "Side", position: [120, 50, 0], target: [0, 40, 0] },
  { name: "3/4", position: [85, 55, 85], target: [0, 40, 0] },
  { name: "Detail", position: [0, 75, 45], target: [0, 70, 0] },
];

// ── Lighting preset types ──

interface LightCfg {
  color: number;
  intensity: number;
  pos?: [number, number, number];
}

interface LightingPreset {
  name: string;
  ambient: LightCfg;
  key: LightCfg & { pos: [number, number, number] };
  fill: LightCfg & { pos: [number, number, number] };
  rim: LightCfg & { pos: [number, number, number] };
  exposure: number;
}

interface SceneDef {
  name: string;
  build: (
    scene: THREE.Scene,
    groundMat: THREE.MeshStandardMaterial,
    sceneProps: THREE.Group,
  ) => void;
  lighting: LightingPreset[];
}

// ── Scene helper ──

function mesh(
  geo: THREE.BufferGeometry,
  opts: THREE.MeshStandardMaterialParameters,
): THREE.Mesh {
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial(opts));
}

function makeGradient(topHex: string, bottomHex: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 2;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, topHex);
  g.addColorStop(1, bottomHex);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── Scene builders ──

function buildStudio(
  scene: THREE.Scene,
  groundMat: THREE.MeshStandardMaterial,
) {
  scene.background = new THREE.Color(0x1a1a1a);
  groundMat.color.set(0x222222);
}

function buildBeach(
  scene: THREE.Scene,
  groundMat: THREE.MeshStandardMaterial,
  sceneProps: THREE.Group,
) {
  scene.background = makeGradient("#87ceeb", "#e0d8b0");
  groundMat.color.set(0xd2b48c);
  groundMat.roughness = 1;

  const g = new THREE.Group();

  const water = mesh(new THREE.PlaneGeometry(400, 120), {
    color: 0x2288aa,
    roughness: 0.15,
    metalness: 0.3,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.2, -140);
  g.add(water);

  for (let i = 0; i < 5; i++) {
    const wave = mesh(new THREE.CylinderGeometry(0.3, 0.6, 160, 16), {
      color: 0xc8e8f0,
      roughness: 0.4,
      metalness: 0.1,
    });
    wave.rotation.z = Math.PI / 2;
    wave.position.set(0, 0.4, -82 - i * 12);
    g.add(wave);
  }

  const woodMat = { color: 0x8a7560, roughness: 0.85 };
  const log1 = mesh(new THREE.CylinderGeometry(0.8, 1.2, 30, 8), woodMat);
  log1.rotation.z = Math.PI / 2;
  log1.rotation.y = 0.4;
  log1.position.set(35, 0.8, 15);
  g.add(log1);

  const poleMat = { color: 0xddddcc, roughness: 0.5, metalness: 0.3 };
  const pole = mesh(new THREE.CylinderGeometry(0.5, 0.5, 70, 8), poleMat);
  pole.position.set(-35, 35, -20);
  g.add(pole);
  const canopy = mesh(new THREE.ConeGeometry(28, 10, 8, 1, true), {
    color: 0xcc4444,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  canopy.position.set(-35, 68, -20);
  g.add(canopy);

  const shellMat = { color: 0xf0e8d8, roughness: 0.4, metalness: 0.05 };
  (
    [
      [15, 8],
      [-12, 20],
      [25, -5],
      [-20, 12],
      [8, 25],
    ] as [number, number][]
  ).forEach(([x, z]) => {
    const shell = mesh(
      new THREE.SphereGeometry(0.6 + Math.random() * 0.4, 6, 4),
      shellMat,
    );
    shell.scale.set(1, 0.3, 1);
    shell.position.set(x, 0.2, z);
    g.add(shell);
  });

  sceneProps.add(g);
}

function buildWedding(
  scene: THREE.Scene,
  groundMat: THREE.MeshStandardMaterial,
  sceneProps: THREE.Group,
) {
  scene.background = makeGradient("#f5f0eb", "#e8e0d8");
  groundMat.color.set(0xe8e0d4);
  groundMat.roughness = 0.6;

  const g = new THREE.Group();
  const goldMat = { color: 0xc8a860, roughness: 0.3, metalness: 0.5 };

  ([-28, 28] as number[]).forEach((x) => {
    const col = mesh(new THREE.CylinderGeometry(1.2, 1.2, 85, 12), goldMat);
    col.position.set(x, 42.5, -35);
    g.add(col);
  });

  const archCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-28, 85, -35),
    new THREE.Vector3(-18, 95, -35),
    new THREE.Vector3(0, 98, -35),
    new THREE.Vector3(18, 95, -35),
    new THREE.Vector3(28, 85, -35),
  ]);
  const archGeo = new THREE.TubeGeometry(archCurve, 24, 1.2, 8, false);
  const arch = new THREE.Mesh(
    archGeo,
    new THREE.MeshStandardMaterial(goldMat),
  );
  g.add(arch);

  const flowerColors = [0xf0c0c8, 0xffffff, 0xe8a0b0, 0xf5e0e0, 0xd4f0d4];
  for (let t = 0; t <= 1; t += 0.06) {
    const p = archCurve.getPointAt(t);
    const fc = flowerColors[Math.floor(Math.random() * flowerColors.length)];
    const flower = mesh(
      new THREE.SphereGeometry(1.5 + Math.random() * 2, 6, 5),
      { color: fc, roughness: 0.8 },
    );
    flower.position.copy(p);
    flower.position.x += (Math.random() - 0.5) * 4;
    flower.position.y += (Math.random() - 0.5) * 3;
    g.add(flower);
  }

  ([-28, 28] as number[]).forEach((x) => {
    for (let i = 0; i < 12; i++) {
      const fc = flowerColors[Math.floor(Math.random() * flowerColors.length)];
      const f = mesh(
        new THREE.SphereGeometry(1.5 + Math.random() * 2, 6, 5),
        { color: fc, roughness: 0.8 },
      );
      f.position.set(
        x + (Math.random() - 0.5) * 10,
        1 + Math.random() * 6,
        -35 + (Math.random() - 0.5) * 8,
      );
      g.add(f);
    }
  });

  ([-18, -12, 12, 18] as number[]).forEach((x) => {
    const holder = mesh(
      new THREE.CylinderGeometry(2.5, 3, 1.5, 12),
      goldMat,
    );
    holder.position.set(x, 0.75, -10);
    g.add(holder);
    const h = 12 + Math.random() * 6;
    const candle = mesh(new THREE.CylinderGeometry(1.2, 1.2, h, 8), {
      color: 0xfff8ee,
      roughness: 0.6,
    });
    candle.position.set(x, 1.5 + h / 2, -10);
    g.add(candle);
    const flame = mesh(new THREE.SphereGeometry(0.6, 6, 6), {
      color: 0xffcc44,
      roughness: 0.2,
      emissive: 0xffaa22,
      emissiveIntensity: 2,
    });
    flame.scale.set(0.7, 1.3, 0.7);
    flame.position.set(x, 1.5 + h + 0.5, -10);
    g.add(flame);
  });

  const petalMat = { color: 0xe0a0a8, roughness: 0.7 };
  for (let i = 0; i < 40; i++) {
    const petal = mesh(
      new THREE.CircleGeometry(0.5 + Math.random() * 0.5, 5),
      { ...petalMat, side: THREE.DoubleSide },
    );
    petal.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.3;
    petal.rotation.z = Math.random() * Math.PI;
    petal.position.set(
      (Math.random() - 0.5) * 50,
      0.1,
      (Math.random() - 0.5) * 40,
    );
    g.add(petal);
  }

  sceneProps.add(g);
}

function buildKeynote(
  scene: THREE.Scene,
  groundMat: THREE.MeshStandardMaterial,
  sceneProps: THREE.Group,
) {
  scene.background = new THREE.Color(0x0a0a0e);
  groundMat.color.set(0x141418);
  groundMat.roughness = 0.3;

  const g = new THREE.Group();
  const stageMat = { color: 0x1a1a20, roughness: 0.2, metalness: 0.1 };

  const stage = mesh(new THREE.BoxGeometry(120, 3, 80), stageMat);
  stage.position.set(0, 1.5, -20);
  g.add(stage);

  const edgeLight = mesh(new THREE.BoxGeometry(120, 0.3, 0.5), {
    color: 0x4488ff,
    roughness: 0.1,
    emissive: 0x2244aa,
    emissiveIntensity: 1.5,
  });
  edgeLight.position.set(0, 3.15, 20);
  g.add(edgeLight);

  const screen = mesh(new THREE.BoxGeometry(100, 60, 1), {
    color: 0x111118,
    roughness: 0.4,
    metalness: 0.05,
  });
  screen.position.set(0, 33, -55);
  g.add(screen);

  const glowMat = {
    color: 0x3366cc,
    roughness: 0.1,
    emissive: 0x2244aa,
    emissiveIntensity: 0.8,
  };
  const tb = mesh(new THREE.BoxGeometry(102, 0.5, 0.5), glowMat);
  tb.position.set(0, 63, -54.5);
  g.add(tb);
  const bb = mesh(new THREE.BoxGeometry(102, 0.5, 0.5), glowMat);
  bb.position.set(0, 3, -54.5);
  g.add(bb);
  ([-51, 51] as number[]).forEach((x) => {
    const sb = mesh(new THREE.BoxGeometry(0.5, 60, 0.5), glowMat);
    sb.position.set(x, 33, -54.5);
    g.add(sb);
  });

  const podium = mesh(new THREE.BoxGeometry(14, 40, 10), {
    color: 0x222230,
    roughness: 0.3,
    metalness: 0.15,
  });
  podium.position.set(35, 23, -5);
  g.add(podium);

  sceneProps.add(g);
}

function buildDinnerDate(
  scene: THREE.Scene,
  groundMat: THREE.MeshStandardMaterial,
  sceneProps: THREE.Group,
) {
  scene.background = makeGradient("#1a1015", "#2a1820");
  groundMat.color.set(0x2a1a15);
  groundMat.roughness = 0.5;

  const g = new THREE.Group();

  const tableMat = { color: 0x3a2820, roughness: 0.4, metalness: 0.02 };
  const tableTop = mesh(
    new THREE.CylinderGeometry(18, 18, 1.5, 24),
    tableMat,
  );
  tableTop.position.set(35, 30, -10);
  g.add(tableTop);
  const tableLeg = mesh(
    new THREE.CylinderGeometry(2, 3, 29, 12),
    tableMat,
  );
  tableLeg.position.set(35, 14.5, -10);
  g.add(tableLeg);

  const cloth = mesh(new THREE.CylinderGeometry(19, 20, 0.3, 24), {
    color: 0xe8ddd0,
    roughness: 0.7,
  });
  cloth.position.set(35, 30.8, -10);
  g.add(cloth);

  const candleMat = { color: 0xc8a860, roughness: 0.3, metalness: 0.5 };
  const candleBase = mesh(
    new THREE.CylinderGeometry(3, 4, 2, 12),
    candleMat,
  );
  candleBase.position.set(35, 32, -10);
  g.add(candleBase);
  const candleStem = mesh(
    new THREE.CylinderGeometry(0.6, 0.8, 12, 8),
    candleMat,
  );
  candleStem.position.set(35, 39, -10);
  g.add(candleStem);

  (
    [
      [-3, 0],
      [3, 0],
      [0, 3],
    ] as [number, number][]
  ).forEach(([dx, dz]) => {
    const arm = mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 6, 6),
      candleMat,
    );
    arm.rotation.z = dx * 0.15;
    arm.rotation.x = dz * -0.15;
    arm.position.set(35 + dx, 44, -10 + dz);
    g.add(arm);
    const candle = mesh(new THREE.CylinderGeometry(0.6, 0.6, 6, 8), {
      color: 0xfff8ee,
      roughness: 0.6,
    });
    candle.position.set(35 + dx * 1.8, 49, -10 + dz * 1.8);
    g.add(candle);
    const flame = mesh(new THREE.SphereGeometry(0.4, 6, 6), {
      color: 0xffcc44,
      emissive: 0xffaa22,
      emissiveIntensity: 3,
    });
    flame.scale.set(0.6, 1.2, 0.6);
    flame.position.set(35 + dx * 1.8, 52.5, -10 + dz * 1.8);
    g.add(flame);
  });

  const glassMat = {
    color: 0xd8dce8,
    roughness: 0.05,
    metalness: 0.3,
    transparent: true,
    opacity: 0.6,
  };
  (
    [
      [28, -4],
      [42, -4],
    ] as [number, number][]
  ).forEach(([x, z]) => {
    const gBase = mesh(
      new THREE.CylinderGeometry(1.8, 1.8, 0.3, 12),
      glassMat,
    );
    gBase.position.set(x, 31, z);
    g.add(gBase);
    const gStem = mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 5, 6),
      glassMat,
    );
    gStem.position.set(x, 33.6, z);
    g.add(gStem);
    const gBowl = mesh(
      new THREE.CylinderGeometry(2.5, 0.5, 5, 12, 1, true),
      glassMat,
    );
    gBowl.position.set(x, 38.5, z);
    g.add(gBowl);
  });

  const bottleMat = { color: 0x1a2a1a, roughness: 0.2, metalness: 0.1 };
  const bottle = mesh(
    new THREE.CylinderGeometry(1.8, 1.8, 12, 12),
    bottleMat,
  );
  bottle.position.set(35, 37.5, -17);
  g.add(bottle);
  const neck = mesh(new THREE.CylinderGeometry(0.6, 1.2, 6, 8), bottleMat);
  neck.position.set(35, 46.5, -17);
  g.add(neck);

  const chairMat = { color: 0x4a3228, roughness: 0.5 };
  const seat = mesh(new THREE.BoxGeometry(14, 1.5, 14), chairMat);
  seat.position.set(-30, 18, 5);
  g.add(seat);
  (
    [
      [-6, -6],
      [6, -6],
      [-6, 6],
      [6, 6],
    ] as [number, number][]
  ).forEach(([dx, dz]) => {
    const chairLeg = mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 17.5, 6),
      chairMat,
    );
    chairLeg.position.set(-30 + dx, 8.75, 5 + dz);
    g.add(chairLeg);
  });
  const back = mesh(new THREE.BoxGeometry(14, 25, 1.5), chairMat);
  back.position.set(-30, 31, -2);
  g.add(back);

  sceneProps.add(g);
}

function buildConcert(
  scene: THREE.Scene,
  groundMat: THREE.MeshStandardMaterial,
  sceneProps: THREE.Group,
) {
  scene.background = new THREE.Color(0x050508);
  groundMat.color.set(0x0a0a10);
  groundMat.roughness = 0.25;

  const g = new THREE.Group();

  const stageFloor = mesh(new THREE.BoxGeometry(140, 2, 80), {
    color: 0x0e0e14,
    roughness: 0.15,
    metalness: 0.2,
  });
  stageFloor.position.set(0, 1, -20);
  g.add(stageFloor);

  const ledColors = [0xff2288, 0x4422ff, 0x22ffcc, 0xff8822];
  for (let i = 0; i < 8; i++) {
    const led = mesh(new THREE.BoxGeometry(15, 0.4, 0.4), {
      color: ledColors[i % ledColors.length],
      emissive: ledColors[i % ledColors.length],
      emissiveIntensity: 2,
    });
    led.position.set(-52.5 + i * 15, 2.2, 20);
    g.add(led);
  }

  ([-55, 55] as number[]).forEach((x) => {
    for (let j = 0; j < 3; j++) {
      const cab = mesh(new THREE.BoxGeometry(16, 14, 12), {
        color: 0x1a1a1a,
        roughness: 0.7,
      });
      cab.position.set(x, 9 + j * 14, -30);
      g.add(cab);
      const cone = mesh(new THREE.CircleGeometry(5, 16), {
        color: 0x222222,
        roughness: 0.5,
        metalness: 0.2,
      });
      cone.position.set(x, 9 + j * 14, -23.9);
      g.add(cone);
    }
  });

  const trussMat = { color: 0x555555, roughness: 0.3, metalness: 0.7 };
  const truss = mesh(new THREE.BoxGeometry(130, 3, 3), trussMat);
  truss.position.set(0, 90, -10);
  g.add(truss);
  ([-60, 60] as number[]).forEach((x) => {
    const tv = mesh(new THREE.CylinderGeometry(1, 1, 88, 8), trussMat);
    tv.position.set(x, 46, -10);
    g.add(tv);
  });

  const stageColors = [0xff2288, 0x4422ff, 0x22ffcc, 0xffcc22, 0xff2288];
  ([-40, -20, 20, 40] as number[]).forEach((x, i) => {
    const housing = mesh(new THREE.CylinderGeometry(2, 3, 5, 8), {
      color: 0x333333,
      roughness: 0.4,
      metalness: 0.5,
    });
    housing.position.set(x, 87, -10);
    g.add(housing);
    const beam = mesh(new THREE.ConeGeometry(18, 82, 12, 1, true), {
      color: stageColors[i],
      transparent: true,
      opacity: 0.04,
      side: THREE.DoubleSide,
    });
    beam.position.set(x, 43, -10);
    g.add(beam);
  });

  ([-15, 15] as number[]).forEach((x) => {
    const wedge = mesh(new THREE.BoxGeometry(10, 5, 6), {
      color: 0x1a1a1a,
      roughness: 0.7,
    });
    wedge.rotation.x = -0.3;
    wedge.position.set(x, 3.5, 12);
    g.add(wedge);
  });

  sceneProps.add(g);
}

// ── Scene + lighting definitions ──

const SCENES: SceneDef[] = [
  {
    name: "Studio",
    build: buildStudio,
    lighting: [
      { name: "Standard", ambient: { color: 0xffffff, intensity: 0.4 }, key: { color: 0xffffff, intensity: 1.2, pos: [30, 80, 60] }, fill: { color: 0xc4b5a0, intensity: 0.5, pos: [-40, 60, -30] }, rim: { color: 0x8b9dc3, intensity: 0.3, pos: [0, 30, -80] }, exposure: 1.2 },
      { name: "Natural", ambient: { color: 0xf5f0e8, intensity: 0.6 }, key: { color: 0xfff8e7, intensity: 1.0, pos: [50, 100, 40] }, fill: { color: 0xc8d8e8, intensity: 0.35, pos: [-30, 40, 20] }, rim: { color: 0xe8dcc8, intensity: 0.15, pos: [0, 20, -60] }, exposure: 1.3 },
      { name: "Dramatic", ambient: { color: 0x202020, intensity: 0.15 }, key: { color: 0xffffff, intensity: 1.8, pos: [60, 90, 30] }, fill: { color: 0x1a1a2e, intensity: 0.1, pos: [-50, 40, -20] }, rim: { color: 0xffffff, intensity: 0.6, pos: [-20, 50, -70] }, exposure: 1.0 },
      { name: "Cool", ambient: { color: 0xd0e0f0, intensity: 0.45 }, key: { color: 0xe8f0ff, intensity: 1.1, pos: [30, 80, 60] }, fill: { color: 0x8899bb, intensity: 0.4, pos: [-40, 60, -30] }, rim: { color: 0x6688bb, intensity: 0.35, pos: [0, 30, -80] }, exposure: 1.15 },
    ],
  },
  {
    name: "Beach",
    build: buildBeach,
    lighting: [
      { name: "Morning", ambient: { color: 0xfff0d8, intensity: 0.5 }, key: { color: 0xffe8c0, intensity: 1.0, pos: [80, 40, 40] }, fill: { color: 0x88bbdd, intensity: 0.35, pos: [-30, 40, 20] }, rim: { color: 0xffd8a0, intensity: 0.2, pos: [-60, 20, -40] }, exposure: 1.25 },
      { name: "Midday", ambient: { color: 0xfff8e0, intensity: 0.6 }, key: { color: 0xfff5d0, intensity: 1.4, pos: [10, 100, 30] }, fill: { color: 0x88bbdd, intensity: 0.35, pos: [-30, 40, 20] }, rim: { color: 0xffe8c0, intensity: 0.2, pos: [0, 20, -60] }, exposure: 1.4 },
      { name: "Golden Hour", ambient: { color: 0xffddaa, intensity: 0.45 }, key: { color: 0xffaa55, intensity: 1.3, pos: [90, 25, 20] }, fill: { color: 0x6688aa, intensity: 0.3, pos: [-40, 30, 10] }, rim: { color: 0xff8833, intensity: 0.4, pos: [-50, 15, -30] }, exposure: 1.2 },
      { name: "Sunset", ambient: { color: 0xff8855, intensity: 0.35 }, key: { color: 0xff6633, intensity: 1.0, pos: [100, 10, 10] }, fill: { color: 0x334466, intensity: 0.25, pos: [-40, 30, 20] }, rim: { color: 0xff4422, intensity: 0.5, pos: [-60, 8, -20] }, exposure: 1.1 },
      { name: "Night", ambient: { color: 0x0a1020, intensity: 0.15 }, key: { color: 0x8899cc, intensity: 0.4, pos: [20, 80, 40] }, fill: { color: 0x101830, intensity: 0.1, pos: [-30, 30, 20] }, rim: { color: 0x6677aa, intensity: 0.25, pos: [0, 40, -60] }, exposure: 0.7 },
    ],
  },
  {
    name: "Wedding",
    build: buildWedding,
    lighting: [
      { name: "Ceremony", ambient: { color: 0xfff5ee, intensity: 0.55 }, key: { color: 0xfff0e0, intensity: 1.0, pos: [30, 80, 50] }, fill: { color: 0xeeddcc, intensity: 0.45, pos: [-30, 50, 20] }, rim: { color: 0xffe8d8, intensity: 0.2, pos: [0, 30, -60] }, exposure: 1.3 },
      { name: "Golden Hour", ambient: { color: 0xffe0bb, intensity: 0.5 }, key: { color: 0xffcc77, intensity: 1.1, pos: [70, 30, 40] }, fill: { color: 0xccaa88, intensity: 0.4, pos: [-30, 40, 10] }, rim: { color: 0xffaa66, intensity: 0.3, pos: [-40, 20, -50] }, exposure: 1.25 },
      { name: "Reception", ambient: { color: 0xffe8d0, intensity: 0.35 }, key: { color: 0xffddaa, intensity: 0.9, pos: [20, 60, 40] }, fill: { color: 0x443322, intensity: 0.2, pos: [-30, 40, -20] }, rim: { color: 0xffcc88, intensity: 0.25, pos: [0, 30, -60] }, exposure: 1.1 },
      { name: "Twilight", ambient: { color: 0x2a2040, intensity: 0.2 }, key: { color: 0xeeccaa, intensity: 0.7, pos: [30, 50, 40] }, fill: { color: 0x302848, intensity: 0.2, pos: [-40, 30, -20] }, rim: { color: 0x8866aa, intensity: 0.35, pos: [0, 30, -70] }, exposure: 0.95 },
    ],
  },
  {
    name: "Keynote",
    build: buildKeynote,
    lighting: [
      { name: "Presentation", ambient: { color: 0x101020, intensity: 0.15 }, key: { color: 0xffffff, intensity: 2.0, pos: [0, 100, 30] }, fill: { color: 0x1a1a30, intensity: 0.1, pos: [-60, 40, -20] }, rim: { color: 0xffffff, intensity: 0.7, pos: [-20, 50, -70] }, exposure: 0.95 },
      { name: "Q&A", ambient: { color: 0x181828, intensity: 0.25 }, key: { color: 0xffffff, intensity: 1.4, pos: [20, 80, 40] }, fill: { color: 0x2a2a40, intensity: 0.25, pos: [-40, 50, 10] }, rim: { color: 0xddddff, intensity: 0.3, pos: [-10, 40, -60] }, exposure: 1.0 },
      { name: "Demo", ambient: { color: 0x0a0a18, intensity: 0.1 }, key: { color: 0x4488ff, intensity: 1.0, pos: [0, 60, 50] }, fill: { color: 0x0a0a20, intensity: 0.08, pos: [-50, 40, -20] }, rim: { color: 0x4488ff, intensity: 0.5, pos: [0, 40, -70] }, exposure: 0.85 },
      { name: "Afterparty", ambient: { color: 0x180820, intensity: 0.2 }, key: { color: 0xff44aa, intensity: 1.0, pos: [40, 60, 30] }, fill: { color: 0x4422ff, intensity: 0.5, pos: [-40, 50, 20] }, rim: { color: 0x22ffcc, intensity: 0.4, pos: [0, 30, -60] }, exposure: 0.9 },
    ],
  },
  {
    name: "Dinner Date",
    build: buildDinnerDate,
    lighting: [
      { name: "Candlelit", ambient: { color: 0x1a0e08, intensity: 0.2 }, key: { color: 0xffcc88, intensity: 0.8, pos: [20, 50, 40] }, fill: { color: 0x301818, intensity: 0.25, pos: [-40, 30, -20] }, rim: { color: 0x443322, intensity: 0.35, pos: [0, 40, -70] }, exposure: 1.05 },
      { name: "Romantic", ambient: { color: 0x200e10, intensity: 0.25 }, key: { color: 0xffaa77, intensity: 0.7, pos: [15, 40, 35] }, fill: { color: 0x4a2028, intensity: 0.3, pos: [-30, 35, -15] }, rim: { color: 0xcc6655, intensity: 0.3, pos: [10, 30, -60] }, exposure: 1.0 },
      { name: "Last Call", ambient: { color: 0x0a0808, intensity: 0.12 }, key: { color: 0xffddaa, intensity: 0.5, pos: [25, 35, 30] }, fill: { color: 0x181010, intensity: 0.1, pos: [-40, 20, -20] }, rim: { color: 0x332820, intensity: 0.2, pos: [0, 25, -60] }, exposure: 0.8 },
      { name: "Night Out", ambient: { color: 0x100a15, intensity: 0.18 }, key: { color: 0xeebb88, intensity: 0.9, pos: [30, 55, 45] }, fill: { color: 0x281828, intensity: 0.2, pos: [-35, 40, -15] }, rim: { color: 0x6644aa, intensity: 0.35, pos: [0, 35, -65] }, exposure: 0.95 },
    ],
  },
  {
    name: "Concert",
    build: buildConcert,
    lighting: [
      { name: "Opening Act", ambient: { color: 0x0a0810, intensity: 0.1 }, key: { color: 0x4422ff, intensity: 1.0, pos: [40, 70, 30] }, fill: { color: 0x220044, intensity: 0.3, pos: [-40, 50, 20] }, rim: { color: 0x8844ff, intensity: 0.4, pos: [0, 30, -70] }, exposure: 0.85 },
      { name: "Headliner", ambient: { color: 0x100818, intensity: 0.12 }, key: { color: 0xff44aa, intensity: 1.2, pos: [40, 80, 30] }, fill: { color: 0x4422ff, intensity: 0.6, pos: [-40, 60, 20] }, rim: { color: 0x22ffcc, intensity: 0.5, pos: [0, 30, -70] }, exposure: 0.9 },
      { name: "Encore", ambient: { color: 0x181018, intensity: 0.15 }, key: { color: 0xffffff, intensity: 1.8, pos: [0, 90, 20] }, fill: { color: 0xff2288, intensity: 0.4, pos: [-50, 50, 10] }, rim: { color: 0x22ccff, intensity: 0.5, pos: [30, 40, -60] }, exposure: 1.0 },
      { name: "Afterparty", ambient: { color: 0x180818, intensity: 0.2 }, key: { color: 0xff8822, intensity: 0.9, pos: [30, 50, 40] }, fill: { color: 0xcc2288, intensity: 0.4, pos: [-40, 40, 10] }, rim: { color: 0x22ffaa, intensity: 0.35, pos: [10, 30, -50] }, exposure: 0.95 },
    ],
  },
];

// ── Component ──

interface ModelViewerProps {
  /** When true, subscribes to design session store and hides showcase sidebar */
  designMode?: boolean;
}

export default function ModelViewer({ designMode = false }: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const ambientRef = useRef<THREE.AmbientLight | null>(null);
  const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
  const fillLightRef = useRef<THREE.DirectionalLight | null>(null);
  const rimLightRef = useRef<THREE.DirectionalLight | null>(null);
  const groundMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const scenePropsRef = useRef<THREE.Group | null>(null);
  const garmentMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const currentModelRef = useRef<THREE.Group | null>(null);
  const modelCacheRef = useRef<Record<string, THREE.Group>>({});
  const textureCacheRef = useRef<Record<number, THREE.CanvasTexture>>({});
  const animFrameRef = useRef<number>(0);
  const pmremRef = useRef<THREE.PMREMGenerator | null>(null);
  const envMapRef = useRef<THREE.Texture | null>(null);
  const shadowGroundRef = useRef<THREE.Mesh | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const vignettePassRef = useRef<ShaderPass | null>(null);
  const targetCameraPosRef = useRef<THREE.Vector3 | null>(null);
  const targetLookAtRef = useRef<THREE.Vector3 | null>(null);
  const isAnimatingCameraRef = useRef(false);
  const turntableRef = useRef(false);
  const sceneBackgroundRef = useRef<THREE.Color | THREE.Texture | null>(null);

  const [activeVariant, setActiveVariant] = useState("heavy");
  const [activeCameraPreset, setActiveCameraPreset] = useState(-1);
  const [activeFabricIdx, setActiveFabricIdx] = useState(0);
  const [activeColorIdx, setActiveColorIdx] = useState(3);
  const [activeSceneIdx, setActiveSceneIdx] = useState(0);
  const [activeLightingIdx, setActiveLightingIdx] = useState(0);
  const [sliderAngle, setSliderAngle] = useState(27);
  const [sliderHeight, setSliderHeight] = useState(80);
  const [sliderIntensity, setSliderIntensity] = useState(120);
  const [sliderWarmth, setSliderWarmth] = useState(50);
  const [turntable, setTurntable] = useState(false);
  const [activeHdriIdx, setActiveHdriIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Post-processing state
  const [bloomEnabled, setBloomEnabled] = useState(false);
  const [bloomThreshold, setBloomThreshold] = useState(0.85);
  const [bloomStrength, setBloomStrength] = useState(0.3);
  const [bloomRadius, setBloomRadius] = useState(0.4);
  const [vignetteEnabled, setVignetteEnabled] = useState(true);
  const [vignetteOffset, setVignetteOffset] = useState(0.2);
  const [vignetteDarkness, setVignetteDarkness] = useState(1.4);

  // Material controls state — initialised from first fabric's defaults
  const [matSheen, setMatSheen] = useState(FABRICS[0].sheen ?? 0);
  const [matSheenRoughness, setMatSheenRoughness] = useState(FABRICS[0].sheenRoughness ?? 0);
  const [matSheenColor, setMatSheenColor] = useState(FABRICS[0].sheenColor ?? "#ffffff");
  const [matTransmission, setMatTransmission] = useState(FABRICS[0].transmission ?? 0);
  const [matThickness, setMatThickness] = useState(FABRICS[0].thickness ?? 0);

  // Design session store subscription
  const selectedComponentIds = useDesignSession((s) => s.selectedComponentIds);
  const designModelsRef = useRef<THREE.Group[]>([]);
  const designLoadAbortRef = useRef(0);

  // Load component models from design session
  const loadDesignModels = useCallback(
    async (componentIds: string[]) => {
      const scene = sceneRef.current;
      const mat = garmentMatRef.current;
      if (!scene || !mat) return;

      // Bump abort counter to cancel stale loads
      const loadId = ++designLoadAbortRef.current;

      // Remove previous design models
      for (const m of designModelsRef.current) {
        scene.remove(m);
      }
      designModelsRef.current = [];

      if (componentIds.length === 0) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError(null);

      // Fetch component data to get modelPaths
      const params = new URLSearchParams({
        compatible_with: componentIds.join(","),
      });
      let selectedComps: {
        id: string;
        modelPath: string | null;
      }[] = [];

      try {
        const res = await fetch(`/api/components?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          selectedComponents: { id: string; modelPath: string | null }[];
        };
        selectedComps = data.selectedComponents;
      } catch (err) {
        if (loadId !== designLoadAbortRef.current) return;
        setLoadError(
          `Failed to fetch components: ${err instanceof Error ? err.message : String(err)}`,
        );
        setLoading(false);
        return;
      }

      if (loadId !== designLoadAbortRef.current) return;

      // Load each component's model
      const loader = new OBJLoader();
      const loadedModels: THREE.Group[] = [];

      for (const comp of selectedComps) {
        if (!comp.modelPath) continue;
        if (loadId !== designLoadAbortRef.current) return;

        try {
          const url = await getSignedModelUrl(comp.id, comp.modelPath);
          const obj = await new Promise<THREE.Group>((resolve, reject) => {
            loader.load(url, resolve, undefined, reject);
          });

          obj.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              (child as THREE.Mesh).material = mat;
              (child as THREE.Mesh).castShadow = true;
              (child as THREE.Mesh).receiveShadow = true;
            }
          });

          loadedModels.push(obj);
          scene.add(obj);
        } catch {
          // Skip components whose models fail to load
          console.warn(`Failed to load model for component ${comp.id}`);
        }
      }

      if (loadId !== designLoadAbortRef.current) {
        // Stale — clean up
        for (const m of loadedModels) scene.remove(m);
        return;
      }

      designModelsRef.current = loadedModels;

      // Hide the showcase model when design models are active
      if (loadedModels.length > 0 && currentModelRef.current) {
        scene.remove(currentModelRef.current);
      }

      setLoading(false);
    },
    [],
  );

  // When design session component selection changes, load models
  useEffect(() => {
    if (!designMode) return;

    if (selectedComponentIds.length === 0) {
      // No components selected — restore showcase model
      const scene = sceneRef.current;
      if (scene) {
        for (const m of designModelsRef.current) scene.remove(m);
        designModelsRef.current = [];
      }
      if (currentModelRef.current && scene && !scene.children.includes(currentModelRef.current)) {
        scene.add(currentModelRef.current);
      }
      return;
    }

    loadDesignModels(selectedComponentIds);
  }, [designMode, selectedComponentIds, loadDesignModels]);

  // Design mode: respond to fabric selection
  const selectedFabricCode = useDesignSession((s) => s.selectedFabricCode);

  useEffect(() => {
    if (!designMode || !selectedFabricCode) return;

    const mat = garmentMatRef.current;
    if (!mat) return;

    // Map fabric code prefix to closest FABRICS texture preset
    const codeUpper = selectedFabricCode.toUpperCase();
    let fabricIdx = 0; // default to Silk
    if (codeUpper.startsWith("SS") || codeUpper.includes("SATIN")) fabricIdx = 1;
    else if (codeUpper.startsWith("CC") || codeUpper.includes("COTTON")) fabricIdx = 2;
    else if (codeUpper.startsWith("LI") || codeUpper.includes("LINEN")) fabricIdx = 3;
    else if (codeUpper.startsWith("CH") || codeUpper.includes("CHIFFON")) fabricIdx = 4;
    else if (codeUpper.startsWith("VE") || codeUpper.includes("VELVET")) fabricIdx = 5;
    else if (codeUpper.startsWith("DE") || codeUpper.includes("DENIM")) fabricIdx = 6;
    else if (codeUpper.startsWith("WO") || codeUpper.includes("WOOL")) fabricIdx = 7;
    // SC/Silk Crepe and default → Silk (0)

    const fab = FABRICS[fabricIdx];
    if (!textureCacheRef.current[fabricIdx]) {
      textureCacheRef.current[fabricIdx] = fab.texture();
    }
    mat.map = textureCacheRef.current[fabricIdx];
    mat.roughness = fab.roughness;
    mat.metalness = fab.metalness;
    mat.sheen = fab.sheen ?? 0;
    mat.sheenRoughness = fab.sheenRoughness ?? 0;
    mat.sheenColor.set(fab.sheenColor ?? "#ffffff");
    mat.transmission = fab.transmission ?? 0;
    mat.thickness = fab.thickness ?? 0;
    mat.needsUpdate = true;

    // Sync material control state
    setActiveFabricIdx(fabricIdx);
    setMatSheen(fab.sheen ?? 0);
    setMatSheenRoughness(fab.sheenRoughness ?? 0);
    setMatSheenColor(fab.sheenColor ?? "#ffffff");
    setMatTransmission(fab.transmission ?? 0);
    setMatThickness(fab.thickness ?? 0);
  }, [designMode, selectedFabricCode]);

  // Apply lighting preset
  const applyLighting = useCallback((preset: LightingPreset) => {
    const ambient = ambientRef.current;
    const keyLight = keyLightRef.current;
    const fillLight = fillLightRef.current;
    const rimLight = rimLightRef.current;
    const renderer = rendererRef.current;
    if (!ambient || !keyLight || !fillLight || !rimLight || !renderer) return;

    ambient.color.set(preset.ambient.color);
    ambient.intensity = preset.ambient.intensity;
    keyLight.color.set(preset.key.color);
    keyLight.intensity = preset.key.intensity;
    keyLight.position.set(...preset.key.pos);
    fillLight.color.set(preset.fill.color);
    fillLight.intensity = preset.fill.intensity;
    fillLight.position.set(...preset.fill.pos);
    rimLight.color.set(preset.rim.color);
    rimLight.intensity = preset.rim.intensity;
    rimLight.position.set(...preset.rim.pos);
    renderer.toneMappingExposure = preset.exposure;

    const [kx, , kz] = preset.key.pos;
    const angle = ((Math.atan2(kx, kz) * 180) / Math.PI + 360) % 360;
    setSliderAngle(Math.round(angle));
    setSliderHeight(Math.round(preset.key.pos[1]));
    setSliderIntensity(Math.round(preset.key.intensity * 100));
    setSliderWarmth(50);
  }, []);

  // Load HDR environment map
  const loadHDR = useCallback((path: string) => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    if (!scene || !renderer) return;

    if (!pmremRef.current) {
      pmremRef.current = new THREE.PMREMGenerator(renderer);
      pmremRef.current.compileEquirectangularShader();
    }

    const loader = new RGBELoader();
    loader.load(path, (hdr) => {
      // Dispose previous env map
      if (envMapRef.current) {
        envMapRef.current.dispose();
      }
      const envMap = pmremRef.current!.fromEquirectangular(hdr).texture;
      scene.environment = envMap;
      envMapRef.current = envMap;
      hdr.dispose();
    });
  }, []);

  // Apply material
  const applyMaterial = useCallback(
    (fabricIdx: number, colorIdx: number) => {
      const mat = garmentMatRef.current;
      if (!mat) return;
      const fab = FABRICS[fabricIdx];
      const col = COLORS[colorIdx];

      if (!textureCacheRef.current[fabricIdx]) {
        textureCacheRef.current[fabricIdx] = fab.texture();
      }

      mat.map = textureCacheRef.current[fabricIdx];
      mat.color.set(col.hex);
      mat.roughness = fab.roughness;
      mat.metalness = fab.metalness;
      mat.sheen = fab.sheen ?? 0;
      mat.sheenRoughness = fab.sheenRoughness ?? 0;
      mat.sheenColor.set(fab.sheenColor ?? "#ffffff");
      mat.transmission = fab.transmission ?? 0;
      mat.thickness = fab.thickness ?? 0;

      mat.needsUpdate = true;
    },
    [],
  );

  // Load model
  const loadModel = useCallback(
    async (variant: string) => {
      const scene = sceneRef.current;
      const mat = garmentMatRef.current;
      if (!scene || !mat) return;

      setLoading(true);
      setLoadError(null);
      setLoadProgress(0);

      if (currentModelRef.current) {
        scene.remove(currentModelRef.current);
      }

      if (modelCacheRef.current[variant]) {
        const cached = modelCacheRef.current[variant];
        currentModelRef.current = cached;
        scene.add(cached);
        setLoading(false);
        return;
      }

      let modelUrl: string;
      try {
        modelUrl = await getModelUrl(variant);
      } catch (err) {
        setLoadError(
          `Failed to get model URL: ${err instanceof Error ? err.message : String(err)}`,
        );
        setLoading(false);
        return;
      }

      const loader = new OBJLoader();
      loader.load(
        modelUrl,
        (obj) => {
          obj.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              (child as THREE.Mesh).material = mat;
              (child as THREE.Mesh).castShadow = true;
              (child as THREE.Mesh).receiveShadow = true;
            }
          });
          modelCacheRef.current[variant] = obj;
          currentModelRef.current = obj;
          scene.add(obj);

          setLoading(false);
        },
        (progress) => {
          if (progress.total) {
            setLoadProgress(
              Math.round((progress.loaded / progress.total) * 100),
            );
          }
        },
        () => {
          setLoadError("Failed to load model. Check that model files exist in the storage bucket.");
          setLoading(false);
        },
      );
    },
    [],
  );

  // Scene setup
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const getSize = () => {
      if (designMode) {
        return { w: container.clientWidth || window.innerWidth, h: container.clientHeight || window.innerHeight };
      }
      return { w: window.innerWidth, h: window.innerHeight };
    };

    const { w: initW, h: initH } = getSize();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      40,
      initW / initH,
      0.1,
      1000,
    );
    camera.position.set(0, 50, 120);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(initW, initH);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 40, 0);
    controls.autoRotateSpeed = 2;
    controls.update();
    controlsRef.current = controls;

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);
    ambientRef.current = ambient;

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.7);
    keyLight.position.set(30, 80, 60);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.left = -60;
    keyLight.shadow.camera.right = 60;
    keyLight.shadow.camera.top = 100;
    keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 200;
    scene.add(keyLight);
    keyLightRef.current = keyLight;

    const fillLight = new THREE.DirectionalLight(0xc4b5a0, 0.3);
    fillLight.position.set(-40, 60, -30);
    scene.add(fillLight);
    fillLightRef.current = fillLight;

    const rimLight = new THREE.DirectionalLight(0x8b9dc3, 0.2);
    rimLight.position.set(0, 30, -80);
    scene.add(rimLight);
    rimLightRef.current = rimLight;

    // Ground
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.9,
    });
    groundMatRef.current = groundMat;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      groundMat,
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Shadow-receiving ground plane (transparent shadow)
    const shadowGround = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.ShadowMaterial({ opacity: 0.35 }),
    );
    shadowGround.rotation.x = -Math.PI / 2;
    shadowGround.position.y = 0.01; // slightly above main ground to avoid z-fighting
    shadowGround.receiveShadow = true;
    scene.add(shadowGround);
    shadowGroundRef.current = shadowGround;

    // Scene props group
    const sceneProps = new THREE.Group();
    scene.add(sceneProps);
    scenePropsRef.current = sceneProps;

    // Garment material
    const garmentMat = new THREE.MeshPhysicalMaterial({
      color: 0xf0ead6,
      roughness: 0.2,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    garmentMatRef.current = garmentMat;

    // Post-processing pipeline
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.3,  // strength
      0.4,  // radius
      0.85, // threshold
    );
    bloomPass.enabled = false;
    composer.addPass(bloomPass);
    bloomPassRef.current = bloomPass;

    const vignettePass = new ShaderPass(VignetteShader);
    vignettePass.uniforms["offset"].value = 0.2;
    vignettePass.uniforms["darkness"].value = 1.4;
    vignettePass.enabled = true;
    composer.addPass(vignettePass);
    vignettePassRef.current = vignettePass;

    composer.addPass(new OutputPass());
    composerRef.current = composer;

    // Offset the camera frustum so the model centers in the content area (right of sidebar)
    const applySidebarOffset = () => {
      if (designMode) {
        // In design mode, clear any view offset and use container dimensions
        camera.clearViewOffset();
        const { w, h } = getSize();
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        return;
      }
      const sidebarW = sidebarRef.current?.offsetWidth ?? 0;
      const fullW = window.innerWidth;
      const fullH = window.innerHeight;
      camera.setViewOffset(fullW, fullH, -sidebarW / 2, 0, fullW, fullH);
      camera.updateProjectionMatrix();
    };
    applySidebarOffset();

    // Resize handler
    const onResize = () => {
      const { w, h } = getSize();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      applySidebarOffset();
    };
    window.addEventListener("resize", onResize);

    // In design mode, also observe container size changes
    let resizeObserver: ResizeObserver | undefined;
    if (designMode) {
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(container);
    }

    // Render loop
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);

      // Smooth camera transition
      if (isAnimatingCameraRef.current && targetCameraPosRef.current && targetLookAtRef.current) {
        camera.position.lerp(targetCameraPosRef.current, 0.08);
        controls.target.lerp(targetLookAtRef.current, 0.08);
        const posDist = camera.position.distanceTo(targetCameraPosRef.current);
        const tgtDist = controls.target.distanceTo(targetLookAtRef.current);
        if (posDist < 0.5 && tgtDist < 0.5) {
          camera.position.copy(targetCameraPosRef.current);
          controls.target.copy(targetLookAtRef.current);
          isAnimatingCameraRef.current = false;
          controls.enableDamping = true;
          controls.autoRotate = turntableRef.current; // restore turntable after transition
        }
      }

      controls.update();

      composer.render();
    }
    animate();

    // Cleanup
    return () => {
      window.removeEventListener("resize", onResize);
      resizeObserver?.disconnect();
      cancelAnimationFrame(animFrameRef.current);
      for (const tex of Object.values(textureCacheRef.current)) {
        tex.dispose();
      }
      textureCacheRef.current = {};
      if (envMapRef.current) envMapRef.current.dispose();
      if (pmremRef.current) pmremRef.current.dispose();
      composer.dispose();
      renderer.dispose();
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [designMode]);

  // Apply initial material + scene + load model on mount
  useEffect(() => {
    if (!garmentMatRef.current) return;
    applyMaterial(activeFabricIdx, activeColorIdx);
    // Build initial scene
    const sceneDef = SCENES[activeSceneIdx];
    const sceneProps = scenePropsRef.current;
    const groundMat = groundMatRef.current;
    const sceneObj = sceneRef.current;
    if (sceneProps && groundMat && sceneObj) {
      while (sceneProps.children.length) sceneProps.remove(sceneProps.children[0]);
      groundMat.roughness = 0.9;
      sceneDef.build(sceneObj, groundMat, sceneProps);
      sceneBackgroundRef.current = sceneObj.background;
      applyLighting(sceneDef.lighting[0]);
    }
    loadModel(activeVariant);
    // Load initial HDR environment
    loadHDR(HDRI_PRESETS[0].file);
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update key light from sliders
  useEffect(() => {
    const keyLight = keyLightRef.current;
    if (!keyLight) return;

    const angle = (sliderAngle * Math.PI) / 180;
    const radius = 80;
    keyLight.position.set(
      Math.sin(angle) * radius,
      sliderHeight,
      Math.cos(angle) * radius,
    );
    keyLight.intensity = sliderIntensity / 100;

    const w = sliderWarmth / 100;
    const r = 0.8 + w * 0.2;
    const g = 0.85 + (w < 0.5 ? w * 0.15 : (1 - w) * 0.3);
    const b = 1.0 - w * 0.45;
    keyLight.color.setRGB(r, g, b, THREE.SRGBColorSpace);
  }, [sliderAngle, sliderHeight, sliderIntensity, sliderWarmth]);

  // Sync material controls to the Three.js material
  useEffect(() => {
    const mat = garmentMatRef.current;
    if (!mat) return;
    mat.sheen = matSheen;
    mat.sheenRoughness = matSheenRoughness;
    mat.sheenColor.set(matSheenColor);
    mat.transmission = matTransmission;
    mat.thickness = matThickness;
  }, [matSheen, matSheenRoughness, matSheenColor, matTransmission, matThickness]);

  // Turntable
  useEffect(() => {
    turntableRef.current = turntable;
    if (controlsRef.current) {
      controlsRef.current.autoRotate = turntable;
    }
  }, [turntable]);


  // Sync bloom pass
  useEffect(() => {
    const pass = bloomPassRef.current;
    if (!pass) return;
    pass.enabled = bloomEnabled;
    pass.threshold = bloomThreshold;
    pass.strength = bloomStrength;
    pass.radius = bloomRadius;
  }, [bloomEnabled, bloomThreshold, bloomStrength, bloomRadius]);

  // Sync vignette pass
  useEffect(() => {
    const pass = vignettePassRef.current;
    if (!pass) return;
    pass.enabled = vignetteEnabled;
    pass.uniforms["offset"].value = vignetteOffset;
    pass.uniforms["darkness"].value = vignetteDarkness;
  }, [vignetteEnabled, vignetteOffset, vignetteDarkness]);




  // Camera preset handler
  const handleCameraPreset = useCallback((idx: number) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const preset = CAMERA_PRESETS[idx];
    targetCameraPosRef.current = new THREE.Vector3(...preset.position);
    targetLookAtRef.current = new THREE.Vector3(...preset.target);
    isAnimatingCameraRef.current = true;
    controls.enableDamping = false;
    controls.autoRotate = false; // pause turntable during transition
    setActiveCameraPreset(idx);
  }, []);

  // Double-click zoom handler
  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!renderer || !camera || !controls) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onDblClick = (event: MouseEvent) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      const model = currentModelRef.current;
      if (!model) return;

      const intersects = raycaster.intersectObject(model, true);
      if (intersects.length > 0) {
        const hitPoint = intersects[0].point;
        const direction = hitPoint.clone().sub(camera.position).normalize();
        const newPos = camera.position.clone().add(direction.multiplyScalar(40));
        targetCameraPosRef.current = newPos;
        targetLookAtRef.current = hitPoint.clone();
        isAnimatingCameraRef.current = true;
        controls.enableDamping = false;
        controls.autoRotate = false; // pause turntable during zoom
        setActiveCameraPreset(-1);
      } else {
        // No hit — reset to front preset
        handleCameraPreset(0);
      }
    };

    renderer.domElement.addEventListener("dblclick", onDblClick);
    return () => {
      renderer.domElement.removeEventListener("dblclick", onDblClick);
    };
  }, [handleCameraPreset]);

  // Handlers
  const handleHdri = (idx: number) => {
    setActiveHdriIdx(idx);
    loadHDR(HDRI_PRESETS[idx].file);
  };

  const handleVariant = (variant: string) => {
    setActiveVariant(variant);
    loadModel(variant);
  };

  const handleFabric = (idx: number) => {
    setActiveFabricIdx(idx);
    applyMaterial(idx, activeColorIdx);
    const fab = FABRICS[idx];
    setMatSheen(fab.sheen ?? 0);
    setMatSheenRoughness(fab.sheenRoughness ?? 0);
    setMatSheenColor(fab.sheenColor ?? "#ffffff");
    setMatTransmission(fab.transmission ?? 0);
    setMatThickness(fab.thickness ?? 0);

  };

  const handleColor = (idx: number) => {
    setActiveColorIdx(idx);
    applyMaterial(activeFabricIdx, idx);
  };

  const handleScene = (idx: number) => {
    setActiveSceneIdx(idx);
    setActiveLightingIdx(0);
    const sceneDef = SCENES[idx];
    const sceneProps = scenePropsRef.current;
    const groundMat = groundMatRef.current;
    const sceneObj = sceneRef.current;
    if (sceneProps && groundMat && sceneObj) {
      while (sceneProps.children.length) sceneProps.remove(sceneProps.children[0]);
      groundMat.roughness = 0.9;
      sceneDef.build(sceneObj, groundMat, sceneProps);
      // Save the scene's native background so we can restore it when HDR BG is toggled off
      sceneBackgroundRef.current = sceneObj.background;
      applyLighting(sceneDef.lighting[0]);
    }
  };

  const handleLighting = (idx: number) => {
    setActiveLightingIdx(idx);
    applyLighting(SCENES[activeSceneIdx].lighting[idx]);
  };

  const handleReset = () => {
    applyLighting(SCENES[activeSceneIdx].lighting[activeLightingIdx]);
  };

  const currentLightingPresets = SCENES[activeSceneIdx].lighting;

  return (
    <>
      {/* Three.js canvas container */}
      <div ref={containerRef} className={designMode ? "absolute inset-0" : "fixed inset-0"} />

      {/* Loading overlay */}
      {loading && (
        <div className={`${designMode ? "absolute" : "fixed"} inset-0 z-20 flex items-center justify-center bg-black/50 text-white text-lg`}>
          {loadError ?? `Loading model\u2026 ${loadProgress}%`}
        </div>
      )}

      {/* Error overlay (when not loading but error persists) */}
      {!loading && loadError && (
        <div className={`${designMode ? "absolute" : "fixed"} inset-0 z-20 flex items-center justify-center bg-black/50 text-red-400 text-lg`}>
          {loadError}
        </div>
      )}

      {/* Controls sidebar — hidden in design mode */}
      <div ref={sidebarRef} className={`fixed top-4 left-4 bottom-4 z-10 flex flex-col gap-5 overflow-y-auto rounded-lg bg-black/60 p-4 backdrop-blur-sm scrollbar-thin ${designMode ? "hidden" : ""}`}>
        {/* Variant */}
        <ControlGroup label="Variant">
          {(["heavy", "light"] as const).map((v) => (
            <SidebarButton
              key={v}
              active={activeVariant === v}
              onClick={() => handleVariant(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </SidebarButton>
          ))}
        </ControlGroup>

        {/* Fabric */}
        <ControlGroup label="Fabric">
          {FABRICS.map((fab, i) => (
            <SidebarButton
              key={fab.name}
              active={activeFabricIdx === i}
              onClick={() => handleFabric(i)}
            >
              {fab.name}
            </SidebarButton>
          ))}
        </ControlGroup>

        {/* Color */}
        <ControlGroup label="Color">
          <div className="grid grid-cols-4 gap-1.5">
            {COLORS.map((col, i) => (
              <div
                key={col.name}
                title={col.name}
                className={`w-8 h-8 rounded cursor-pointer border-2 transition-colors ${
                  activeColorIdx === i
                    ? "border-white"
                    : "border-transparent hover:border-gray-500"
                }`}
                style={{ background: col.hex }}
                onClick={() => handleColor(i)}
              />
            ))}
          </div>
        </ControlGroup>

        {/* Material */}
        <ControlGroup label="Material">
          <div className="flex flex-col gap-1.5">
            <SliderRow label="Sheen" value={matSheen} min={0} max={1} step={0.01} onChange={setMatSheen} />
            <SliderRow label="Sheen Rgh" value={matSheenRoughness} min={0} max={1} step={0.01} onChange={setMatSheenRoughness} />
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="w-14">Sheen Clr</span>
              <input
                type="color"
                value={matSheenColor}
                onChange={(e) => setMatSheenColor(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border border-gray-600 bg-transparent p-0"
              />
              <div className="flex gap-1">
                {["#ffffff", "#d4a0a0", "#8a6a8a", "#9a9090", "#c48a8a", "#121212"].map((c) => (
                  <div
                    key={c}
                    title={c}
                    className={`w-5 h-5 rounded cursor-pointer border transition-colors ${
                      matSheenColor === c ? "border-white" : "border-gray-600 hover:border-gray-400"
                    }`}
                    style={{ background: c }}
                    onClick={() => setMatSheenColor(c)}
                  />
                ))}
              </div>
            </div>
            <SliderRow label="Sheerness" value={matTransmission} min={0} max={1} step={0.01} onChange={setMatTransmission} />
            <SliderRow label="Radiance" value={matThickness} min={0} max={2} step={0.01} onChange={setMatThickness} />
          </div>
        </ControlGroup>

        {/* Scene */}
        <ControlGroup label="Scene">
          {SCENES.map((s, i) => (
            <SidebarButton
              key={s.name}
              active={activeSceneIdx === i}
              onClick={() => handleScene(i)}
            >
              {s.name}
            </SidebarButton>
          ))}
        </ControlGroup>

        {/* Lighting */}
        <ControlGroup label="Lighting">
          {currentLightingPresets.map((preset, i) => (
            <SidebarButton
              key={preset.name}
              active={activeLightingIdx === i}
              onClick={() => handleLighting(i)}
            >
              {preset.name}
            </SidebarButton>
          ))}

          <div className="mt-2 flex flex-col gap-1.5">
            <SliderRow label="Angle" value={sliderAngle} min={0} max={360} onChange={setSliderAngle} />
            <SliderRow label="Height" value={sliderHeight} min={5} max={120} onChange={setSliderHeight} />
            <SliderRow label="Intensity" value={sliderIntensity} min={0} max={200} onChange={setSliderIntensity} />
            <SliderRow label="Warmth" value={sliderWarmth} min={0} max={100} onChange={setSliderWarmth} />
            <button
              onClick={handleReset}
              className="mt-1 px-2.5 py-1.5 text-xs border border-gray-600 rounded bg-[#2a2a2a] text-gray-300 hover:bg-[#3a3a3a] cursor-pointer transition-colors"
            >
              Reset
            </button>
          </div>
        </ControlGroup>

        {/* View */}
        <ControlGroup label="View">
          <div className="flex flex-wrap gap-1">
            {CAMERA_PRESETS.map((preset, i) => (
              <SidebarButton
                key={preset.name}
                active={activeCameraPreset === i}
                onClick={() => handleCameraPreset(i)}
              >
                {preset.name}
              </SidebarButton>
            ))}
          </div>
        </ControlGroup>

        {/* Environment */}
        <ControlGroup label="Environment">
          <div className="flex flex-wrap gap-1">
            {HDRI_PRESETS.map((preset, i) => (
              <SidebarButton
                key={preset.name}
                active={activeHdriIdx === i}
                onClick={() => handleHdri(i)}
              >
                {preset.name}
              </SidebarButton>
            ))}
          </div>
        </ControlGroup>

        {/* Post FX */}
        <ControlGroup label="Post FX">
          <div className="flex flex-col gap-2">
            <div>
              <SidebarButton active={bloomEnabled} onClick={() => setBloomEnabled(!bloomEnabled)}>
                Bloom {bloomEnabled ? "On" : "Off"}
              </SidebarButton>
              {bloomEnabled && (
                <div className="mt-1 flex flex-col gap-1">
                  <SliderRow label="Threshold" value={bloomThreshold} min={0} max={1} step={0.01} onChange={setBloomThreshold} />
                  <SliderRow label="Strength" value={bloomStrength} min={0} max={2} step={0.01} onChange={setBloomStrength} />
                  <SliderRow label="Radius" value={bloomRadius} min={0} max={1} step={0.01} onChange={setBloomRadius} />
                </div>
              )}
            </div>
            <div>
              <SidebarButton active={vignetteEnabled} onClick={() => setVignetteEnabled(!vignetteEnabled)}>
                Vignette {vignetteEnabled ? "On" : "Off"}
              </SidebarButton>
              {vignetteEnabled && (
                <div className="mt-1 flex flex-col gap-1">
                  <SliderRow label="Offset" value={vignetteOffset} min={0} max={2} step={0.01} onChange={setVignetteOffset} />
                  <SliderRow label="Darkness" value={vignetteDarkness} min={0} max={3} step={0.01} onChange={setVignetteDarkness} />
                </div>
              )}
            </div>
          </div>
        </ControlGroup>


        {/* Turntable */}
        <ControlGroup label="Turntable">
          <SidebarButton
            active={turntable}
            onClick={() => setTurntable(!turntable)}
          >
            {turntable ? "On" : "Off"}
          </SidebarButton>
        </ControlGroup>
      </div>

      {/* Info bar — hidden in design mode */}
      {!designMode && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10 text-xs text-gray-500">
          Orbit: drag &middot; Zoom: scroll &middot; Pan: right-drag
        </div>
      )}
    </>
  );
}

// ── Sub-components ──

function ControlGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[0.7rem] uppercase tracking-wider text-gray-500 mb-1.5">
        {label}
      </label>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function SidebarButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 border rounded text-sm text-left cursor-pointer transition-colors ${
        active
          ? "border-white bg-[#3a3a3a] text-white"
          : "border-gray-600 bg-[#2a2a2a] text-gray-300 hover:bg-[#3a3a3a]"
      }`}
    >
      {children}
    </button>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <span className="w-20 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-white"
      />
    </div>
  );
}
