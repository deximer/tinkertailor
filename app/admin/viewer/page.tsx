"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { ModelEntry } from "@/app/components/AdminFabricViewer";
import type { ViewerSettings, TextureType } from "@/lib/three/textures";

const AdminFabricViewer = dynamic(
  () => import("@/app/components/AdminFabricViewer"),
  { ssr: false },
);

// ── Types ──

interface Component {
  id: string;
  name: string;
  assetCode: string;
  componentTypeId: string;
  typeName: string;
  typeSlug: string;
}

interface Mesh {
  id: string;
  componentId: string;
  fabricWeight: string;
  storagePath: string;
  publicUrl: string;
}

interface Fabric {
  id: string;
  name: string;
  fabricCode: string;
  categoryId: string;
  fabricWeight: string | null;
  priceMarkup: string;
  hidden: boolean;
  viewerSettings: ViewerSettings | null;
  createdAt: string;
}

const TABS = ["Bodice", "Skirt", "Sleeve"] as const;
const TAB_SLUG: Record<string, string> = {
  Bodice: "bodice",
  Skirt: "skirt-section",
  Sleeve: "sleeve",
};
const FABRIC_WEIGHTS = ["heavy", "light", "standard"] as const;

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
  const [selectedWeight, setSelectedWeight] = useState<string>("heavy");

  // Three-part composition selection
  const [selectedBodiceId, setSelectedBodiceId] = useState<string | null>(null);
  const [selectedSkirtId, setSelectedSkirtId] = useState<string | null>(null);
  const [selectedSleeveId, setSelectedSleeveId] = useState<string | null>(null);
  const [compatibleIds, setCompatibleIds] = useState<Set<string>>(new Set());
  const [composedModels, setComposedModels] = useState<ModelEntry[]>([]);

  const [componentIdsWithMeshes, setComponentIdsWithMeshes] = useState<Set<string> | null>(null);
  const [meshIdsLoading, setMeshIdsLoading] = useState(true);

  // Fabric state
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [selectedFabricId, setSelectedFabricId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ViewerSettings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<ViewerSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Fabric filter state
  const [filterToComponent, setFilterToComponent] = useState(false);
  const [componentFabricCategoryIds, setComponentFabricCategoryIds] = useState<Set<string> | null>(null);

  // Derived selection state
  const selectedIdForTab: Record<string, string | null> = {
    Bodice: selectedBodiceId,
    Skirt: selectedSkirtId,
    Sleeve: selectedSleeveId,
  };
  const activeSelectedId = selectedIdForTab[activeTab] ?? null;
  const hasAnySelection = selectedBodiceId !== null || selectedSkirtId !== null || selectedSleeveId !== null;

  // ── Data fetching ──

  useEffect(() => {
    fetch("/api/components")
      .then((r) => r.json())
      .then((data: Component[]) => setComponents(data))
      .catch(console.error);

    fetch("/api/admin/fabrics")
      .then((r) => r.json())
      .then((data: Fabric[]) => setFabrics(data))
      .catch(console.error);

    fetch("/api/admin/component-meshes")
      .then((r) => r.json())
      .then((ids: string[]) => setComponentIdsWithMeshes(new Set(ids)))
      .catch(console.error)
      .finally(() => setMeshIdsLoading(false));
  }, []);

  // Fetch compatible parts when bodice is selected
  useEffect(() => {
    if (!selectedBodiceId) {
      setCompatibleIds(new Set());
      return;
    }
    fetch(`/api/components?compatible_with=${selectedBodiceId}`)
      .then((r) => r.json())
      .then((data: { components: Component[] }) => {
        setCompatibleIds(new Set(data.components.map((c) => c.id)));
      })
      .catch(() => setCompatibleIds(new Set()));
  }, [selectedBodiceId]);

  // Fetch allowed fabric category IDs for the bodice (anchor) when filter is on
  useEffect(() => {
    if (!filterToComponent || !selectedBodiceId) {
      setComponentFabricCategoryIds(null);
      return;
    }
    fetch(`/api/admin/component-fabric-rules?componentId=${selectedBodiceId}`)
      .then((r) => r.json())
      .then((ids: string[]) => setComponentFabricCategoryIds(new Set(ids)))
      .catch(() => setComponentFabricCategoryIds(null));
  }, [filterToComponent, selectedBodiceId]);

  // Resolve model URLs for all selected parts
  useEffect(() => {
    const selections = [
      { id: "bodice", componentId: selectedBodiceId },
      { id: "skirt", componentId: selectedSkirtId },
      { id: "sleeve", componentId: selectedSleeveId },
    ].filter((s): s is { id: string; componentId: string } => s.componentId !== null);

    if (selections.length === 0) {
      setComposedModels([]);
      return;
    }

    let cancelled = false;

    Promise.all(
      selections.map(async (sel) => {
        const meshRes = await fetch(`/api/admin/component-meshes?componentId=${sel.componentId}`);
        const meshData: Mesh[] = await meshRes.json();
        const mesh = meshData.find((m) => m.fabricWeight === selectedWeight) ?? meshData[0];
        if (!mesh) return null;

        const urlRes = await fetch(`/api/models/signed-url?name=${encodeURIComponent(mesh.storagePath)}`);
        if (!urlRes.ok) return null;
        const data = await urlRes.json();
        return data?.url ? { id: sel.id, url: data.url as string } : null;
      }),
    )
      .then((results) => {
        if (cancelled) return;
        setComposedModels(results.filter((r): r is ModelEntry => r !== null));
      })
      .catch(() => {
        if (!cancelled) setComposedModels([]);
      });

    return () => { cancelled = true; };
  }, [selectedBodiceId, selectedSkirtId, selectedSleeveId, selectedWeight]);

  const isDirty =
    selectedFabricId !== null &&
    JSON.stringify(settings) !== JSON.stringify(savedSettings);

  const displayedFabrics =
    filterToComponent && componentFabricCategoryIds !== null
      ? fabrics.filter((f) => componentFabricCategoryIds.has(f.categoryId))
      : fabrics;

  const filteredComponents = meshIdsLoading
    ? []
    : components.filter((c) => {
        if (c.typeSlug !== TAB_SLUG[activeTab]) return false;
        if (componentIdsWithMeshes !== null && !componentIdsWithMeshes.has(c.id)) return false;
        // When a bodice is selected, filter skirt/sleeve tabs to compatible only
        if (selectedBodiceId && activeTab !== "Bodice" && compatibleIds.size > 0) {
          return compatibleIds.has(c.id);
        }
        return true;
      });

  const compatibleCountForTab = (tab: string): number | null => {
    if (!selectedBodiceId || tab === "Bodice" || compatibleIds.size === 0) return null;
    const slug = TAB_SLUG[tab];
    return components.filter(
      (c) =>
        c.typeSlug === slug &&
        compatibleIds.has(c.id) &&
        (componentIdsWithMeshes === null || componentIdsWithMeshes.has(c.id)),
    ).length;
  };

  // ── Handlers ──

  const handleSelectFabric = useCallback(
    (fabric: Fabric) => {
      setSelectedFabricId(fabric.id);
      const s = fabric.viewerSettings ?? DEFAULT_SETTINGS;
      setSettings(s);
      setSavedSettings({ ...s });
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!selectedFabricId || saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      const res = await fetch("/api/admin/fabrics", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedFabricId, viewerSettings: settings }),
      });
      if (res.ok) {
        const updated: Fabric = await res.json();
        setFabrics((prev) =>
          prev.map((f) => (f.id === updated.id ? updated : f)),
        );
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

  const handleComponentClick = useCallback(
    (componentId: string) => {
      if (activeTab === "Bodice") {
        setSelectedBodiceId((prev) => {
          const next = prev === componentId ? null : componentId;
          // Clear sub-selections when bodice changes
          setSelectedSkirtId(null);
          setSelectedSleeveId(null);
          return next;
        });
      } else if (activeTab === "Skirt") {
        setSelectedSkirtId((prev) => (prev === componentId ? null : componentId));
      } else if (activeTab === "Sleeve") {
        setSelectedSleeveId((prev) => (prev === componentId ? null : componentId));
      }
    },
    [activeTab],
  );

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
          {TABS.map((tab) => {
            const count = compatibleCountForTab(tab);
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? "border-b-2 border-white text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {tab}
                {count !== null && (
                  <span className="ml-1 text-[10px] text-gray-500">({count})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Component list */}
        <div className="flex-1 overflow-y-auto">
          {meshIdsLoading && (
            <p className="px-3 py-4 text-xs text-gray-500">Loading...</p>
          )}
          {!meshIdsLoading && filteredComponents.length === 0 && (
            <p className="px-3 py-4 text-xs text-gray-500">
              {componentIdsWithMeshes?.size === 0 ? "No models uploaded yet" : "No components found"}
            </p>
          )}
          {filteredComponents.map((c) => (
            <button
              key={c.id}
              onClick={() => handleComponentClick(c.id)}
              className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors ${
                activeSelectedId === c.id
                  ? "bg-[#2a2a2a] text-white"
                  : "text-gray-300 hover:bg-[#222]"
              }`}
            >
              <span className="truncate">{c.name}</span>
            </button>
          ))}
        </div>

        {/* Fabric weight toggle — shown when any component is selected */}
        {hasAnySelection && (
          <div className="border-t border-gray-700 px-3 py-2">
            <p className="mb-1 text-xs text-gray-500">Fabric Weight</p>
            <div className="flex gap-1">
              {FABRIC_WEIGHTS.map((v) => (
                <button
                  key={v}
                  onClick={() => setSelectedWeight(v)}
                  className={`flex-1 rounded px-2 py-1 text-xs capitalize transition-colors ${
                    selectedWeight === v
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
        {composedModels.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <span className="text-sm text-gray-500">
              {hasAnySelection
                ? "No model file found for this component"
                : "Select a component to preview"}
            </span>
          </div>
        )}
        <AdminFabricViewer models={composedModels} settings={settings} />
      </div>

      {/* Right panel: fabrics & settings */}
      <div className="flex w-[280px] shrink-0 flex-col border-l border-gray-700">
        <div className="flex items-center justify-between border-b border-gray-700 px-3 py-2">
          <span className="text-xs font-medium text-gray-400">Fabrics</span>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={filterToComponent}
              disabled={!selectedBodiceId}
              onChange={(e) => setFilterToComponent(e.target.checked)}
              className="accent-white"
            />
            Filter to component
          </label>
        </div>
        <div className="max-h-[280px] overflow-y-auto border-b border-gray-700">
          {displayedFabrics.length === 0 && (
            <p className="px-3 py-3 text-xs text-gray-500">
              {filterToComponent ? "No fabrics linked to this component" : "No fabrics found"}
            </p>
          )}
          {displayedFabrics.map((f) => {
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
                {f.fabricWeight && (
                  <span className="shrink-0 rounded bg-[#333] px-1.5 py-0.5 text-[10px] text-gray-400">
                    {f.fabricWeight}
                  </span>
                )}
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
