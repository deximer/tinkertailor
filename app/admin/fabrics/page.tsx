"use client";

import { useEffect, useState, useCallback } from "react";

interface FabricCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  merchandisingOrder: number;
  hidden: boolean;
  createdAt: string;
}

interface FabricSkin {
  id: string;
  name: string;
  fabricCode: string;
  categoryId: string;
  modelType: string | null;
  priceMarkup: string;
  hidden: boolean;
  createdAt: string;
}

interface CategoryNode {
  category: FabricCategory;
  children: FabricCategory[];
  skinCount: number;
}

const MESH_VARIANTS = ["heavy", "light", "standard", "none"] as const;

export default function AdminFabricsPage() {
  const [categories, setCategories] = useState<FabricCategory[]>([]);
  const [skins, setSkins] = useState<FabricSkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Category create form
  const [newParentName, setNewParentName] = useState("");
  const [newChildForms, setNewChildForms] = useState<
    Record<string, string>
  >({});

  // Category editing
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [editCategoryName, setEditCategoryName] = useState("");

  // Fabric skins section
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [skinCreateForms, setSkinCreateForms] = useState<
    Record<
      string,
      {
        name: string;
        fabricCode: string;
        modelType: string;
        priceMarkup: string;
      }
    >
  >({});
  const [editingSkinId, setEditingSkinId] = useState<string | null>(null);
  const [editSkinForm, setEditSkinForm] = useState({
    name: "",
    fabricCode: "",
    modelType: "none",
    priceMarkup: "0",
  });

  // Confirm delete
  const [confirmDeleteSkinId, setConfirmDeleteSkinId] = useState<string | null>(
    null,
  );

  // Search
  const [skinSearch, setSkinSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, skinRes] = await Promise.all([
        fetch("/api/admin/fabric-categories"),
        fetch("/api/admin/fabric-skins"),
      ]);

      if (catRes.ok) setCategories(await catRes.json());
      if (skinRes.ok) setSkins(await skinRes.json());
    } catch {
      setErrorMsg("Failed to load data");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build the 2-level tree
  const parentCategories = categories
    .filter((c) => c.parentId === null)
    .sort((a, b) => a.merchandisingOrder - b.merchandisingOrder);

  const buildTree = (): CategoryNode[] =>
    parentCategories.map((parent) => {
      const children = categories
        .filter((c) => c.parentId === parent.id)
        .sort((a, b) => a.merchandisingOrder - b.merchandisingOrder);

      const allIds = [parent.id, ...children.map((c) => c.id)];
      const skinCount = skins.filter((s) => allIds.includes(s.categoryId))
        .length;

      return { category: parent, children, skinCount };
    });

  const tree = buildTree();

  const skinCountForCategory = (catId: string) =>
    skins.filter((s) => s.categoryId === catId).length;

  // --- Category handlers ---
  const handleCreateParent = async () => {
    if (!newParentName.trim()) return;
    setErrorMsg(null);

    const res = await fetch("/api/admin/fabric-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newParentName.trim(),
        parentId: null,
        merchandisingOrder: parentCategories.length,
      }),
    });

    if (res.ok) {
      const created: FabricCategory = await res.json();
      setCategories((prev) => [...prev, created]);
      setNewParentName("");
    } else {
      const data = await res.json();
      setErrorMsg(data.error ?? "Failed to create category");
    }
  };

  const handleCreateChild = async (parentId: string) => {
    const name = (newChildForms[parentId] ?? "").trim();
    if (!name) return;
    setErrorMsg(null);

    const siblings = categories.filter((c) => c.parentId === parentId);

    const res = await fetch("/api/admin/fabric-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        parentId,
        merchandisingOrder: siblings.length,
      }),
    });

    if (res.ok) {
      const created: FabricCategory = await res.json();
      setCategories((prev) => [...prev, created]);
      setNewChildForms((prev) => ({ ...prev, [parentId]: "" }));
    } else {
      const data = await res.json();
      setErrorMsg(data.error ?? "Failed to create child category");
    }
  };

  const handleUpdateCategory = async (
    id: string,
    updates: Partial<FabricCategory>,
  ) => {
    setErrorMsg(null);
    const res = await fetch("/api/admin/fabric-categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });

    if (res.ok) {
      const updated: FabricCategory = await res.json();
      setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setEditingCategoryId(null);
    } else {
      const data = await res.json();
      setErrorMsg(data.error ?? "Failed to update category");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setErrorMsg(null);
    const res = await fetch(`/api/admin/fabric-categories?id=${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } else {
      const data = await res.json();
      setErrorMsg(data.error ?? "Failed to delete category");
    }
  };

  const handleMoveCategory = async (
    cat: FabricCategory,
    direction: "up" | "down",
  ) => {
    const siblings = categories
      .filter((c) =>
        cat.parentId === null ? c.parentId === null : c.parentId === cat.parentId,
      )
      .sort((a, b) => a.merchandisingOrder - b.merchandisingOrder);

    const idx = siblings.findIndex((s) => s.id === cat.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;

    const other = siblings[swapIdx];
    await Promise.all([
      handleUpdateCategory(cat.id, {
        merchandisingOrder: other.merchandisingOrder,
      }),
      handleUpdateCategory(other.id, {
        merchandisingOrder: cat.merchandisingOrder,
      }),
    ]);
  };

  const handleToggleHidden = async (cat: FabricCategory) => {
    await handleUpdateCategory(cat.id, { hidden: !cat.hidden });
  };

  // --- Fabric skin handlers ---
  const getSkinCreateForm = (categoryId: string) =>
    skinCreateForms[categoryId] ?? {
      name: "",
      fabricCode: "",
      modelType: "none",
      priceMarkup: "0",
    };

  const updateSkinCreateForm = (
    categoryId: string,
    field: string,
    value: string,
  ) => {
    setSkinCreateForms((prev) => ({
      ...prev,
      [categoryId]: { ...getSkinCreateForm(categoryId), [field]: value },
    }));
  };

  const handleCreateSkin = async (categoryId: string) => {
    const form = getSkinCreateForm(categoryId);
    if (!form.name || !form.fabricCode) return;
    setErrorMsg(null);

    const res = await fetch("/api/admin/fabric-skins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        fabricCode: form.fabricCode,
        categoryId,
        modelType: form.modelType === "none" || !form.modelType ? null : form.modelType,
        priceMarkup: form.priceMarkup || "0",
      }),
    });

    if (res.ok) {
      const created: FabricSkin = await res.json();
      setSkins((prev) => [...prev, created]);
      setSkinCreateForms((prev) => ({
        ...prev,
        [categoryId]: {
          name: "",
          fabricCode: "",
          modelType: "none",
          priceMarkup: "0",
        },
      }));
    } else {
      const data = await res.json();
      setErrorMsg(data.error ?? "Failed to create fabric skin");
    }
  };

  const startEditSkin = (skin: FabricSkin) => {
    setEditingSkinId(skin.id);
    setEditSkinForm({
      name: skin.name,
      fabricCode: skin.fabricCode,
      modelType: skin.modelType ?? "none",
      priceMarkup: skin.priceMarkup,
    });
    setErrorMsg(null);
  };

  const handleUpdateSkin = async () => {
    if (!editingSkinId) return;
    setErrorMsg(null);

    const res = await fetch("/api/admin/fabric-skins", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingSkinId,
        name: editSkinForm.name,
        fabricCode: editSkinForm.fabricCode,
        modelType: editSkinForm.modelType === "none" || !editSkinForm.modelType ? null : editSkinForm.modelType,
        priceMarkup: editSkinForm.priceMarkup,
      }),
    });

    if (res.ok) {
      const updated: FabricSkin = await res.json();
      setSkins((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setEditingSkinId(null);
    } else {
      const data = await res.json();
      setErrorMsg(data.error ?? "Failed to update fabric skin");
    }
  };

  const handleToggleSkinHidden = async (skin: FabricSkin) => {
    setErrorMsg(null);
    const res = await fetch("/api/admin/fabric-skins", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: skin.id, hidden: !skin.hidden }),
    });

    if (res.ok) {
      const updated: FabricSkin = await res.json();
      setSkins((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } else {
      const data = await res.json();
      setErrorMsg(data.error ?? "Failed to toggle visibility");
    }
  };

  const handleDeleteSkin = async (id: string) => {
    setErrorMsg(null);
    setConfirmDeleteSkinId(null);

    const res = await fetch(`/api/admin/fabric-skins?id=${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setSkins((prev) => prev.filter((s) => s.id !== id));
      if (editingSkinId === id) setEditingSkinId(null);
    } else {
      const data = await res.json();
      setErrorMsg(data.error ?? "Failed to delete fabric skin");
    }
  };

  // Filtered skins for search
  const filteredSkins = skinSearch.trim()
    ? skins.filter(
        (s) =>
          s.name.toLowerCase().includes(skinSearch.toLowerCase()) ||
          s.fabricCode.toLowerCase().includes(skinSearch.toLowerCase()),
      )
    : null;

  // All category IDs (for the skins section)
  const allCategories = categories.sort(
    (a, b) => a.merchandisingOrder - b.merchandisingOrder,
  );

  const getCategoryName = (catId: string) =>
    categories.find((c) => c.id === catId)?.name ?? "Unknown";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <p className="text-gray-400 text-sm">Loading fabrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            Tinker Tailor — Fabrics
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

        {/* Section 1: Fabric Categories tree */}
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-400">
            Fabric Categories
          </h2>

          {tree.map((node) => (
            <div
              key={node.category.id}
              className="mb-4 rounded border border-gray-700 bg-[#222] p-4"
            >
              {/* Parent row */}
              <div className="flex items-center gap-3">
                {editingCategoryId === node.category.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="text"
                      value={editCategoryName}
                      onChange={(e) => setEditCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          handleUpdateCategory(node.category.id, {
                            name: editCategoryName,
                          });
                        if (e.key === "Escape") setEditingCategoryId(null);
                      }}
                      className="flex-1 rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white"
                      autoFocus
                    />
                    <button
                      onClick={() =>
                        handleUpdateCategory(node.category.id, {
                          name: editCategoryName,
                        })
                      }
                      className="text-xs text-green-400 hover:text-green-300"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingCategoryId(null)}
                      className="text-xs text-gray-400 hover:text-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingCategoryId(node.category.id);
                      setEditCategoryName(node.category.name);
                    }}
                    className="text-sm font-semibold text-white hover:text-gray-300"
                  >
                    {node.category.name}
                  </button>
                )}

                <span className="text-xs text-gray-500">
                  {node.skinCount} skin{node.skinCount !== 1 ? "s" : ""}
                </span>

                {node.category.hidden && (
                  <span className="rounded bg-yellow-900/40 px-1.5 py-0.5 text-xs text-yellow-400">
                    hidden
                  </span>
                )}

                <span className="text-xs text-gray-600">
                  #{node.category.merchandisingOrder}
                </span>

                <div className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => handleMoveCategory(node.category, "up")}
                    className="rounded border border-gray-700 px-1.5 py-0.5 text-xs text-gray-400 hover:bg-[#2a2a2a] hover:text-white"
                    title="Move up"
                  >
                    ^
                  </button>
                  <button
                    onClick={() => handleMoveCategory(node.category, "down")}
                    className="rounded border border-gray-700 px-1.5 py-0.5 text-xs text-gray-400 hover:bg-[#2a2a2a] hover:text-white"
                    title="Move down"
                  >
                    v
                  </button>
                  <button
                    onClick={() => handleToggleHidden(node.category)}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    {node.category.hidden ? "Show" : "Hide"}
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(node.category.id)}
                    disabled={node.skinCount > 0 || node.children.length > 0}
                    className="text-xs text-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:text-gray-600"
                    title={
                      node.skinCount > 0 || node.children.length > 0
                        ? "Has children or skins"
                        : "Delete category"
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Children rows */}
              {node.children.length > 0 && (
                <div className="mt-3 ml-6 space-y-2">
                  {node.children.map((child) => {
                    const childSkinCount = skinCountForCategory(child.id);
                    return (
                      <div
                        key={child.id}
                        className="flex items-center gap-3 border-l border-gray-700 pl-3"
                      >
                        {editingCategoryId === child.id ? (
                          <div className="flex flex-1 items-center gap-2">
                            <input
                              type="text"
                              value={editCategoryName}
                              onChange={(e) =>
                                setEditCategoryName(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  handleUpdateCategory(child.id, {
                                    name: editCategoryName,
                                  });
                                if (e.key === "Escape")
                                  setEditingCategoryId(null);
                              }}
                              className="flex-1 rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white"
                              autoFocus
                            />
                            <button
                              onClick={() =>
                                handleUpdateCategory(child.id, {
                                  name: editCategoryName,
                                })
                              }
                              className="text-xs text-green-400 hover:text-green-300"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingCategoryId(null)}
                              className="text-xs text-gray-400 hover:text-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingCategoryId(child.id);
                              setEditCategoryName(child.name);
                            }}
                            className="text-sm text-white hover:text-gray-300"
                          >
                            {child.name}
                          </button>
                        )}

                        <span className="text-xs text-gray-500">
                          {childSkinCount} skin
                          {childSkinCount !== 1 ? "s" : ""}
                        </span>

                        {child.hidden && (
                          <span className="rounded bg-yellow-900/40 px-1.5 py-0.5 text-xs text-yellow-400">
                            hidden
                          </span>
                        )}

                        <span className="text-xs text-gray-600">
                          #{child.merchandisingOrder}
                        </span>

                        <div className="ml-auto flex items-center gap-1">
                          <button
                            onClick={() => handleMoveCategory(child, "up")}
                            className="rounded border border-gray-700 px-1.5 py-0.5 text-xs text-gray-400 hover:bg-[#2a2a2a] hover:text-white"
                          >
                            ^
                          </button>
                          <button
                            onClick={() => handleMoveCategory(child, "down")}
                            className="rounded border border-gray-700 px-1.5 py-0.5 text-xs text-gray-400 hover:bg-[#2a2a2a] hover:text-white"
                          >
                            v
                          </button>
                          <button
                            onClick={() => handleToggleHidden(child)}
                            className="text-xs text-gray-400 hover:text-white"
                          >
                            {child.hidden ? "Show" : "Hide"}
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(child.id)}
                            disabled={childSkinCount > 0}
                            className="text-xs text-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:text-gray-600"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Inline create child form */}
              <div className="mt-3 ml-6 flex items-center gap-2 border-t border-gray-700 pt-3">
                <input
                  type="text"
                  value={newChildForms[node.category.id] ?? ""}
                  onChange={(e) =>
                    setNewChildForms((prev) => ({
                      ...prev,
                      [node.category.id]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      handleCreateChild(node.category.id);
                  }}
                  placeholder="New child category"
                  className="rounded border border-gray-700 bg-[#1a1a1a] px-2 py-1 text-sm text-white placeholder-gray-600"
                />
                <button
                  onClick={() => handleCreateChild(node.category.id)}
                  disabled={!(newChildForms[node.category.id] ?? "").trim()}
                  className="rounded bg-white px-3 py-1 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  Add Child
                </button>
              </div>
            </div>
          ))}

          {/* Create new top-level category */}
          <div className="mt-4 flex items-center gap-2">
            <input
              type="text"
              value={newParentName}
              onChange={(e) => setNewParentName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateParent();
              }}
              placeholder="New top-level category"
              className="rounded border border-gray-700 bg-[#2a2a2a] px-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-gray-500"
            />
            <button
              onClick={handleCreateParent}
              disabled={!newParentName.trim()}
              className="rounded bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              Add Category
            </button>
          </div>
        </section>

        {/* Section 2: Fabric Skins */}
        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-400">
            Fabric Skins
          </h2>

          {/* Search bar */}
          <div className="mb-4">
            <input
              type="text"
              value={skinSearch}
              onChange={(e) => setSkinSearch(e.target.value)}
              placeholder="Search skins by code or name..."
              className="w-full rounded border border-gray-700 bg-[#2a2a2a] px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-gray-500"
            />
          </div>

          {/* Search results mode */}
          {filteredSkins !== null ? (
            <div className="rounded border border-gray-700 bg-[#222] p-4">
              <p className="mb-3 text-xs text-gray-400">
                {filteredSkins.length} result
                {filteredSkins.length !== 1 ? "s" : ""} matching &quot;
                {skinSearch}&quot;
              </p>
              {filteredSkins.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wider text-gray-500">
                      <th className="pb-2">Code</th>
                      <th className="pb-2">Name</th>
                      <th className="pb-2">Category</th>
                      <th className="pb-2">Mesh Variant</th>
                      <th className="pb-2">Price Markup</th>
                      <th className="pb-2">Hidden</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSkins.map((skin) => (
                      <tr key={skin.id} className="border-b border-gray-800">
                        <td className="py-2 text-gray-400">
                          {skin.fabricCode}
                        </td>
                        <td className="py-2 text-white">{skin.name}</td>
                        <td className="py-2 text-gray-400">
                          {getCategoryName(skin.categoryId)}
                        </td>
                        <td className="py-2 text-gray-400">
                          {skin.modelType ?? (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                        <td className="py-2 text-gray-400">
                          {skin.priceMarkup}
                        </td>
                        <td className="py-2">
                          {skin.hidden && (
                            <span className="rounded bg-yellow-900/40 px-1.5 py-0.5 text-xs text-yellow-400">
                              hidden
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            /* Normal category-grouped view */
            allCategories.map((cat) => {
              const catSkins = skins.filter((s) => s.categoryId === cat.id);
              const isExpanded = expandedCategory === cat.id;

              return (
                <div
                  key={cat.id}
                  className="mb-3 rounded border border-gray-700 bg-[#222]"
                >
                  <button
                    onClick={() =>
                      setExpandedCategory(isExpanded ? null : cat.id)
                    }
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#2a2a2a] transition-colors"
                  >
                    <span className="text-sm font-medium text-white">
                      {cat.name}
                      <span className="ml-2 text-xs text-gray-500">
                        ({catSkins.length} skin
                        {catSkins.length !== 1 ? "s" : ""})
                      </span>
                      {cat.hidden && (
                        <span className="ml-2 rounded bg-yellow-900/40 px-1.5 py-0.5 text-xs text-yellow-400">
                          hidden
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-gray-500">
                      {isExpanded ? "Collapse" : "Expand"}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-700 px-4 py-3">
                      {catSkins.length > 0 ? (
                        <table className="w-full text-sm mb-4">
                          <thead>
                            <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wider text-gray-500">
                              <th className="pb-2">Code</th>
                              <th className="pb-2">Name</th>
                              <th className="pb-2">Mesh Variant</th>
                              <th className="pb-2">Price Markup</th>
                              <th className="pb-2">Hidden</th>
                              <th className="pb-2" />
                            </tr>
                          </thead>
                          <tbody>
                            {catSkins.map((skin) => (
                              <tr
                                key={skin.id}
                                className="group border-b border-gray-800"
                              >
                                {editingSkinId === skin.id ? (
                                  <>
                                    <td className="py-2 pr-2">
                                      <input
                                        type="text"
                                        value={editSkinForm.fabricCode}
                                        onChange={(e) =>
                                          setEditSkinForm((f) => ({
                                            ...f,
                                            fabricCode: e.target.value,
                                          }))
                                        }
                                        className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white"
                                      />
                                    </td>
                                    <td className="py-2 pr-2">
                                      <input
                                        type="text"
                                        value={editSkinForm.name}
                                        onChange={(e) =>
                                          setEditSkinForm((f) => ({
                                            ...f,
                                            name: e.target.value,
                                          }))
                                        }
                                        className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white"
                                      />
                                    </td>
                                    <td className="py-2 pr-2">
                                      <select
                                        value={editSkinForm.modelType}
                                        onChange={(e) =>
                                          setEditSkinForm((f) => ({
                                            ...f,
                                            modelType: e.target.value,
                                          }))
                                        }
                                        className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white"
                                      >
                                        {MESH_VARIANTS.map((v) => (
                                          <option key={v} value={v}>
                                            {v === "none" ? "None" : v}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="py-2 pr-2">
                                      <input
                                        type="text"
                                        value={editSkinForm.priceMarkup}
                                        onChange={(e) =>
                                          setEditSkinForm((f) => ({
                                            ...f,
                                            priceMarkup: e.target.value,
                                          }))
                                        }
                                        className="w-24 rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white"
                                      />
                                    </td>
                                    <td className="py-2" />
                                    <td className="py-2 text-right space-x-2">
                                      <button
                                        onClick={handleUpdateSkin}
                                        className="rounded bg-white px-2 py-1 text-xs font-medium text-black hover:bg-gray-200 transition-colors"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => setEditingSkinId(null)}
                                        className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-[#2a2a2a] transition-colors"
                                      >
                                        Cancel
                                      </button>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="py-2 text-gray-400">
                                      {skin.fabricCode}
                                    </td>
                                    <td className="py-2 text-white">
                                      {skin.name}
                                    </td>
                                    <td className="py-2 text-gray-400">
                                      {skin.modelType ?? (
                                        <span className="text-gray-600">-</span>
                                      )}
                                    </td>
                                    <td className="py-2 text-gray-400">
                                      {skin.priceMarkup}
                                    </td>
                                    <td className="py-2">
                                      <button
                                        onClick={() =>
                                          handleToggleSkinHidden(skin)
                                        }
                                        className={`h-5 w-5 rounded border ${
                                          skin.hidden
                                            ? "border-yellow-600 bg-yellow-900/40"
                                            : "border-gray-600 bg-[#1a1a1a]"
                                        }`}
                                        title={
                                          skin.hidden
                                            ? "Click to show"
                                            : "Click to hide"
                                        }
                                      >
                                        {skin.hidden && (
                                          <span className="text-xs text-yellow-400">
                                            H
                                          </span>
                                        )}
                                      </button>
                                    </td>
                                    <td className="py-2 text-right space-x-2">
                                      <button
                                        onClick={() => startEditSkin(skin)}
                                        className="text-blue-400 hover:text-blue-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        Edit
                                      </button>
                                      {confirmDeleteSkinId === skin.id ? (
                                        <>
                                          <button
                                            onClick={() =>
                                              handleDeleteSkin(skin.id)
                                            }
                                            className="text-xs text-red-400 hover:text-red-300"
                                          >
                                            Confirm
                                          </button>
                                          <button
                                            onClick={() =>
                                              setConfirmDeleteSkinId(null)
                                            }
                                            className="text-xs text-gray-400 hover:text-gray-300"
                                          >
                                            No
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          onClick={() =>
                                            setConfirmDeleteSkinId(skin.id)
                                          }
                                          className="text-red-400 hover:text-red-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          Delete
                                        </button>
                                      )}
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="mb-4 text-xs text-gray-500">
                          No fabric skins in this category
                        </p>
                      )}

                      {/* Inline create skin form */}
                      <div className="flex items-end gap-2 border-t border-gray-700 pt-3">
                        <div className="flex-1">
                          <label className="mb-1 block text-xs text-gray-500">
                            Code
                          </label>
                          <input
                            type="text"
                            value={getSkinCreateForm(cat.id).fabricCode}
                            onChange={(e) =>
                              updateSkinCreateForm(
                                cat.id,
                                "fabricCode",
                                e.target.value,
                              )
                            }
                            placeholder="FAB-001"
                            className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white placeholder-gray-600"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="mb-1 block text-xs text-gray-500">
                            Name
                          </label>
                          <input
                            type="text"
                            value={getSkinCreateForm(cat.id).name}
                            onChange={(e) =>
                              updateSkinCreateForm(
                                cat.id,
                                "name",
                                e.target.value,
                              )
                            }
                            placeholder="Silk Charmeuse"
                            className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white placeholder-gray-600"
                          />
                        </div>
                        <div className="w-28">
                          <label className="mb-1 block text-xs text-gray-500">
                            Mesh Variant
                          </label>
                          <select
                            value={getSkinCreateForm(cat.id).modelType}
                            onChange={(e) =>
                              updateSkinCreateForm(
                                cat.id,
                                "modelType",
                                e.target.value,
                              )
                            }
                            className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white"
                          >
                            {MESH_VARIANTS.map((v) => (
                              <option key={v} value={v}>
                                {v === "none" ? "None" : v}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-24">
                          <label className="mb-1 block text-xs text-gray-500">
                            Markup
                          </label>
                          <input
                            type="text"
                            value={getSkinCreateForm(cat.id).priceMarkup}
                            onChange={(e) =>
                              updateSkinCreateForm(
                                cat.id,
                                "priceMarkup",
                                e.target.value,
                              )
                            }
                            placeholder="0.00"
                            className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white placeholder-gray-600"
                          />
                        </div>
                        <button
                          onClick={() => handleCreateSkin(cat.id)}
                          disabled={
                            !getSkinCreateForm(cat.id).name ||
                            !getSkinCreateForm(cat.id).fabricCode
                          }
                          className="rounded bg-white px-3 py-1 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50 transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {categories.length === 0 && (
            <p className="text-gray-500 text-sm">
              No fabric categories yet. Create categories above first.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
