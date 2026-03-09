"use client";

import { useEffect, useState, useCallback } from "react";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type ComponentType = {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  designStage: "silhouette" | "embellishment" | "finishing";
  isAnchor: boolean;
  garmentPart: "bodice" | "skirt" | "sleeve" | "embellishment" | "finishing" | null;
  componentCount: number;
};

type ComponentTypeFromApi = Omit<ComponentType, "componentCount">;

type ComponentRow = {
  componentTypeId: string;
};

const STAGES = ["silhouette", "embellishment", "finishing"] as const;

const GARMENT_PARTS = ["bodice", "skirt", "sleeve", "embellishment", "finishing"] as const;

const stageBadgeColors: Record<string, string> = {
  silhouette: "bg-blue-900/50 text-blue-300",
  embellishment: "bg-purple-900/50 text-purple-300",
  finishing: "bg-amber-900/50 text-amber-300",
};

const garmentPartBadgeColors: Record<string, string> = {
  bodice: "bg-pink-900/50 text-pink-300",
  skirt: "bg-teal-900/50 text-teal-300",
  sleeve: "bg-cyan-900/50 text-cyan-300",
  embellishment: "bg-purple-900/50 text-purple-300",
  finishing: "bg-amber-900/50 text-amber-300",
};

export default function ComponentTypesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [componentTypes, setComponentTypes] = useState<ComponentType[]>([]);
  const [loading, setLoading] = useState(true);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const [newTypeForms, setNewTypeForms] = useState<
    Record<string, { name: string; designStage: string; isAnchor: boolean; garmentPart: string | null }>
  >({});
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeFields, setEditingTypeFields] = useState<{
    name: string;
    designStage: string;
    isAnchor: boolean;
    garmentPart: string | null;
  }>({ name: "", designStage: "silhouette", isAnchor: false, garmentPart: null });
  const [savingType, setSavingType] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, typeRes, compRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/component-types"),
        fetch("/api/components"),
      ]);

      if (catRes.ok && typeRes.ok && compRes.ok) {
        const cats: Category[] = await catRes.json();
        const types: ComponentTypeFromApi[] = await typeRes.json();
        const comps: ComponentRow[] = await compRes.json();

        const countMap = new Map<string, number>();
        for (const c of comps) {
          const typeId = c.componentTypeId;
          countMap.set(typeId, (countMap.get(typeId) ?? 0) + 1);
        }

        setCategories(cats);
        setComponentTypes(
          types.map((t) => ({
            ...t,
            componentCount: countMap.get(t.id) ?? 0,
          })),
        );
      }
    } catch {
      setErrorMsg("Failed to load data");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const clearError = () => setErrorMsg(null);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    clearError();
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      if (res.ok) {
        setNewCategoryName("");
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to create category");
      }
    } catch {
      setErrorMsg("Failed to create category");
    }
    setSavingCategory(false);
  };

  const handleUpdateCategory = async () => {
    if (!editingCategoryId || !editingCategoryName.trim()) return;
    setSavingCategory(true);
    clearError();
    try {
      const res = await fetch("/api/admin/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingCategoryId,
          name: editingCategoryName.trim(),
        }),
      });
      if (res.ok) {
        setEditingCategoryId(null);
        setEditingCategoryName("");
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to update category");
      }
    } catch {
      setErrorMsg("Failed to update category");
    }
    setSavingCategory(false);
  };

  const handleDeleteCategory = async (id: string) => {
    clearError();
    try {
      const res = await fetch(`/api/admin/categories?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to delete category");
      }
    } catch {
      setErrorMsg("Failed to delete category");
    }
  };

  const categoryTypeCount = (catId: string) =>
    componentTypes.filter((t) => t.categoryId === catId).length;

  const handleCreateType = async (categoryId: string) => {
    const form = newTypeForms[categoryId];
    if (!form?.name.trim()) return;
    setSavingType(true);
    clearError();
    try {
      const res = await fetch("/api/admin/component-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          categoryId,
          designStage: form.designStage || "silhouette",
          isAnchor: form.isAnchor,
          garmentPart: form.garmentPart || null,
        }),
      });
      if (res.ok) {
        setNewTypeForms((prev) => {
          const next = { ...prev };
          delete next[categoryId];
          return next;
        });
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to create component type");
      }
    } catch {
      setErrorMsg("Failed to create component type");
    }
    setSavingType(false);
  };

  const handleUpdateType = async () => {
    if (!editingTypeId) return;
    setSavingType(true);
    clearError();
    try {
      const res = await fetch("/api/admin/component-types", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTypeId,
          name: editingTypeFields.name.trim(),
          designStage: editingTypeFields.designStage,
          isAnchor: editingTypeFields.isAnchor,
          garmentPart: editingTypeFields.garmentPart,
        }),
      });
      if (res.ok) {
        setEditingTypeId(null);
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to update component type");
      }
    } catch {
      setErrorMsg("Failed to update component type");
    }
    setSavingType(false);
  };

  const handleDeleteType = async (id: string) => {
    clearError();
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/admin/component-types?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to delete component type");
      }
    } catch {
      setErrorMsg("Failed to delete component type");
    }
  };

  const startEditType = (t: ComponentType) => {
    setEditingTypeId(t.id);
    setEditingTypeFields({
      name: t.name,
      designStage: t.designStage,
      isAnchor: t.isAnchor,
      garmentPart: t.garmentPart,
    });
  };

  const getNewTypeForm = (categoryId: string) =>
    newTypeForms[categoryId] ?? { name: "", designStage: "silhouette", isAnchor: false, garmentPart: null };

  const setNewTypeForm = (
    categoryId: string,
    patch: Partial<{ name: string; designStage: string; isAnchor: boolean; garmentPart: string | null }>,
  ) => {
    setNewTypeForms((prev) => ({
      ...prev,
      [categoryId]: { ...getNewTypeForm(categoryId), ...patch },
    }));
  };

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
        <h1 className="mb-8 text-xl font-bold tracking-tight">
          Pattern Library
        </h1>

        {errorMsg && (
          <div className="mb-6 rounded border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
            {errorMsg}
            <button
              onClick={clearError}
              className="ml-3 text-red-400 hover:text-red-200"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Categories section */}
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-400">
            Categories
          </h2>

          <div className="mb-4 flex flex-wrap gap-2">
            {categories.map((cat) => {
              const linked = categoryTypeCount(cat.id);
              const isEditing = editingCategoryId === cat.id;

              if (isEditing) {
                return (
                  <div
                    key={cat.id}
                    className="flex items-center gap-1 rounded-lg border border-gray-600 bg-[#2a2a2a] px-3 py-1.5"
                  >
                    <input
                      type="text"
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleUpdateCategory();
                        if (e.key === "Escape") setEditingCategoryId(null);
                      }}
                      className="w-28 bg-transparent text-sm text-white outline-none"
                      autoFocus
                    />
                    <button
                      onClick={handleUpdateCategory}
                      disabled={savingCategory}
                      className="text-xs text-green-400 hover:text-green-300 disabled:opacity-50"
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
                );
              }

              return (
                <div
                  key={cat.id}
                  className="group flex items-center gap-2 rounded-lg border border-gray-700 bg-[#2a2a2a] px-3 py-1.5"
                >
                  <button
                    onClick={() => {
                      setEditingCategoryId(cat.id);
                      setEditingCategoryName(cat.name);
                    }}
                    className="text-sm text-white hover:text-gray-300"
                  >
                    {cat.name}
                  </button>
                  <span className="text-xs text-gray-500">{cat.slug}</span>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    disabled={linked > 0}
                    className="text-xs text-red-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-300 disabled:cursor-not-allowed disabled:text-gray-600 disabled:opacity-100"
                    title={
                      linked > 0
                        ? `${linked} component type${linked > 1 ? "s" : ""} linked`
                        : "Delete category"
                    }
                  >
                    x
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateCategory();
              }}
              placeholder="New category name"
              className="rounded border border-gray-700 bg-[#2a2a2a] px-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-gray-500"
            />
            <button
              onClick={handleCreateCategory}
              disabled={savingCategory || !newCategoryName.trim()}
              className="rounded bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </section>

        {/* Component types section */}
        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-400">
            Component Types
          </h2>

          {categories.map((cat) => {
            const types = componentTypes.filter((t) => t.categoryId === cat.id);
            const form = getNewTypeForm(cat.id);

            return (
              <div key={cat.id} className="mb-8">
                <h3 className="mb-3 text-sm font-semibold text-gray-300">
                  {cat.name}
                </h3>

                {types.length > 0 ? (
                  <table className="mb-3 w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wider text-gray-500">
                        <th className="pb-2">Name</th>
                        <th className="pb-2">Slug</th>
                        <th className="pb-2">Stage</th>
                        <th className="pb-2">Garment Part</th>
                        <th className="pb-2">Anchor</th>
                        <th className="pb-2 text-right">Components</th>
                        <th className="pb-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {types.map((t) => {
                        const isEditing = editingTypeId === t.id;
                        const isConfirmingDelete = confirmDeleteId === t.id;

                        if (isEditing) {
                          return (
                            <tr key={t.id} className="border-b border-gray-800">
                              <td className="py-2">
                                <input
                                  type="text"
                                  value={editingTypeFields.name}
                                  onChange={(e) =>
                                    setEditingTypeFields((f) => ({
                                      ...f,
                                      name: e.target.value,
                                    }))
                                  }
                                  className="w-full rounded border border-gray-600 bg-[#2a2a2a] px-2 py-1 text-sm text-white outline-none"
                                  autoFocus
                                />
                              </td>
                              <td className="py-2 text-gray-500">-</td>
                              <td className="py-2">
                                <select
                                  value={editingTypeFields.designStage}
                                  onChange={(e) =>
                                    setEditingTypeFields((f) => ({
                                      ...f,
                                      designStage: e.target.value,
                                    }))
                                  }
                                  className="rounded border border-gray-600 bg-[#2a2a2a] px-2 py-1 text-sm text-white outline-none"
                                >
                                  {STAGES.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2">
                                <select
                                  value={editingTypeFields.garmentPart ?? ""}
                                  onChange={(e) =>
                                    setEditingTypeFields((f) => ({
                                      ...f,
                                      garmentPart: e.target.value || null,
                                    }))
                                  }
                                  className="rounded border border-gray-600 bg-[#2a2a2a] px-2 py-1 text-sm text-white outline-none"
                                >
                                  <option value="">Unset</option>
                                  {GARMENT_PARTS.map((gp) => (
                                    <option key={gp} value={gp}>
                                      {gp}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2">
                                <button
                                  onClick={() =>
                                    setEditingTypeFields((f) => ({
                                      ...f,
                                      isAnchor: !f.isAnchor,
                                    }))
                                  }
                                  className={`h-5 w-5 rounded border ${
                                    editingTypeFields.isAnchor
                                      ? "border-green-500 bg-green-900/50"
                                      : "border-gray-600 bg-[#2a2a2a]"
                                  }`}
                                >
                                  {editingTypeFields.isAnchor && (
                                    <span className="text-xs text-green-400">
                                      Y
                                    </span>
                                  )}
                                </button>
                              </td>
                              <td className="py-2 text-right text-gray-400">
                                {t.componentCount}
                              </td>
                              <td className="py-2 text-right">
                                <button
                                  onClick={handleUpdateType}
                                  disabled={savingType}
                                  className="mr-2 text-xs text-green-400 hover:text-green-300 disabled:opacity-50"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingTypeId(null)}
                                  className="text-xs text-gray-400 hover:text-gray-300"
                                >
                                  Cancel
                                </button>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr
                            key={t.id}
                            className="group border-b border-gray-800 hover:bg-[#252525] transition-colors"
                          >
                            <td className="py-2 text-white">{t.name}</td>
                            <td className="py-2 text-gray-500">{t.slug}</td>
                            <td className="py-2">
                              <span
                                className={`inline-block rounded-full px-2 py-0.5 text-xs ${stageBadgeColors[t.designStage]}`}
                              >
                                {t.designStage}
                              </span>
                            </td>
                            <td className="py-2">
                              {t.garmentPart ? (
                                <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${garmentPartBadgeColors[t.garmentPart]}`}>
                                  {t.garmentPart}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-600">—</span>
                              )}
                            </td>
                            <td className="py-2">
                              {t.isAnchor && (
                                <span className="text-xs text-green-400">
                                  Yes
                                </span>
                              )}
                            </td>
                            <td className="py-2 text-right text-gray-400">
                              {t.componentCount}
                            </td>
                            <td className="py-2 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                  onClick={() => startEditType(t)}
                                  className="text-xs text-gray-400 hover:text-white"
                                >
                                  Edit
                                </button>
                                {isConfirmingDelete ? (
                                  <>
                                    <button
                                      onClick={() => handleDeleteType(t.id)}
                                      className="text-xs text-red-400 hover:text-red-300"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="text-xs text-gray-400 hover:text-gray-300"
                                    >
                                      No
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() =>
                                      t.componentCount === 0
                                        ? setConfirmDeleteId(t.id)
                                        : undefined
                                    }
                                    disabled={t.componentCount > 0}
                                    className="text-xs text-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:text-gray-600"
                                    title={
                                      t.componentCount > 0
                                        ? `${t.componentCount} component${t.componentCount > 1 ? "s" : ""} linked`
                                        : "Delete type"
                                    }
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="mb-3 text-sm text-gray-600">
                    No component types in this category.
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setNewTypeForm(cat.id, { name: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateType(cat.id);
                    }}
                    placeholder="New type name"
                    className="rounded border border-gray-700 bg-[#2a2a2a] px-2 py-1 text-sm text-white placeholder-gray-500 outline-none focus:border-gray-500"
                  />
                  <select
                    value={form.designStage}
                    onChange={(e) =>
                      setNewTypeForm(cat.id, { designStage: e.target.value })
                    }
                    className="rounded border border-gray-700 bg-[#2a2a2a] px-2 py-1 text-sm text-white outline-none"
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-gray-400">
                    <input
                      type="checkbox"
                      checked={form.isAnchor}
                      onChange={(e) =>
                        setNewTypeForm(cat.id, {
                          isAnchor: e.target.checked,
                        })
                      }
                      className="accent-green-500"
                    />
                    Anchor
                  </label>
                  <select
                    value={form.garmentPart ?? ""}
                    onChange={(e) =>
                      setNewTypeForm(cat.id, {
                        garmentPart: e.target.value || null,
                      })
                    }
                    className="rounded border border-gray-700 bg-[#2a2a2a] px-2 py-1 text-sm text-white outline-none"
                  >
                    <option value="">Part...</option>
                    {GARMENT_PARTS.map((gp) => (
                      <option key={gp} value={gp}>
                        {gp}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleCreateType(cat.id)}
                    disabled={savingType || !form.name.trim()}
                    className="rounded bg-white px-3 py-1 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            );
          })}

          {categories.length === 0 && (
            <p className="text-sm text-gray-500">
              Create a category above first, then add component types.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
