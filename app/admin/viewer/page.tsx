"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { ViewerSettings, TextureType } from "@/lib/three/textures";

const AdminFabricViewer = dynamic(
  () => import("@/app/components/AdminFabricViewer"),
  { ssr: false },
);

// ── Types ──

interface Component {
  id: string;
  name: string;
  code: string;
  componentTypeId: string;
  typeName: string;
  typeSlug: string;
  stage: string;
}

interface FabricSkin {
  id: string;
  name: string;
  fabricCode: string;
  categoryId: string;
  meshVariant: string | null;
  priceMarkup: string;
  hidden: boolean;
  viewerSettings: ViewerSettings | null;
  createdAt: string;
}

const TABS = ["Bodice", "Skirt Section", "Sleeve"] as const;
const VARIANTS = ["heavy", "light", "standard"] as const;

const TEXTURE_OPTIONS: TextureType[] = [
  "solid",
  "silk",
  "satin",
  "cotton",
  "linen",
  "chiffon",
  "velvet",
  "denim",
  "wool",
];

const DEFAULT_SETTINGS: ViewerSettings = {
  textureType: "cotton",
  color: "#c8a2c8",
  roughness: 0.65,
  metalness: 0,
  sheen: 0,
  sheenRoughness: 0,
  sheenColor: "#ffffff",
  transmission: 0,
  thickness: 0,
};

export default function ViewerPage() {
  const [components, setComponents] = useState<Component[]>([]);
  const [activeTab, setActiveTab] = useState<string>("Bodice");
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<"heavy" | "light" | "standard">("heavy");

  const [componentIdsWithMeshes, setComponentIdsWithMeshes] = useState<Set<string> | null>(null);

  const [fabrics, setFabrics] = useState<FabricSkin[]>([]);
  const [selectedFabricId, setSelectedFabricId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ViewerSettings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<ViewerSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);

  // ── Data fetching ──

  useEffect(() => {
    fetch("/api/components")
      .then((r) => r.json())
      .then((data: Component[]) => setComponents(data))
      .catch(console.error);

    fetch("/api/admin/fabric-skins")
      .then((r) => r.json())
      .then((data: FabricSkin[]) => setFabrics(data))
      .catch(console.error);

    fetch("/api/admin/component-meshes")
      .then((r) => r.json())
      .then((ids: string[]) => setComponentIdsWithMeshes(new Set(ids)))
      .catch(console.error);
  }, []);

  // Load meshes for selected component (one call per selection)
  useEffect(() => {
    if (!selectedComponentId) {
      setStoragePath(null);
      return;
    }
    fetch(`/api/admin/component-meshes?componentId=${selectedComponentId}`)
      .then((r) => r.json())
      .then((meshes: { variant: string; storagePath: string }[]) => {
        const mesh =
          meshes.find((m) => m.variant === selectedVariant) ??
          meshes[0] ??
          null;
        setStoragePath(mesh?.storagePath ?? null);
      })
      .catch(() => setStoragePath(null));
  }, [selectedComponentId, selectedVariant]);

  // Resolve signed URL from storage path
  useEffect(() => {
    if (!storagePath) {
      setModelUrl(null);
      return;
    }
    fetch(`/api/models/signed-url?name=${encodeURIComponent(storagePath)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setModelUrl(data?.url ?? null))
      .catch(() => setModelUrl(null));
  }, [storagePath]);

  const isDirty =
    selectedFabricId !== null &&
    JSON.stringify(settings) !== JSON.stringify(savedSettings);

  const filteredComponents = components.filter(
    (c) => c.typeName === activeTab && (componentIdsWithMeshes === null || componentIdsWithMeshes.has(c.id)),
  );

  // ── Handlers ──

  const handleSelectFabric = useCallback((fabric: FabricSkin) => {
    setSelectedFabricId(fabric.id);
    const s = fabric.viewerSettings ?? DEFAULT_SETTINGS;
    setSettings(s);
    setSavedSettings({ ...s });
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedFabricId || saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      const res = await fetch("/api/admin/fabric-skins", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedFabricId, viewerSettings: settings }),
      });
      if (res.ok) {
        const updated: FabricSkin = await res.json();
        setFabrics((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
        setSavedSettings({ ...settings });
        setSaveFlash(true);
        setTimeout(() => setSaveFlash(false), 1500);
      } else {
        setSaveError(true);
        setTimeout(() => setSaveError(false), 2000);
      }
    } catch (err) {
      console.error("Save failed:", err);
      setSaveError(true);
      setTimeout(() => setSaveError(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [selectedFabricId, settings, saving]);

  const updateSetting = <K extends keyof ViewerSettings>(key: K, value: ViewerSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // ── Render ──

  return (
    <div className="flex h-screen bg-[#1a1a1a] text-white">
      {/* Left panel: components */}
      <div className="flex w-[240px] shrink-0 flex-col border-r border-gray-700">
        <div className="flex items-center justify-between border-b border-gray-700 px-3 py-2">
          <Link href="/admin" className="text-xs text-gray-400 hover:text-white">
            &larr; Admin
          </Link>
          <span className="text-xs font-medium text-gray-400">Components</span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-white text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab === "Skirt Section" ? "Skirt" : tab}
            </button>
          ))}
        </div>

        {/* Component list */}
        <div className="flex-1 overflow-y-auto">
          {filteredComponents.length === 0 && (
            <p className="px-3 py-4 text-xs text-gray-500">No components found</p>
          )}
          {filteredComponents.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedComponentId(c.id)}
              className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors ${
                selectedComponentId === c.id
                  ? "bg-[#2a2a2a] text-white"
                  : "text-gray-300 hover:bg-[#222]"
              }`}
            >
              <span className="truncate">{c.name}</span>
            </button>
          ))}
        </div>

        {/* Variant toggle — always shown when a component is selected */}
        {selectedComponentId && (
          <div className="border-t border-gray-700 px-3 py-2">
            <p className="mb-1 text-xs text-gray-500">Mesh Variant</p>
            <div className="flex gap-1">
              {VARIANTS.map((v) => (
                <button
                  key={v}
                  onClick={() => setSelectedVariant(v)}
                  className={`flex-1 rounded px-2 py-1 text-xs capitalize transition-colors ${
                    selectedVariant === v
                      ? "bg-white text-black"
                      : "bg-[#333] text-gray-300 hover:bg-[#444]"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Center panel: 3D viewer */}
      <div className="relative flex-1">
        {!modelUrl && (
          <div className="flex h-full items-center justify-center">
            <span className="text-sm text-gray-500">
              {selectedComponentId
                ? "No model file found for this component"
                : "Select a component to preview"}
            </span>
          </div>
        )}
        <AdminFabricViewer modelUrl={modelUrl} settings={settings} />
      </div>

      {/* Right panel: fabrics & settings */}
      <div className="flex w-[280px] shrink-0 flex-col border-l border-gray-700">
        <div className="border-b border-gray-700 px-3 py-2">
          <span className="text-xs font-medium text-gray-400">Fabrics</span>
        </div>
        <div className="max-h-[280px] overflow-y-auto border-b border-gray-700">
          {fabrics.map((f) => {
            const isSelected = selectedFabricId === f.id;
            return (
              <button
                key={f.id}
                onClick={() => handleSelectFabric(f)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                  isSelected ? "bg-[#2a2a2a] text-white" : "text-gray-300 hover:bg-[#222]"
                }`}
              >
                <span className="flex-1 truncate">
                  {isSelected && isDirty && (
                    <span className="mr-1 text-amber-400" title="Unsaved changes">●</span>
                  )}
                  {f.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Material settings */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <p className="mb-3 text-xs font-medium text-gray-400">Material Settings</p>

          <label className="mb-2 block">
            <span className="mb-1 block text-xs text-gray-500">Texture</span>
            <select
              value={settings.textureType}
              onChange={(e) => updateSetting("textureType", e.target.value as TextureType)}
              className="w-full rounded border border-gray-600 bg-[#222] px-2 py-1 text-sm text-white"
            >
              {TEXTURE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <label className="mb-2 block">
            <span className="mb-1 block text-xs text-gray-500">Color</span>
            <div className="flex gap-2">
              <input
                type="color"
                value={settings.color}
                onChange={(e) => updateSetting("color", e.target.value)}
                className="h-8 w-8 shrink-0 cursor-pointer rounded border border-gray-600"
              />
              <input
                type="text"
                value={settings.color}
                onChange={(e) => updateSetting("color", e.target.value)}
                className="flex-1 rounded border border-gray-600 bg-[#222] px-2 py-1 text-sm text-white font-mono"
              />
            </div>
          </label>

          <Slider label="Roughness" value={settings.roughness} onChange={(v) => updateSetting("roughness", v)} />
          <Slider label="Metalness" value={settings.metalness} onChange={(v) => updateSetting("metalness", v)} />
          <Slider label="Sheen" value={settings.sheen ?? 0} onChange={(v) => updateSetting("sheen", v)} />
          <Slider label="Sheen Roughness" value={settings.sheenRoughness ?? 0} onChange={(v) => updateSetting("sheenRoughness", v)} />

          <label className="mb-2 block">
            <span className="mb-1 block text-xs text-gray-500">Sheen Color</span>
            <div className="flex gap-2">
              <input
                type="color"
                value={settings.sheenColor ?? "#ffffff"}
                onChange={(e) => updateSetting("sheenColor", e.target.value)}
                className="h-8 w-8 shrink-0 cursor-pointer rounded border border-gray-600"
              />
              <input
                type="text"
                value={settings.sheenColor ?? "#ffffff"}
                onChange={(e) => updateSetting("sheenColor", e.target.value)}
                className="flex-1 rounded border border-gray-600 bg-[#222] px-2 py-1 text-sm text-white font-mono"
              />
            </div>
          </label>

          <Slider label="Transmission" value={settings.transmission ?? 0} onChange={(v) => updateSetting("transmission", v)} />
          <Slider label="Thickness" value={settings.thickness ?? 0} onChange={(v) => updateSetting("thickness", v)} max={2} />
        </div>

        {/* Save button */}
        <div className="border-t border-gray-700 px-3 py-3">
          <button
            disabled={!selectedFabricId || saving}
            onClick={handleSave}
            className={`w-full rounded px-3 py-2 text-sm font-medium transition-colors ${
              saveError
                ? "bg-red-600 text-white"
                : saveFlash
                  ? "bg-green-600 text-white"
                  : !selectedFabricId
                    ? "cursor-not-allowed bg-[#333] text-gray-600"
                    : isDirty
                      ? "bg-white text-black hover:bg-gray-200"
                      : "bg-[#333] text-gray-300 hover:bg-[#444]"
            }`}
          >
            {saveError ? "Save failed" : saveFlash ? "Saved!" : saving ? "Saving..." : "Save to Fabric"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="mb-2 block">
      <div className="mb-0.5 flex items-center justify-between">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-xs text-gray-500 font-mono">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-white"
      />
    </label>
  );
}
