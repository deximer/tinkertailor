"use client";

import { useEffect, useState } from "react";

interface ComponentType {
  id: string;
  name: string;
  slug: string;
  designStage: string;
  garmentPart: string | null;
}

interface Component {
  id: string;
  name: string;
  assetCode: string;
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

interface Rule {
  componentId: string;
  fabricCategoryId: string;
}

interface ColDef {
  id: string;
  name: string;
  hidden: boolean;
  parentId: string;
}

interface ColGroup {
  parentName: string;
  count: number;
}

export default function ComponentFabricRulesPage() {
  const [componentTypes, setComponentTypes] = useState<ComponentType[]>([]);
  const [allComponents, setAllComponents] = useState<Component[]>([]);
  const [categories, setCategories] = useState<FabricCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [edgeSet, setEdgeSet] = useState<Set<string>>(new Set());
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        const [typesRes, compsRes, catRes, rulesRes] = await Promise.all([
          fetch("/api/component-types"),
          fetch("/api/admin/components"),
          fetch("/api/admin/fabric-categories"),
          fetch("/api/admin/component-fabric-rules"),
        ]);

        if (typesRes.ok) {
          const types: ComponentType[] = await typesRes.json();
          setComponentTypes(types);
          if (types.length > 0) setSelectedTypeId(types[0].id);
        }
        if (compsRes.ok) setAllComponents(await compsRes.json());
        if (catRes.ok) setCategories(await catRes.json());
        if (rulesRes.ok) {
          const rules: Rule[] = await rulesRes.json();
          setEdgeSet(
            new Set(rules.map((r) => `${r.componentId}:${r.fabricCategoryId}`)),
          );
        }
      } catch {
        setErrorMsg("Failed to load data");
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleToggle = async (componentId: string, categoryId: string) => {
    const key = `${componentId}:${categoryId}`;
    const isLinked = edgeSet.has(key);

    setToggling((prev) => new Set(prev).add(key));
    setEdgeSet((prev) => {
      const next = new Set(prev);
      if (isLinked) next.delete(key); else next.add(key);
      return next;
    });

    try {
      const res = await fetch("/api/admin/component-fabric-rules", {
        method: isLinked ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ componentId, fabricCategoryId: categoryId }),
      });
      if (!res.ok) {
        setEdgeSet((prev) => {
          const next = new Set(prev);
          if (isLinked) next.add(key); else next.delete(key);
          return next;
        });
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to update rule");
      }
    } catch {
      setEdgeSet((prev) => {
        const next = new Set(prev);
        if (isLinked) next.add(key); else next.delete(key);
        return next;
      });
      setErrorMsg("Failed to update rule");
    }

    setToggling((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  // Build column definitions grouped by parent
  const parentCats = categories
    .filter((c) => c.parentId === null)
    .sort((a, b) => a.merchandisingOrder - b.merchandisingOrder);

  const cols: ColDef[] = [];
  const colGroups: ColGroup[] = [];

  for (const parent of parentCats) {
    const children = categories
      .filter((c) => c.parentId === parent.id)
      .sort((a, b) => a.merchandisingOrder - b.merchandisingOrder);

    if (children.length > 0) {
      colGroups.push({ parentName: parent.name, count: children.length });
      for (const child of children) {
        cols.push({ id: child.id, name: child.name, hidden: child.hidden, parentId: parent.id });
      }
    } else {
      colGroups.push({ parentName: parent.name, count: 1 });
      cols.push({ id: parent.id, name: parent.name, hidden: parent.hidden, parentId: parent.id });
    }
  }

  const rows = selectedTypeId
    ? allComponents.filter((c) => c.componentTypeId === selectedTypeId)
    : allComponents;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
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

        {/* Component type filter */}
        <div className="mb-6 flex items-center gap-3">
          <label className="text-xs text-gray-500 whitespace-nowrap">
            Component Type
          </label>
          <select
            value={selectedTypeId}
            onChange={(e) => setSelectedTypeId(e.target.value)}
            className="rounded border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm text-white"
          >
            <option value="">All types</option>
            {componentTypes.map((ct) => (
              <option key={ct.id} value={ct.id}>
                {ct.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-500">
            {rows.length} component{rows.length !== 1 ? "s" : ""}
          </span>
        </div>

        {cols.length === 0 && (
          <p className="text-gray-500 text-sm">
            No fabric categories found. Create categories on the Fabrics page
            first.
          </p>
        )}

        {cols.length > 0 && rows.length === 0 && (
          <p className="text-gray-500 text-sm">
            No components found for this type.
          </p>
        )}

        {cols.length > 0 && rows.length > 0 && (
          <div className="rounded border border-gray-700 bg-[#222] overflow-auto">
            <table className="text-sm border-collapse">
              <thead>
                {/* Parent group header row */}
                <tr className="sticky top-0 z-10 bg-[#222]">
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-20 bg-[#222] border-b border-r border-gray-700 px-3 py-2 min-w-[180px] text-left text-xs uppercase tracking-wider text-gray-500"
                  >
                    Component
                  </th>
                  {colGroups.map((group, i) => (
                    <th
                      key={i}
                      colSpan={group.count}
                      className="border-b border-l border-gray-700 px-2 py-1.5 text-center text-xs font-medium text-gray-300 whitespace-nowrap"
                    >
                      {group.parentName}
                    </th>
                  ))}
                </tr>
                {/* Leaf column headers */}
                <tr className="sticky top-[33px] z-10 bg-[#222]">
                  {cols.map((col) => (
                    <th
                      key={col.id}
                      className="border-b border-l border-gray-700 px-2 py-1.5 text-center text-xs text-gray-400 font-normal min-w-[48px]"
                      title={col.name}
                    >
                      <div className="truncate max-w-[60px]">{col.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((comp) => (
                  <tr
                    key={comp.id}
                    className="border-b border-gray-800 hover:bg-[#2a2a2a]"
                  >
                    <td
                      className="sticky left-0 bg-[#222] border-r border-gray-700 px-3 py-1.5 text-xs text-white font-medium whitespace-nowrap"
                      title={comp.assetCode}
                    >
                      {comp.name}
                    </td>
                    {cols.map((col) => {
                      const key = `${comp.id}:${col.id}`;
                      const isChecked = edgeSet.has(key);
                      const isToggling = toggling.has(key);
                      return (
                        <td
                          key={col.id}
                          className="border-l border-gray-800 px-2 py-1.5 text-center"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isToggling}
                            onChange={() => handleToggle(comp.id, col.id)}
                            className="h-4 w-4 rounded border-gray-600 bg-[#1a1a1a] accent-white cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
