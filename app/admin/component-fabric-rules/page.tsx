"use client";

import { useEffect, useState, useCallback } from "react";

interface Component {
  id: string;
  name: string;
  code: string;
  componentTypeId: string;
}

interface FabricCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  merchandisingOrder: number;
  hidden: boolean;
}

interface ParentGroup {
  parent: FabricCategory;
  children: FabricCategory[];
}

export default function ComponentFabricRulesPage() {
  const [components, setComponents] = useState<Component[]>([]);
  const [categories, setCategories] = useState<FabricCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedComponentId, setSelectedComponentId] = useState<string>("");
  const [componentSearch, setComponentSearch] = useState("");
  const [linkedCategoryIds, setLinkedCategoryIds] = useState<Set<string>>(
    new Set(),
  );
  const [loadingRules, setLoadingRules] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [compRes, catRes] = await Promise.all([
        fetch("/api/admin/components"),
        fetch("/api/admin/fabric-categories"),
      ]);

      if (compRes.ok) setComponents(await compRes.json());
      if (catRes.ok) setCategories(await catRes.json());
    } catch {
      setErrorMsg("Failed to load data");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchRulesForComponent = useCallback(async (componentId: string) => {
    setLoadingRules(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/admin/component-fabric-rules?componentId=${componentId}`,
      );
      if (res.ok) {
        const ids: string[] = await res.json();
        setLinkedCategoryIds(new Set(ids));
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to load rules");
      }
    } catch {
      setErrorMsg("Failed to load rules");
    }
    setLoadingRules(false);
  }, []);

  const handleSelectComponent = (componentId: string) => {
    setSelectedComponentId(componentId);
    setLinkedCategoryIds(new Set());
    if (componentId) {
      fetchRulesForComponent(componentId);
    }
  };

  const handleToggleCategory = async (categoryId: string) => {
    if (!selectedComponentId) return;
    setTogglingId(categoryId);
    setErrorMsg(null);

    const isLinked = linkedCategoryIds.has(categoryId);
    const method = isLinked ? "DELETE" : "POST";

    try {
      const res = await fetch("/api/admin/component-fabric-rules", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          componentId: selectedComponentId,
          fabricCategoryId: categoryId,
        }),
      });

      if (res.ok) {
        setLinkedCategoryIds((prev) => {
          const next = new Set(prev);
          if (isLinked) {
            next.delete(categoryId);
          } else {
            next.add(categoryId);
          }
          return next;
        });
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to update rule");
      }
    } catch {
      setErrorMsg("Failed to update rule");
    }
    setTogglingId(null);
  };

  // Build parent groups for the category checklist
  const parentCategories = categories
    .filter((c) => c.parentId === null)
    .sort((a, b) => a.merchandisingOrder - b.merchandisingOrder);

  const buildGroups = (): ParentGroup[] =>
    parentCategories.map((parent) => ({
      parent,
      children: categories
        .filter((c) => c.parentId === parent.id)
        .sort((a, b) => a.merchandisingOrder - b.merchandisingOrder),
    }));

  const groups = buildGroups();

  // Also get leaf categories that have no parent (if any)
  const allCategoryIds = categories.map((c) => c.id);
  const orphanCategories = categories.filter(
    (c) => c.parentId !== null && !allCategoryIds.includes(c.parentId),
  );

  // Filter components by search
  const filteredComponents = componentSearch.trim()
    ? components.filter(
        (c) =>
          c.name.toLowerCase().includes(componentSearch.toLowerCase()) ||
          c.code.toLowerCase().includes(componentSearch.toLowerCase()),
      )
    : components;

  const selectedComponent = components.find(
    (c) => c.id === selectedComponentId,
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            Tinker Tailor — Component Fabric Rules
          </h1>
          <a
            href="/admin"
            className="rounded border border-gray-600 px-3 py-1.5 text-sm text-gray-300 hover:bg-[#2a2a2a] transition-colors"
          >
            Back to Admin
          </a>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-300">
            {errorMsg}
            <button
              onClick={() => setErrorMsg(null)}
              className="ml-3 text-red-400 hover:text-red-200"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Component selector */}
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-400">
            Select Component
          </h2>
          <div className="rounded border border-gray-700 bg-[#222] p-4">
            <input
              type="text"
              value={componentSearch}
              onChange={(e) => setComponentSearch(e.target.value)}
              placeholder="Search components by name or code..."
              className="mb-3 w-full rounded border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-gray-500"
            />
            <select
              value={selectedComponentId}
              onChange={(e) => handleSelectComponent(e.target.value)}
              className="w-full rounded border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm text-white outline-none focus:border-gray-500"
              size={Math.min(filteredComponents.length + 1, 10)}
            >
              <option value="">-- Select a component --</option>
              {filteredComponents.map((comp) => (
                <option key={comp.id} value={comp.id}>
                  {comp.name} ({comp.code})
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Fabric category checklist */}
        {selectedComponentId && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wider text-gray-400">
                Fabric Categories for: {selectedComponent?.name ?? "Unknown"}
              </h2>
              <span className="text-sm text-gray-400">
                {linkedCategoryIds.size} categor
                {linkedCategoryIds.size === 1 ? "y" : "ies"} linked
              </span>
            </div>

            {loadingRules ? (
              <p className="text-gray-400 text-sm">Loading rules...</p>
            ) : (
              <div className="space-y-4">
                {groups.map((group) => {
                  const hasChildren = group.children.length > 0;
                  const categoriesToShow = hasChildren
                    ? group.children
                    : [group.parent];

                  return (
                    <div
                      key={group.parent.id}
                      className="rounded border border-gray-700 bg-[#222] p-4"
                    >
                      <h3 className="mb-3 text-sm font-semibold text-white">
                        {group.parent.name}
                        {group.parent.hidden && (
                          <span className="ml-2 rounded bg-yellow-900/40 px-1.5 py-0.5 text-xs text-yellow-400">
                            hidden
                          </span>
                        )}
                      </h3>

                      <div className="space-y-2">
                        {categoriesToShow.map((cat) => {
                          const isLinked = linkedCategoryIds.has(cat.id);
                          const isToggling = togglingId === cat.id;

                          return (
                            <label
                              key={cat.id}
                              className={`flex cursor-pointer items-center gap-3 rounded px-3 py-2 transition-colors ${
                                isLinked
                                  ? "bg-green-900/20 border border-green-800/40"
                                  : "hover:bg-[#2a2a2a]"
                              } ${isToggling ? "opacity-50" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={isLinked}
                                onChange={() => handleToggleCategory(cat.id)}
                                disabled={isToggling}
                                className="h-4 w-4 accent-green-500"
                              />
                              <span className="text-sm text-white">
                                {hasChildren ? cat.name : "All fabrics"}
                              </span>
                              {cat.hidden && (
                                <span className="rounded bg-yellow-900/40 px-1.5 py-0.5 text-xs text-yellow-400">
                                  hidden
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                {cat.slug}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {orphanCategories.length > 0 && (
                  <div className="rounded border border-gray-700 bg-[#222] p-4">
                    <h3 className="mb-3 text-sm font-semibold text-white">
                      Other Categories
                    </h3>
                    <div className="space-y-2">
                      {orphanCategories.map((cat) => {
                        const isLinked = linkedCategoryIds.has(cat.id);
                        const isToggling = togglingId === cat.id;

                        return (
                          <label
                            key={cat.id}
                            className={`flex cursor-pointer items-center gap-3 rounded px-3 py-2 transition-colors ${
                              isLinked
                                ? "bg-green-900/20 border border-green-800/40"
                                : "hover:bg-[#2a2a2a]"
                            } ${isToggling ? "opacity-50" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={isLinked}
                              onChange={() => handleToggleCategory(cat.id)}
                              disabled={isToggling}
                              className="h-4 w-4 accent-green-500"
                            />
                            <span className="text-sm text-white">
                              {cat.name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {cat.slug}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {groups.length === 0 && (
              <p className="text-gray-500 text-sm">
                No fabric categories found. Create categories on the Fabrics
                page first.
              </p>
            )}
          </section>
        )}

        {!selectedComponentId && (
          <p className="text-gray-500 text-sm">
            Select a component above to manage its fabric category rules.
          </p>
        )}
      </div>
    </div>
  );
}
