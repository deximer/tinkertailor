"use client";

import { useEffect, useState } from "react";
import { useDesignSession } from "@/lib/store/design-session";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FabricSkin {
  id: string;
  name: string;
  fabricCode: string;
  priceMarkup: string;
}

interface FabricChildCategory {
  id: string;
  name: string;
  slug: string;
  skins: FabricSkin[];
}

interface FabricParentCategory {
  id: string;
  name: string;
  slug: string;
  merchandisingOrder: number;
  children: FabricChildCategory[];
}

// ---------------------------------------------------------------------------
// FabricPicker
// ---------------------------------------------------------------------------

export default function FabricPicker() {
  const selectedComponentIds = useDesignSession((s) => s.selectedComponentIds);
  const selectedFabricSkinId = useDesignSession((s) => s.selectedFabricSkinId);
  const selectFabric = useDesignSession((s) => s.selectFabric);
  const designPhase = useDesignSession((s) => s.designPhase);

  const [categories, setCategories] = useState<FabricParentCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(false);

  // Only show fabric picker after silhouette phase
  const hasSilhouetteComponents =
    designPhase !== "silhouette" && selectedComponentIds.length > 0;

  // Fetch compatible fabrics when component selection changes
  useEffect(() => {
    if (!hasSilhouetteComponents) {
      setCategories([]);
      return;
    }

    async function fetchFabrics() {
      setLoading(true);
      const params = new URLSearchParams({
        compatible_with: selectedComponentIds.join(","),
      });

      const res = await fetch(
        `/api/fabric-skin-categories?${params.toString()}`,
      );
      if (!res.ok) {
        setLoading(false);
        return;
      }

      const data: FabricParentCategory[] = await res.json();
      setCategories(data);

      // Auto-expand first category
      if (data.length > 0 && expandedCategories.size === 0) {
        setExpandedCategories(new Set([data[0].id]));
      }

      setLoading(false);
    }
    fetchFabrics();
  }, [selectedComponentIds, hasSilhouetteComponents]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (!hasSilhouetteComponents) {
    return (
      <div className="flex h-32 items-center justify-center px-3 text-sm text-gray-500">
        Select silhouette components to browse fabrics
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center px-3 text-sm text-gray-500">
        Loading fabrics...
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center px-3 text-sm text-gray-500">
        No compatible fabrics found
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 overflow-y-auto p-3">
      {categories.map((parent) => (
        <div key={parent.id}>
          {/* Parent category header */}
          <button
            onClick={() => toggleCategory(parent.id)}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 hover:bg-[#2a2a2a]"
          >
            <span>{parent.name}</span>
            <span className="text-gray-600">
              {expandedCategories.has(parent.id) ? "\u25B2" : "\u25BC"}
            </span>
          </button>

          {/* Child categories + skins */}
          {expandedCategories.has(parent.id) && (
            <div className="ml-2 mt-1 flex flex-col gap-2">
              {parent.children.map((child) => (
                <div key={child.id}>
                  <div className="mb-1 text-xs text-gray-500">
                    {child.name}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {child.skins.map((skin) => {
                      const isSelected = selectedFabricSkinId === skin.id;
                      const markup = parseFloat(skin.priceMarkup);
                      return (
                        <button
                          key={skin.id}
                          onClick={() =>
                            selectFabric(skin.id, skin.fabricCode)
                          }
                          className={`rounded-lg border p-2 text-left transition-colors ${
                            isSelected
                              ? "border-white bg-white/10 text-white"
                              : "border-gray-700 bg-[#2a2a2a] text-gray-300 hover:border-gray-500 hover:bg-[#3a3a3a]"
                          }`}
                        >
                          <div className="text-xs font-medium">{skin.name}</div>
                          {markup > 0 && (
                            <div className="mt-0.5 text-[10px] text-gray-500">
                              +${markup.toFixed(0)}
                            </div>
                          )}
                          {isSelected && (
                            <div className="mt-1 text-[10px] font-medium text-green-400">
                              Selected
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
