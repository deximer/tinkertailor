"use client";

import { useEffect, useState, useCallback } from "react";

type GarmentPart = {
  id: string;
  name: string;
  slug: string;
  partRoleId: string;
  partRoleName: string;
  partRoleSlug: string;
  isAnchor: boolean;
};

type ComponentType = {
  id: string;
  name: string;
  slug: string;
  garmentPartId: string | null;
  garmentPartName: string | null;
  garmentPartSlug: string | null;
  componentCount: number;
};

type ComponentTypeFromApi = Omit<ComponentType, "componentCount">;

type ComponentRow = {
  componentTypeId: string;
};

export default function ComponentTypesPage() {
  const [garmentParts, setGarmentParts] = useState<GarmentPart[]>([]);
  const [componentTypes, setComponentTypes] = useState<ComponentType[]>([]);
  const [loading, setLoading] = useState(true);

  const [newTypeForms, setNewTypeForms] = useState<
    Record<string, { name: string }>
  >({});
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeFields, setEditingTypeFields] = useState<{
    name: string;
    garmentPartId: string;
  }>({ name: "", garmentPartId: "" });
  const [savingType, setSavingType] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [partsRes, typeRes, compRes] = await Promise.all([
        fetch("/api/admin/garment-parts"),
        fetch("/api/admin/component-types"),
        fetch("/api/components"),
      ]);

      if (partsRes.ok && typeRes.ok && compRes.ok) {
        const parts: GarmentPart[] = await partsRes.json();
        const types: ComponentTypeFromApi[] = await typeRes.json();
        const comps: ComponentRow[] = await compRes.json();

        const countMap = new Map<string, number>();
        for (const c of comps) {
          countMap.set(c.componentTypeId, (countMap.get(c.componentTypeId) ?? 0) + 1);
        }

        setGarmentParts(parts);
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

  const getNewTypeForm = (garmentPartId: string) =>
    newTypeForms[garmentPartId] ?? { name: "" };

  const setNewTypeForm = (
    garmentPartId: string,
    patch: Partial<{ name: string }>,
  ) => {
    setNewTypeForms((prev) => ({
      ...prev,
      [garmentPartId]: { ...getNewTypeForm(garmentPartId), ...patch },
    }));
  };

  const handleCreateType = async (garmentPartId: string) => {
    const form = newTypeForms[garmentPartId];
    if (!form?.name.trim()) return;
    setSavingType(true);
    clearError();
    try {
      const res = await fetch("/api/admin/component-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          garmentPartId,
        }),
      });
      if (res.ok) {
        setNewTypeForms((prev) => {
          const next = { ...prev };
          delete next[garmentPartId];
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
          garmentPartId: editingTypeFields.garmentPartId,
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
      garmentPartId: t.garmentPartId ?? "",
    });
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

  // Group by garment part; also collect unassigned types
  const unassigned = componentTypes.filter((t) => !t.garmentPartId);

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="mb-8 text-xl font-bold tracking-tight">
          Component Types
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

        <section>
          {garmentParts.map((gp) => {
            const types = componentTypes.filter(
              (t) => t.garmentPartId === gp.id,
            );
            const form = getNewTypeForm(gp.id);

            return (
              <div key={gp.id} className="mb-8">
                <h3 className="mb-3 text-sm font-semibold text-gray-300">
                  {gp.name}
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    {gp.partRoleName}
                    {gp.isAnchor && " · anchor"}
                  </span>
                </h3>

                {types.length > 0 ? (
                  <table className="mb-3 w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wider text-gray-500">
                        <th className="pb-2">Name</th>
                        <th className="pb-2">Slug</th>
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
                            <tr
                              key={t.id}
                              className="border-b border-gray-800"
                            >
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
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleUpdateType();
                                    if (e.key === "Escape")
                                      setEditingTypeId(null);
                                  }}
                                  className="w-full rounded border border-gray-600 bg-[#2a2a2a] px-2 py-1 text-sm text-white outline-none"
                                  autoFocus
                                />
                              </td>
                              <td className="py-2 text-gray-500">-</td>
                              <td className="py-2 text-right text-gray-400">
                                {t.componentCount}
                              </td>
                              <td className="py-2 text-right">
                                <select
                                  value={editingTypeFields.garmentPartId}
                                  onChange={(e) =>
                                    setEditingTypeFields((f) => ({
                                      ...f,
                                      garmentPartId: e.target.value,
                                    }))
                                  }
                                  className="mr-2 rounded border border-gray-600 bg-[#2a2a2a] px-2 py-1 text-xs text-white outline-none"
                                >
                                  {garmentParts.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
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
                    No component types for this garment part.
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setNewTypeForm(gp.id, { name: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateType(gp.id);
                    }}
                    placeholder="New type name"
                    className="rounded border border-gray-700 bg-[#2a2a2a] px-2 py-1 text-sm text-white placeholder-gray-500 outline-none focus:border-gray-500"
                  />
                  <button
                    onClick={() => handleCreateType(gp.id)}
                    disabled={savingType || !form.name.trim()}
                    className="rounded bg-white px-3 py-1 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            );
          })}

          {unassigned.length > 0 && (
            <div className="mb-8">
              <h3 className="mb-3 text-sm font-semibold text-yellow-400">
                Unassigned
              </h3>
              <table className="mb-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wider text-gray-500">
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Slug</th>
                    <th className="pb-2 text-right">Components</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {unassigned.map((t) => {
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
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleUpdateType();
                                if (e.key === "Escape") setEditingTypeId(null);
                              }}
                              className="w-full rounded border border-gray-600 bg-[#2a2a2a] px-2 py-1 text-sm text-white outline-none"
                              autoFocus
                            />
                          </td>
                          <td className="py-2 text-gray-500">-</td>
                          <td className="py-2 text-right text-gray-400">
                            {t.componentCount}
                          </td>
                          <td className="py-2 text-right">
                            <select
                              value={editingTypeFields.garmentPartId}
                              onChange={(e) =>
                                setEditingTypeFields((f) => ({
                                  ...f,
                                  garmentPartId: e.target.value,
                                }))
                              }
                              className="mr-2 rounded border border-gray-600 bg-[#2a2a2a] px-2 py-1 text-xs text-white outline-none"
                            >
                              <option value="">Select part...</option>
                              {garmentParts.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
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
            </div>
          )}

          {garmentParts.length === 0 && (
            <p className="text-sm text-gray-500">
              Create garment parts first, then add component types.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
