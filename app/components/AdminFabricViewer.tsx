"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  TEXTURE_GENERATORS,
  type ViewerSettings,
} from "@/lib/three/textures";

export interface ModelEntry {
  id: string;
  url: string;
}

export interface AdminFabricViewerProps {
  models: ModelEntry[];
  settings: ViewerSettings | null;
}

export default function AdminFabricViewer({
  models,
  settings,
}: AdminFabricViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const loadedGroupsRef = useRef<Map<string, { url: string; group: THREE.Group }>>(new Map());
  const materialRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const frameIdRef = useRef<number>(0);
  const settingsRef = useRef<ViewerSettings | null>(settings);
  settingsRef.current = settings;

  // Initialize scene once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#1a1a1a");
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      40,
      el.clientWidth / el.clientHeight,
      0.1,
      1000,
    );
    camera.position.set(0, 12, 30);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 8, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.update();
    controlsRef.current = controls;

    // Neutral studio lighting: key + fill + rim
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(5, 15, 10);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-5, 8, 5);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.4);
    rim.position.set(0, 5, -10);
    scene.add(rim);

    const ambient = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambient);

    // Ground plane
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshStandardMaterial({ color: "#222222" }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(el);

    return () => {
      cancelAnimationFrame(frameIdRef.current);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) {
        el.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Stable serialization of models for effect dependency
  const modelsKey = JSON.stringify(models);

  // Diff-based model loading: add/remove/reload models as the array changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const loaded = loadedGroupsRef.current;
    const desired = new Map(models.map((m) => [m.id, m.url]));

    // Remove groups whose IDs are no longer in the models array
    for (const [id, entry] of loaded) {
      if (!desired.has(id)) {
        scene.remove(entry.group);
        loaded.delete(id);
      }
    }

    // Determine which models need loading (new or URL-changed)
    const toLoad: ModelEntry[] = [];
    for (const model of models) {
      const existing = loaded.get(model.id);
      if (existing && existing.url === model.url) continue;
      // URL changed — remove old group first
      if (existing) {
        scene.remove(existing.group);
        loaded.delete(model.id);
      }
      toLoad.push(model);
    }

    if (toLoad.length === 0) {
      // Nothing to load, but removals may have happened — refit camera
      if (loaded.size > 0) refitCamera(loaded, cameraRef, controlsRef);
      return;
    }

    // Ensure shared material exists
    if (!materialRef.current) {
      materialRef.current = buildMaterial(settingsRef.current);
    }
    const mat = materialRef.current;

    let remaining = toLoad.length;

    for (const model of toLoad) {
      const url = model.url;
      const path = url.split("?")[0].toLowerCase();
      const isGlb = path.endsWith(".glb") || path.endsWith(".gltf");

      const onLoad = (group: THREE.Group) => {
        // Guard: model may have been removed while loading
        if (!desired.has(model.id)) return;

        if (isGlb) {
          group.scale.multiplyScalar(39.3701);
        }

        prepareUVs(group, isGlb);

        group.traverse((child) => {
          if (child instanceof THREE.Mesh) child.material = mat;
        });

        loaded.set(model.id, { url: model.url, group });
        scene.add(group);

        remaining--;
        if (remaining === 0) {
          refitCamera(loaded, cameraRef, controlsRef);
        }
      };

      if (isGlb) {
        new GLTFLoader().load(url, (gltf) => onLoad(gltf.scene));
      } else {
        new OBJLoader().load(url, onLoad);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelsKey]);

  // Update material when settings change — applies to all loaded groups
  useEffect(() => {
    if (!settings) return;
    const loaded = loadedGroupsRef.current;

    // Create or update the shared material
    let mat = materialRef.current;
    if (!mat) {
      mat = buildMaterial(settings);
      materialRef.current = mat;
    } else {
      mat.color.copy(new THREE.Color(settings.color));
      mat.roughness = settings.roughness;
      mat.metalness = settings.metalness;
      mat.sheen = settings.sheen ?? 0;
      mat.sheenRoughness = settings.sheenRoughness ?? 0;
      mat.sheenColor = new THREE.Color(settings.sheenColor ?? "#ffffff");
      mat.transmission = settings.transmission ?? 0;
      mat.thickness = settings.thickness ?? 0;

      const texType = settings.textureType;
      if (texType === "solid") {
        mat.map = null;
      } else {
        const gen = TEXTURE_GENERATORS[texType];
        if (gen) {
          mat.map = gen();
        }
      }
      mat.needsUpdate = true;
    }

    // Ensure the shared material is applied to every mesh in every loaded group
    for (const [, entry] of loaded) {
      entry.group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = mat;
        }
      });
    }
  }, [settings]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ minHeight: 400 }}
    />
  );
}

function prepareUVs(group: THREE.Group, isGlb: boolean) {
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const geo = child.geometry;

    if (isGlb && geo.attributes.uv1) {
      geo.attributes.uv = geo.attributes.uv1;
    }

    if (!geo.attributes.uv) {
      const pos = geo.attributes.position;
      const uvs = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        uvs[i * 2] = pos.getX(i) * 0.05;
        uvs[i * 2 + 1] = pos.getY(i) * 0.05;
      }
      geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    }

    if (isGlb) {
      const uvAttr = geo.attributes.uv;
      let uMin = Infinity, uMax = -Infinity;
      let vMin = Infinity, vMax = -Infinity;
      for (let i = 0; i < uvAttr.count; i++) {
        const u = uvAttr.getX(i);
        const v = uvAttr.getY(i);
        if (u < uMin) uMin = u;
        if (u > uMax) uMax = u;
        if (v < vMin) vMin = v;
        if (v > vMax) vMax = v;
      }
      if (uMin < -1.5 || uMax > 1.5 || vMin < -1.5 || vMax > 1.5) {
        const uRange = uMax - uMin || 1;
        const vRange = vMax - vMin || 1;
        const newUvs = new Float32Array(uvAttr.count * 2);
        for (let i = 0; i < uvAttr.count; i++) {
          newUvs[i * 2] = (uvAttr.getX(i) - uMin) / uRange;
          newUvs[i * 2 + 1] = (uvAttr.getY(i) - vMin) / vRange;
        }
        geo.setAttribute("uv", new THREE.BufferAttribute(newUvs, 2));
      }
    }
  });
}

function refitCamera(
  loaded: Map<string, { url: string; group: THREE.Group }>,
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>,
  controlsRef: React.RefObject<OrbitControls | null>,
) {
  const camera = cameraRef.current;
  const controls = controlsRef.current;
  if (!camera || !controls || loaded.size === 0) return;

  const box = new THREE.Box3();
  for (const [, entry] of loaded) {
    box.expandByObject(entry.group);
  }
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  const dist = (maxDim / (2 * Math.tan(fov / 2))) * 1.8;
  controls.target.copy(center);
  camera.position.set(center.x, center.y, center.z + dist);
  camera.near = dist / 100;
  camera.far = dist * 10;
  camera.updateProjectionMatrix();
  controls.update();
}

function buildMaterial(
  settings: ViewerSettings | null,
): THREE.MeshPhysicalMaterial {
  const color = settings?.color ?? "#c8a2c8";
  const roughness = settings?.roughness ?? 0.65;
  const metalness = settings?.metalness ?? 0;

  let map: THREE.CanvasTexture | null = null;
  if (settings && settings.textureType !== "solid") {
    const gen = TEXTURE_GENERATORS[settings.textureType];
    if (gen) map = gen();
  }

  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    roughness,
    metalness,
    map,
    sheen: settings?.sheen ?? 0,
    sheenRoughness: settings?.sheenRoughness ?? 0,
    sheenColor: new THREE.Color(settings?.sheenColor ?? "#ffffff"),
    transmission: settings?.transmission ?? 0,
    thickness: settings?.thickness ?? 0,
    side: THREE.DoubleSide,
  });
}
