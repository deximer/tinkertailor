"use client";

import { useEffect, useState, useCallback } from "react";

type TagDimension = {
  id: string;
  name: string;
  slug: string;
  selectionType: "single" | "multi";
  displayOrder: number;
};

type TagValue = {
  id: string;
  dimensionId: string;
  label: string;
  slug: string;
  displayOrder: number;
};

const selectionBadgeColors: Record<string, string> = {
  single: "bg-blue-900/50 text-blue-300",
  multi: "bg-purple-900/50 text-purple-300",
};

export default function TagsPage() {
  const [dimensions, setDimensions] = useState<TagDimension[]>([]);
  const [values, setValues] = useState<TagValue[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedDimensions, setExpandedDimensions] = useState<
    Record<string, boolean>
  >({});

  // Dimension create state
  const [newDimName, setNewDimName] = useState("");
  const [newDimSelectionType, setNewDimSelectionType] = useState<
    "single" | "multi"
  >("single");
  const [newDimDisplayOrder, setNewDimDisplayOrder] = useState(0);
  const [savingDim, setSavingDim] = useState(false);

  // Dimension edit state
  const [editingDimId, setEditingDimId] = useState<string | null>(null);
  const [editingDimFields, setEditingDimFields] = useState<{
    name: string;
    selectionType: "single" | "multi";
    displayOrder: number;
  }>({ name: "", selectionType: "single", displayOrder: 0 });

  // Value create state per dimension
  const [newValueForms, setNewValueForms] = useState<
    Record<string, { label: string; displayOrder: number }>
  >({});
  const [savingValue, setSavingValue] = useState(false);

  // Value edit state
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [editingValueFields, setEditingValueFields] = useState<{
    label: string;
    displayOrder: number;
  }>({ label: "", displayOrder: 0 });

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dimRes, valRes] = await Promise.all([
        fetch("/api/admin/tag-dimensions"),
        fetch("/api/admin/tag-values"),
      ]);

      if (dimRes.ok && valRes.ok) {
        const dims: TagDimension[] = await dimRes.json();
        const vals: TagValue[] = await valRes.json();
        setDimensions(dims);
        setValues(vals);
      } else {
        setErrorMsg("Failed to load data");
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

  const toggleDimension = (dimId: string) => {
    setExpandedDimensions((prev) => ({
      ...prev,
      [dimId]: !prev[dimId],
    }));
  };

  const valuesForDimension = (dimId: string) =>
    values
      .filter((v) => v.dimensionId === dimId)
      .sort((a, b) => a.displayOrder - b.displayOrder);

  const valueCountForDimension = (dimId: string) =>
    values.filter((v) => v.dimensionId === dimId).length;

  // --------------- Dimension CRUD ---------------

  const handleCreateDimension = async () => {
    if (!newDimName.trim()) return;
    setSavingDim(true);
    clearError();
    try {
      const res = await fetch("/api/admin/tag-dimensions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDimName.trim(),
          selectionType: newDimSelectionType,
          displayOrder: newDimDisplayOrder,
        }),
      });
      if (res.ok) {
        setNewDimName("");
        setNewDimSelectionType("single");
        setNewDimDisplayOrder(0);
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to create dimension");
      }
    } catch {
      setErrorMsg("Failed to create dimension");
    }
    setSavingDim(false);
  };

  const startEditDimension = (dim: TagDimension) => {
    setEditingDimId(dim.id);
    setEditingDimFields({
      name: dim.name,
      selectionType: dim.selectionType,
      displayOrder: dim.displayOrder,
    });
  };

  const handleUpdateDimension = async () => {
    if (!editingDimId) return;
    setSavingDim(true);
    clearError();
    try {
      const res = await fetch("/api/admin/tag-dimensions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingDimId,
          name: editingDimFields.name.trim(),
          selectionType: editingDimFields.selectionType,
          displayOrder: editingDimFields.displayOrder,
        }),
      });
      if (res.ok) {
        setEditingDimId(null);
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to update dimension");
      }
    } catch {
      setErrorMsg("Failed to update dimension");
    }
    setSavingDim(false);
  };

  const handleDeleteDimension = async (id: string) => {
    clearError();
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/admin/tag-dimensions?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to delete dimension");
      }
    } catch {
      setErrorMsg("Failed to delete dimension");
    }
  };

  const handleMoveDimension = async (dim: TagDimension, delta: number) => {
    clearError();
    try {
      const res = await fetch("/api/admin/tag-dimensions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: dim.id,
          displayOrder: dim.displayOrder + delta,
        }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to reorder dimension");
      }
    } catch {
      setErrorMsg("Failed to reorder dimension");
    }
  };

  // --------------- Value CRUD ---------------

  const getNewValueForm = (dimId: string) =>
    newValueForms[dimId] ?? { label: "", displayOrder: 0 };

  const setNewValueForm = (
    dimId: string,
    patch: Partial<{ label: string; displayOrder: number }>,
  ) => {
    setNewValueForms((prev) => ({
      ...prev,
      [dimId]: { ...getNewValueForm(dimId), ...patch },
    }));
  };

  const handleCreateValue = async (dimensionId: string) => {
    const form = getNewValueForm(dimensionId);
    if (!form.label.trim()) return;
    setSavingValue(true);
    clearError();
    try {
      const res = await fetch("/api/admin/tag-values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dimensionId,
          label: form.label.trim(),
          displayOrder: form.displayOrder,
        }),
      });
      if (res.ok) {
        setNewValueForms((prev) => {
          const next = { ...prev };
          delete next[dimensionId];
          return next;
        });
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to create tag value");
      }
    } catch {
      setErrorMsg("Failed to create tag value");
    }
    setSavingValue(false);
  };

  const startEditValue = (val: TagValue) => {
    setEditingValueId(val.id);
    setEditingValueFields({
      label: val.label,
      displayOrder: val.displayOrder,
    });
  };

  const handleUpdateValue = async () => {
    if (!editingValueId) return;
    setSavingValue(true);
    clearError();
    try {
      const res = await fetch("/api/admin/tag-values", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingValueId,
          label: editingValueFields.label.trim(),
          displayOrder: editingValueFields.displayOrder,
        }),
      });
      if (res.ok) {
        setEditingValueId(null);
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to update tag value");
      }
    } catch {
      setErrorMsg("Failed to update tag value");
    }
    setSavingValue(false);
  };

  const handleDeleteValue = async (id: string) => {
    clearError();
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/admin/tag-values?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to delete tag value");
      }
    } catch {
      setErrorMsg("Failed to delete tag value");
    }
  };

  const handleMoveValue = async (val: TagValue, delta: number) => {
    clearError();
    try {
      const res = await fetch("/api/admin/tag-values", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: val.id,
          displayOrder: val.displayOrder + delta,
        }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to reorder tag value");
      }
    } catch {
      setErrorMsg("Failed to reorder tag value");
    }
  };

  // --------------- Render ---------------

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
          Tag Dimensions &amp; Values
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

        {/* Dimensions */}
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-400">
            Dimensions
          </h2>

          {dimensions.map((dim) => {
            const isExpanded = expandedDimensions[dim.id] ?? false;
            const isEditing = editingDimId === dim.id;
            const vals = valuesForDimension(dim.id);
            const valCount = valueCountForDimension(dim.id);
            const isConfirmingDelete = confirmDeleteId === dim.id;

            return (
              <div
                key={dim.id}
                className="mb-4 rounded-lg border border-gray-700 bg-[#222]"
              >
                {/* Dimension header */}
                {isEditing ? (
                  <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                    <input
                      type="text"
                      value={editingDimFields.name}
                      onChange={(e) =>
                        setEditingDimFields((f) => ({
                          ...f,
                          name: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleUpdateDimension();
                        if (e.key === "Escape") setEditingDimId(null);
                      }}
                      className="rounded border border-gray-600 bg-[#2a2a2a] px-2 py-1 text-sm text-white outline-none"
                      autoFocus
                    />
                    <select
                      value={editingDimFields.selectionType}
                      onChange={(e) =>
                        setEditingDimFields((f) => ({
                          ...f,
                          selectionType: e.target.value as "single" | "multi",
                        }))
                      }
                      className="rounded border border-gray-600 bg-[#2a2a2a] px-2 py-1 text-sm text-white outline-none"
                    >
                      <option value="single">single</option>
                      <option value="multi">multi</option>
                    </select>
                    <input
                      type="number"
                      value={editingDimFields.displayOrder}
                      onChange={(e) =>
                        setEditingDimFields((f) => ({
                          ...f,
                          displayOrder: parseInt(e.target.value, 10) || 0,
                        }))
                      }
                      className="w-16 rounded border border-gray-600 bg-[#2a2a2a] px-2 py-1 text-sm text-white outline-none"
                      title="Display order"
                    />
                    <button
                      onClick={handleUpdateDimension}
                      disabled={savingDim}
                      className="text-xs text-green-400 hover:text-green-300 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingDimId(null)}
                      className="text-xs text-gray-400 hover:text-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="group flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => toggleDimension(dim.id)}
                      className="text-xs text-gray-500 hover:text-white"
                      title={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? "\u25BC" : "\u25B6"}
                    </button>
                    <button
                      onClick={() => toggleDimension(dim.id)}
                      className="text-sm font-semibold text-white hover:text-gray-300"
                    >
                      {dim.name}
                    </button>
                    <span className="text-xs text-gray-500">{dim.slug}</span>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${selectionBadgeColors[dim.selectionType]}`}
                    >
                      {dim.selectionType}
                    </span>
                    <span className="text-xs text-gray-500">
                      order: {dim.displayOrder}
                    </span>
                    <span className="text-xs text-gray-600">
                      {valCount} value{valCount !== 1 ? "s" : ""}
                    </span>

                    <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => handleMoveDimension(dim, -1)}
                        className="px-1 text-xs text-gray-400 hover:text-white"
                        title="Move up"
                      >
                        &uarr;
                      </button>
                      <button
                        onClick={() => handleMoveDimension(dim, 1)}
                        className="px-1 text-xs text-gray-400 hover:text-white"
                        title="Move down"
                      >
                        &darr;
                      </button>
                      <button
                        onClick={() => startEditDimension(dim)}
                        className="text-xs text-gray-400 hover:text-white"
                      >
                        Edit
                      </button>
                      {isConfirmingDelete ? (
                        <>
                          <button
                            onClick={() => handleDeleteDimension(dim.id)}
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
                            valCount === 0
                              ? setConfirmDeleteId(dim.id)
                              : undefined
                          }
                          disabled={valCount > 0}
                          className="text-xs text-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:text-gray-600"
                          title={
                            valCount > 0
                              ? `${valCount} value${valCount > 1 ? "s" : ""} exist`
                              : "Delete dimension"
                          }
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Expanded: tag values */}
                {isExpanded && (
                  <div className="border-t border-gray-700 px-4 py-3">
                    {vals.length > 0 ? (
                      <table className="mb-3 w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wider text-gray-500">
                            <th className="pb-2">Label</th>
                            <th className="pb-2">Slug</th>
                            <th className="pb-2">Order</th>
                            <th className="pb-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {vals.map((val) => {
                            const isEditingVal = editingValueId === val.id;
                            const isConfirmingDeleteVal =
                              confirmDeleteId === val.id;

                            if (isEditingVal) {
                              return (
                                <tr
                                  key={val.id}
                                  className="border-b border-gray-800"
                                >
                                  <td className="py-2">
                                    <input
                                      type="text"
                                      value={editingValueFields.label}
                                      onChange={(e) =>
                                        setEditingValueFields((f) => ({
                                          ...f,
                                          label: e.target.value,
                                        }))
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter")
                                          handleUpdateValue();
                                        if (e.key === "Escape")
                                          setEditingValueId(null);
                                      }}
                                      className="w-full rounded border border-gray-600 bg-[#2a2a2a] px-2 py-1 text-sm text-white outline-none"
                                      autoFocus
                                    />
                                  </td>
                                  <td className="py-2 text-gray-500">-</td>
                                  <td className="py-2">
                                    <input
                                      type="number"
                                      value={editingValueFields.displayOrder}
                                      onChange={(e) =>
                                        setEditingValueFields((f) => ({
                                          ...f,
                                          displayOrder:
                                            parseInt(e.target.value, 10) || 0,
                                        }))
                                      }
                                      className="w-16 rounded border border-gray-600 bg-[#2a2a2a] px-2 py-1 text-sm text-white outline-none"
                                    />
                                  </td>
                                  <td className="py-2 text-right">
                                    <button
                                      onClick={handleUpdateValue}
                                      disabled={savingValue}
                                      className="mr-2 text-xs text-green-400 hover:text-green-300 disabled:opacity-50"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingValueId(null)}
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
                                key={val.id}
                                className="group/val border-b border-gray-800"
                              >
                                <td className="py-2 text-white">{val.label}</td>
                                <td className="py-2 text-gray-500">
                                  {val.slug}
                                </td>
                                <td className="py-2 text-gray-400">
                                  {val.displayOrder}
                                </td>
                                <td className="py-2 text-right">
                                  <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover/val:opacity-100">
                                    <button
                                      onClick={() =>
                                        handleMoveValue(val, -1)
                                      }
                                      className="px-1 text-xs text-gray-400 hover:text-white"
                                      title="Move up"
                                    >
                                      &uarr;
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleMoveValue(val, 1)
                                      }
                                      className="px-1 text-xs text-gray-400 hover:text-white"
                                      title="Move down"
                                    >
                                      &darr;
                                    </button>
                                    <button
                                      onClick={() => startEditValue(val)}
                                      className="text-xs text-gray-400 hover:text-white"
                                    >
                                      Edit
                                    </button>
                                    {isConfirmingDeleteVal ? (
                                      <>
                                        <button
                                          onClick={() =>
                                            handleDeleteValue(val.id)
                                          }
                                          className="text-xs text-red-400 hover:text-red-300"
                                        >
                                          Confirm
                                        </button>
                                        <button
                                          onClick={() =>
                                            setConfirmDeleteId(null)
                                          }
                                          className="text-xs text-gray-400 hover:text-gray-300"
                                        >
                                          No
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        onClick={() =>
                                          setConfirmDeleteId(val.id)
                                        }
                                        className="text-xs text-red-400 hover:text-red-300"
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
                        No tag values in this dimension.
                      </p>
                    )}

                    {/* Add value form */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={getNewValueForm(dim.id).label}
                        onChange={(e) =>
                          setNewValueForm(dim.id, { label: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCreateValue(dim.id);
                        }}
                        placeholder="New value label"
                        className="rounded border border-gray-700 bg-[#2a2a2a] px-2 py-1 text-sm text-white placeholder-gray-500 outline-none focus:border-gray-500"
                      />
                      <input
                        type="number"
                        value={getNewValueForm(dim.id).displayOrder}
                        onChange={(e) =>
                          setNewValueForm(dim.id, {
                            displayOrder: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="w-16 rounded border border-gray-700 bg-[#2a2a2a] px-2 py-1 text-sm text-white outline-none"
                        title="Display order"
                      />
                      <button
                        onClick={() => handleCreateValue(dim.id)}
                        disabled={
                          savingValue ||
                          !getNewValueForm(dim.id).label.trim()
                        }
                        className="rounded bg-white px-3 py-1 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {dimensions.length === 0 && (
            <p className="mb-4 text-sm text-gray-500">
              No tag dimensions yet. Create one below.
            </p>
          )}

          {/* Add dimension form */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newDimName}
              onChange={(e) => setNewDimName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateDimension();
              }}
              placeholder="New dimension name"
              className="rounded border border-gray-700 bg-[#2a2a2a] px-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-gray-500"
            />
            <select
              value={newDimSelectionType}
              onChange={(e) =>
                setNewDimSelectionType(e.target.value as "single" | "multi")
              }
              className="rounded border border-gray-700 bg-[#2a2a2a] px-2 py-1.5 text-sm text-white outline-none"
            >
              <option value="single">single</option>
              <option value="multi">multi</option>
            </select>
            <input
              type="number"
              value={newDimDisplayOrder}
              onChange={(e) =>
                setNewDimDisplayOrder(parseInt(e.target.value, 10) || 0)
              }
              className="w-16 rounded border border-gray-700 bg-[#2a2a2a] px-2 py-1.5 text-sm text-white outline-none"
              title="Display order"
            />
            <button
              onClick={handleCreateDimension}
              disabled={savingDim || !newDimName.trim()}
              className="rounded bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50"
            >
              Add Dimension
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
