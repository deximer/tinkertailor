import * as THREE from "three";

const S = 512;

function createCanvas(size = S): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  return c;
}

function canvasToTexture(
  canvas: HTMLCanvasElement,
  repeat = 8,
): THREE.CanvasTexture {
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

export function texSilk(): THREE.CanvasTexture {
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

export function texSatin(): THREE.CanvasTexture {
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

export function texCotton(): THREE.CanvasTexture {
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

export function texLinen(): THREE.CanvasTexture {
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

export function texChiffon(): THREE.CanvasTexture {
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

export function texVelvet(): THREE.CanvasTexture {
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

export function texDenim(): THREE.CanvasTexture {
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

export function texWool(): THREE.CanvasTexture {
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

export interface FabricDef {
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

export const FABRICS: FabricDef[] = [
  { name: "Silk", roughness: 0.68, metalness: 0.0, texture: texSilk, sheen: 0.3, sheenRoughness: 0.4, transmission: 0.08, thickness: 0.5 },
  { name: "Satin", roughness: 0.6, metalness: 0.0, texture: texSatin },
  { name: "Cotton", roughness: 0.65, metalness: 0.0, texture: texCotton },
  { name: "Linen", roughness: 0.75, metalness: 0.0, texture: texLinen },
  { name: "Chiffon", roughness: 0.68, metalness: 0.0, texture: texChiffon, transmission: 0.15, thickness: 0.3, sheen: 0.1 },
  { name: "Velvet", roughness: 0.85, metalness: 0.0, texture: texVelvet, sheen: 0.9, sheenRoughness: 0.6, sheenColor: "#6a4a6a" },
  { name: "Denim", roughness: 0.7, metalness: 0.0, texture: texDenim },
  { name: "Wool", roughness: 0.8, metalness: 0.0, texture: texWool, sheen: 0.5, sheenRoughness: 0.8 },
];
