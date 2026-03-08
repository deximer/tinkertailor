"use client";

import { useEffect, useState, useCallback } from "react";
import { useDesignSession } from "@/lib/store/design-session";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ComponentType {
  id: string;
  name: string;
  slug: string;
  designStage: "silhouette" | "embellishment" | "finishing";
  isAnchor: boolean;
}

interface ComponentData {
  id: string;
  name: string;
  code: string;
  componentTypeId: string;
  modelPath: string | null;
  typeName: string;
  typeSlug: string;
  designStage: "silhouette" | "embellishment" | "finishing";
  isAnchor: boolean;
}

interface CompatibleResponse {
  designPhase: string;
  components: ComponentData[];
  selectedComponents: ComponentData[];
}

// Stage order for tab sorting
const STAGE_ORDER: Record<string, number> = {
  silhouette: 0,
  embellishment: 1,
  finishing: 2,
};

// ---------------------------------------------------------------------------
// ComponentBrowser
// ---------------------------------------------------------------------------

export default function ComponentBrowser() {
  const selectedComponentIds = useDesignSession((s) => s.selectedComponentIds);
  const setSelectedComponents = useDesignSession(
    (s) => s.setSelectedComponents,
  );
  const setDesignPhase = useDesignSession((s) => s.setDesignPhase);

  const [componentTypes, setComponentTypes] = useState<ComponentType[]>([]);
  const [activeTypeSlug, setActiveTypeSlug] = useState<string | null>(null);
  const [availableComponents, setAvailableComponents] = useState<
    ComponentData[]
  >([]);
  const [selectedComponentsData, setSelectedComponentsData] = useState<
    ComponentData[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch component types on mount
  useEffect(() => {
    async function fetchTypes() {
      try {
        const res = await fetch("/api/component-types");
        if (!res.ok) {
          setFetchError("Failed to load component types");
          return;
        }
        const types: ComponentType[] = await res.json();
        // Sort by stage order, then alphabetically
        types.sort(
          (a, b) =>
            (STAGE_ORDER[a.designStage] ?? 99) - (STAGE_ORDER[b.designStage] ?? 99) ||
            a.name.localeCompare(b.name),
        );
        setComponentTypes(types);
        if (types.length > 0 && !activeTypeSlug) {
          setActiveTypeSlug(types[0].slug);
        }
      } catch {
        setFetchError("Failed to load component types");
      }
    }
    fetchTypes();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch compatible components when selection changes
  const fetchCompatible = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const params = new URLSearchParams();
    if (selectedComponentIds.length > 0) {
      params.set("compatible_with", selectedComponentIds.join(","));
    }

    try {
      const res = await fetch(`/api/components?${params.toString()}`);
      if (!res.ok) {
        setFetchError("Failed to load components");
        setLoading(false);
        return;
      }

      if (selectedComponentIds.length > 0) {
        const data: CompatibleResponse = await res.json();
        setAvailableComponents(data.components);
        setSelectedComponentsData(data.selectedComponents);
        setDesignPhase(
          data.designPhase as
            | "silhouette"
            | "embellishment"
            | "finishing"
            | "complete",
        );
      } else {
        // No selection — response is a flat array
        const data: ComponentData[] = await res.json();
        setAvailableComponents(data);
        setSelectedComponentsData([]);
      }
      setLoading(false);
    } catch {
      setFetchError("Failed to load components");
      setLoading(false);
    }
  }, [selectedComponentIds, setDesignPhase]);

  useEffect(() => {
    fetchCompatible();
  }, [fetchCompatible]);

  // Apply selection rules client-side
  const handleSelectComponent = useCallback(
    (component: ComponentData) => {
      const isAlreadySelected = selectedComponentIds.includes(component.id);

      if (isAlreadySelected) {
        // Deselect
        setSelectedComponents(
          selectedComponentIds.filter((id) => id !== component.id),
        );
        return;
      }

      if (component.isAnchor) {
        // Anchor selection: clear all, keep only this
        setSelectedComponents([component.id]);
      } else {
        // Non-anchor: deselect same-type, add new
        // Find all currently selected components of the same type
        const sameTypeIds = new Set(
          selectedComponentsData
            .filter((c) => c.componentTypeId === component.componentTypeId)
            .map((c) => c.id),
        );
        const kept = selectedComponentIds.filter((id) => !sameTypeIds.has(id));
        setSelectedComponents([...kept, component.id]);
      }
    },
    [selectedComponentIds, selectedComponentsData, setSelectedComponents],
  );

  // Filter components by active type tab
  const filteredComponents = activeTypeSlug
    ? availableComponents.filter((c) => c.typeSlug === activeTypeSlug)
    : availableComponents;

  // Also include selected components for the active type (so they show as selected)
  const selectedForType = activeTypeSlug
    ? selectedComponentsData.filter((c) => c.typeSlug === activeTypeSlug)
    : selectedComponentsData;

  // Merge: selected components of this type + available (not selected)
  const selectedIdSet = new Set(selectedComponentIds);
  const displayComponents = [
    ...selectedForType,
    ...filteredComponents.filter((c) => !selectedIdSet.has(c.id)),
  ];

  // Count available per type (for showing on tabs)
  const countByType = new Map<string, number>();
  for (const comp of availableComponents) {
    countByType.set(comp.typeSlug, (countByType.get(comp.typeSlug) ?? 0) + 1);
  }
  // Also count selected components
  for (const comp of selectedComponentsData) {
    if (!countByType.has(comp.typeSlug)) {
      countByType.set(comp.typeSlug, 0);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Component type tabs */}
      <div
        role="tablist"
        aria-label="Component types"
        className="flex gap-1 overflow-x-auto border-b border-gray-800 px-3 py-2"
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          const idx = componentTypes.findIndex(
            (ct) => ct.slug === activeTypeSlug,
          );
          if (idx === -1) return;
          const next =
            e.key === "ArrowRight"
              ? (idx + 1) % componentTypes.length
              : (idx - 1 + componentTypes.length) % componentTypes.length;
          setActiveTypeSlug(componentTypes[next].slug);
          // Move focus to the newly active tab
          const container = e.currentTarget;
          const buttons = container.querySelectorAll<HTMLButtonElement>(
            '[role="tab"]',
          );
          buttons[next]?.focus();
        }}
      >
        {componentTypes.map((ct) => {
          const count = countByType.get(ct.slug) ?? 0;
          const isActive = activeTypeSlug === ct.slug;
          const hasSelected = selectedComponentsData.some(
            (c) => c.typeSlug === ct.slug,
          );
          return (
            <button
              key={ct.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTypeSlug(ct.slug)}
              className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-white text-black"
                  : "bg-[#2a2a2a] text-gray-300 hover:bg-[#3a3a3a]"
              }`}
            >
              {ct.name}
              {hasSelected && (
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              )}
              {count > 0 && !isActive && (
                <span className="text-gray-500">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Component grid */}
      <div role="tabpanel" className="flex-1 overflow-y-auto p-3">
        {fetchError ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-red-400">
            <span>{fetchError}</span>
            <button
              onClick={fetchCompatible}
              className="rounded-md bg-[#2a2a2a] px-3 py-1 text-xs text-gray-300 transition-colors hover:bg-[#3a3a3a]"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="flex h-32 items-center justify-center text-sm text-gray-500">
            Loading components...
          </div>
        ) : displayComponents.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-gray-500">
            No components available for this type
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {displayComponents.map((comp) => {
              const isSelected = selectedIdSet.has(comp.id);
              return (
                <button
                  key={comp.id}
                  onClick={() => handleSelectComponent(comp)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    isSelected
                      ? "border-white bg-white/10 text-white"
                      : "border-gray-700 bg-[#2a2a2a] text-gray-300 hover:border-gray-500 hover:bg-[#3a3a3a]"
                  }`}
                >
                  <div className="text-sm font-medium">{comp.name}</div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {comp.code}
                  </div>
                  {isSelected && (
                    <div className="mt-1.5 text-xs font-medium text-green-400">
                      Selected
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
