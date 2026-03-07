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

// --------------- TagValueRow ---------------

interface TagValueRowProps {
  val: TagValue;
  isEditing: boolean;
  isConfirmingDelete: boolean;
  editingFields: { label: string; displayOrder: number };
  savingValue: boolean;
  onStartEdit: (val: TagValue) => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onSetEditingFields: React.Dispatch<
    React.SetStateAction<{ label: string; displayOrder: number }>
  >;
  onMove: (val: TagValue, delta: number) => void;
  onDelete: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
}

function TagValueRow({
  val,
  isEditing,
  isConfirmingDelete,
  editingFields,
  savingValue,
  onStartEdit,
  onCancelEdit,
  onSave,
  onSetEditingFields,
  onMove,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
}: TagValueRowProps) {
  if (isEditing) {
    return (
      <tr className="border-b border-gray-800">
        <td className="py-2">
          <input
            type="text"
            value={editingFields.label}
            onChange={(e) =>
              onSetEditingFields((f) => ({
                ...f,
                label: e.target.value,
              }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave();
              if (e.key === "Escape") onCancelEdit();
            }}
            className="w-full rounded border border-gray-600 bg-[#2a2a2a] px-2 py-1 text-sm text-white outline-none"
            autoFocus
          />
        </td>
        <td className="py-2 text-gray-500">-</td>
        <td className="py-2">
          <input
            type="number"
            value={editingFields.displayOrder}
            onChange={(e) =>
              onSetEditingFields((f) => ({
                ...f,
                displayOrder: parseInt(e.target.value, 10) || 0,
              }))
            }
            className="w-16 rounded border border-gray-600 bg-[#2a2a2a] px-2 py-1 text-sm text-white outline-none"
          />
        </td>
        <td className="py-2 text-right">
          <button
            onClick={onSave}
            disabled={savingValue}
            className="mr-2 text-xs text-green-400 hover:text-green-300 disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={onCancelEdit}
            className="text-xs text-gray-400 hover:text-gray-300"
          >
            Cancel
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="group/val border-b border-gray-800">
      <td className="py-2 text-white">{val.label}</td>
      <td className="py-2 text-gray-500">{val.slug}</td>
      <td className="py-2 text-gray-400">{val.displayOrder}</td>
      <td className="py-2 text-right">
        <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover/val:opacity-100">
          <button
            onClick={() => onMove(val, -1)}
            className="px-1 text-xs text-gray-400 hover:text-white"
            title="Move up"
          >
            &uarr;
          </button>
          <button
            onClick={() => onMove(val, 1)}
            className="px-1 text-xs text-gray-400 hover:text-white"
            title="Move down"
          >
            &darr;
          </button>
          <button
            onClick={() => onStartEdit(val)}
            className="text-xs text-gray-400 hover:text-white"
          >
            Edit
          </button>
          {isConfirmingDelete ? (
            <>
              <button
                onClick={() => onDelete(val.id)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Confirm
              </button>
              <button
                onClick={onCancelDelete}
                className="text-xs text-gray-400 hover:text-gray-300"
              >
                No
              </button>
            </>
          ) : (
            <button
              onClick={() => onConfirmDelete(val.id)}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Delete
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// --------------- TagValueTable ---------------

interface TagValueTableProps {
  dimensionId: string;
  values: TagValue[];
  editingValueId: string | null;
  editingValueFields: { label: string; displayOrder: number };
  savingValue: boolean;
  confirmDeleteId: string | null;
  newValueForm: { label: string; displayOrder: number };
  onStartEditValue: (val: TagValue) => void;
  onCancelEditValue: () => void;
  onSaveValue: () => void;
  onSetEditingValueFields: React.Dispatch<
    React.SetStateAction<{ label: string; displayOrder: number }>
  >;
  onMoveValue: (val: TagValue, delta: number) => void;
  onDeleteValue: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  onCreateValue: (dimensionId: string) => void;
  onSetNewValueForm: (
    dimId: string,
    patch: Partial<{ label: string; displayOrder: number }>,
  ) => void;
}

function TagValueTable({
  dimensionId,
  values,
  editingValueId,
  editingValueFields,
  savingValue,
  confirmDeleteId,
  newValueForm,
  onStartEditValue,
  onCancelEditValue,
  onSaveValue,
  onSetEditingValueFields,
  onMoveValue,
  onDeleteValue,
  onConfirmDelete,
  onCancelDelete,
  onCreateValue,
  onSetNewValueForm,
}: TagValueTableProps) {
  return (
    <div className="border-t border-gray-700 px-4 py-3">
      {values.length > 0 ? (
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
            {values.map((val) => (
              <TagValueRow
                key={val.id}
                val={val}
                isEditing={editingValueId === val.id}
                isConfirmingDelete={confirmDeleteId === val.id}
                editingFields={editingValueFields}
                savingValue={savingValue}
                onStartEdit={onStartEditValue}
                onCancelEdit={onCancelEditValue}
                onSave={onSaveValue}
                onSetEditingFields={onSetEditingValueFields}
                onMove={onMoveValue}
                onDelete={onDeleteValue}
                onConfirmDelete={onConfirmDelete}
                onCancelDelete={onCancelDelete}
              />
            ))}
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
          value={newValueForm.label}
          onChange={(e) =>
            onSetNewValueForm(dimensionId, { label: e.target.value })
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") onCreateValue(dimensionId);
          }}
          placeholder="New value label"
          className="rounded border border-gray-700 bg-[#2a2a2a] px-2 py-1 text-sm text-white placeholder-gray-500 outline-none focus:border-gray-500"
        />
        <input
          type="number"
          value={newValueForm.displayOrder}
          onChange={(e) =>
            onSetNewValueForm(dimensionId, {
              displayOrder: parseInt(e.target.value, 10) || 0,
            })
          }
          className="w-16 rounded border border-gray-700 bg-[#2a2a2a] px-2 py-1 text-sm text-white outline-none"
          title="Display order"
        />
        <button
          onClick={() => onCreateValue(dimensionId)}
          disabled={savingValue || !newValueForm.label.trim()}
          className="rounded bg-white px-3 py-1 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// --------------- DimensionRow ---------------

interface DimensionRowProps {
  dim: TagDimension;
  isExpanded: boolean;
  isEditing: boolean;
  isConfirmingDelete: boolean;
  valCount: number;
  editingDimFields: {
    name: string;
    selectionType: "single" | "multi";
    displayOrder: number;
  };
  savingDim: boolean;
  onToggle: (dimId: string) => void;
  onStartEdit: (dim: TagDimension) => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onSetEditingFields: React.Dispatch<
    React.SetStateAction<{
      name: string;
      selectionType: "single" | "multi";
      displayOrder: number;
    }>
  >;
  onMove: (dim: TagDimension, delta: number) => void;
  onDelete: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  children?: React.ReactNode;
}

function DimensionRow({
  dim,
  isExpanded,
  isEditing,
  isConfirmingDelete,
  valCount,
  editingDimFields,
  savingDim,
  onToggle,
  onStartEdit,
  onCancelEdit,
  onSave,
  onSetEditingFields,
  onMove,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  children,
}: DimensionRowProps) {
  return (
    <div className="mb-4 rounded-lg border border-gray-700 bg-[#222]">
      {/* Dimension header */}
      {isEditing ? (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <input
            type="text"
            value={editingDimFields.name}
            onChange={(e) =>
              onSetEditingFields((f) => ({
                ...f,
                name: e.target.value,
              }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave();
              if (e.key === "Escape") onCancelEdit();
            }}
            className="rounded border border-gray-600 bg-[#2a2a2a] px-2 py-1 text-sm text-white outline-none"
            autoFocus
          />
          <select
            value={editingDimFields.selectionType}
            onChange={(e) =>
              onSetEditingFields((f) => ({
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
              onSetEditingFields((f) => ({
                ...f,
                displayOrder: parseInt(e.target.value, 10) || 0,
              }))
            }
            className="w-16 rounded border border-gray-600 bg-[#2a2a2a] px-2 py-1 text-sm text-white outline-none"
            title="Display order"
          />
          <button
            onClick={onSave}
            disabled={savingDim}
            className="text-xs text-green-400 hover:text-green-300 disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={onCancelEdit}
            className="text-xs text-gray-400 hover:text-gray-300"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="group flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => onToggle(dim.id)}
            className="text-xs text-gray-500 hover:text-white"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? "\u25BC" : "\u25B6"}
          </button>
          <button
            onClick={() => onToggle(dim.id)}
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
              onClick={() => onMove(dim, -1)}
              className="px-1 text-xs text-gray-400 hover:text-white"
              title="Move up"
            >
              &uarr;
            </button>
            <button
              onClick={() => onMove(dim, 1)}
              className="px-1 text-xs text-gray-400 hover:text-white"
              title="Move down"
            >
              &darr;
            </button>
            <button
              onClick={() => onStartEdit(dim)}
              className="text-xs text-gray-400 hover:text-white"
            >
              Edit
            </button>
            {isConfirmingDelete ? (
              <>
                <button
                  onClick={() => onDelete(dim.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Confirm
                </button>
                <button
                  onClick={onCancelDelete}
                  className="text-xs text-gray-400 hover:text-gray-300"
                >
                  No
                </button>
              </>
            ) : (
              <button
                onClick={() =>
                  valCount === 0 ? onConfirmDelete(dim.id) : undefined
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
      {isExpanded && children}
    </div>
  );
}

// --------------- CreateDimensionForm ---------------

interface CreateDimensionFormProps {
  name: string;
  selectionType: "single" | "multi";
  displayOrder: number;
  saving: boolean;
  onChangeName: (name: string) => void;
  onChangeSelectionType: (type: "single" | "multi") => void;
  onChangeDisplayOrder: (order: number) => void;
  onCreate: () => void;
}

function CreateDimensionForm({
  name,
  selectionType,
  displayOrder,
  saving,
  onChangeName,
  onChangeSelectionType,
  onChangeDisplayOrder,
  onCreate,
}: CreateDimensionFormProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => onChangeName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCreate();
        }}
        placeholder="New dimension name"
        className="rounded border border-gray-700 bg-[#2a2a2a] px-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-gray-500"
      />
      <select
        value={selectionType}
        onChange={(e) =>
          onChangeSelectionType(e.target.value as "single" | "multi")
        }
        className="rounded border border-gray-700 bg-[#2a2a2a] px-2 py-1.5 text-sm text-white outline-none"
      >
        <option value="single">single</option>
        <option value="multi">multi</option>
      </select>
      <input
        type="number"
        value={displayOrder}
        onChange={(e) =>
          onChangeDisplayOrder(parseInt(e.target.value, 10) || 0)
        }
        className="w-16 rounded border border-gray-700 bg-[#2a2a2a] px-2 py-1.5 text-sm text-white outline-none"
        title="Display order"
      />
      <button
        onClick={onCreate}
        disabled={saving || !name.trim()}
        className="rounded bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50"
      >
        Add Dimension
      </button>
    </div>
  );
}

// --------------- Helper: CRUD functions ---------------

function makeDimensionHandlers(
  fetchData: () => Promise<void>,
  clearError: () => void,
  setErrorMsg: (msg: string) => void,
  setSavingDim: (saving: boolean) => void,
  editingDimId: string | null,
  editingDimFields: {
    name: string;
    selectionType: "single" | "multi";
    displayOrder: number;
  },
  setEditingDimId: (id: string | null) => void,
  setEditingDimFields: (fields: {
    name: string;
    selectionType: "single" | "multi";
    displayOrder: number;
  }) => void,
  setConfirmDeleteId: (id: string | null) => void,
) {
  const startEdit = (dim: TagDimension) => {
    setEditingDimId(dim.id);
    setEditingDimFields({
      name: dim.name,
      selectionType: dim.selectionType,
      displayOrder: dim.displayOrder,
    });
  };

  const handleUpdate = async () => {
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

  const handleDelete = async (id: string) => {
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

  const handleMove = async (dim: TagDimension, delta: number) => {
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

  return { startEdit, handleUpdate, handleDelete, handleMove };
}

function makeValueHandlers(
  fetchData: () => Promise<void>,
  clearError: () => void,
  setErrorMsg: (msg: string) => void,
  setSavingValue: (saving: boolean) => void,
  newValueForms: Record<string, { label: string; displayOrder: number }>,
  setNewValueForms: React.Dispatch<
    React.SetStateAction<
      Record<string, { label: string; displayOrder: number }>
    >
  >,
  editingValueId: string | null,
  editingValueFields: { label: string; displayOrder: number },
  setEditingValueId: (id: string | null) => void,
  setEditingValueFields: (fields: {
    label: string;
    displayOrder: number;
  }) => void,
  setConfirmDeleteId: (id: string | null) => void,
) {
  const getNewForm = (dimId: string) =>
    newValueForms[dimId] ?? { label: "", displayOrder: 0 };

  const setNewForm = (
    dimId: string,
    patch: Partial<{ label: string; displayOrder: number }>,
  ) => {
    setNewValueForms((prev) => ({
      ...prev,
      [dimId]: { ...getNewForm(dimId), ...patch },
    }));
  };

  const handleCreate = async (dimensionId: string) => {
    const form = getNewForm(dimensionId);
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

  const startEdit = (val: TagValue) => {
    setEditingValueId(val.id);
    setEditingValueFields({
      label: val.label,
      displayOrder: val.displayOrder,
    });
  };

  const handleUpdate = async () => {
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

  const handleDelete = async (id: string) => {
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

  const handleMove = async (val: TagValue, delta: number) => {
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

  return { getNewForm, setNewForm, startEdit, handleCreate, handleUpdate, handleDelete, handleMove };
}

// --------------- Main Page ---------------

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

  // Dimension CRUD
  const dimHandlers = makeDimensionHandlers(
    fetchData, clearError, setErrorMsg, setSavingDim,
    editingDimId, editingDimFields, setEditingDimId, setEditingDimFields,
    setConfirmDeleteId,
  );

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

  // Value CRUD
  const valHandlers = makeValueHandlers(
    fetchData, clearError, setErrorMsg, setSavingValue,
    newValueForms, setNewValueForms,
    editingValueId, editingValueFields, setEditingValueId, setEditingValueFields,
    setConfirmDeleteId,
  );

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
            const vals = valuesForDimension(dim.id);
            const valCount = valueCountForDimension(dim.id);

            return (
              <DimensionRow
                key={dim.id}
                dim={dim}
                isExpanded={isExpanded}
                isEditing={editingDimId === dim.id}
                isConfirmingDelete={confirmDeleteId === dim.id}
                valCount={valCount}
                editingDimFields={editingDimFields}
                savingDim={savingDim}
                onToggle={toggleDimension}
                onStartEdit={dimHandlers.startEdit}
                onCancelEdit={() => setEditingDimId(null)}
                onSave={dimHandlers.handleUpdate}
                onSetEditingFields={setEditingDimFields}
                onMove={dimHandlers.handleMove}
                onDelete={dimHandlers.handleDelete}
                onConfirmDelete={(id) => setConfirmDeleteId(id)}
                onCancelDelete={() => setConfirmDeleteId(null)}
              >
                <TagValueTable
                  dimensionId={dim.id}
                  values={vals}
                  editingValueId={editingValueId}
                  editingValueFields={editingValueFields}
                  savingValue={savingValue}
                  confirmDeleteId={confirmDeleteId}
                  newValueForm={valHandlers.getNewForm(dim.id)}
                  onStartEditValue={valHandlers.startEdit}
                  onCancelEditValue={() => setEditingValueId(null)}
                  onSaveValue={valHandlers.handleUpdate}
                  onSetEditingValueFields={setEditingValueFields}
                  onMoveValue={valHandlers.handleMove}
                  onDeleteValue={valHandlers.handleDelete}
                  onConfirmDelete={(id) => setConfirmDeleteId(id)}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                  onCreateValue={valHandlers.handleCreate}
                  onSetNewValueForm={valHandlers.setNewForm}
                />
              </DimensionRow>
            );
          })}

          {dimensions.length === 0 && (
            <p className="mb-4 text-sm text-gray-500">
              No tag dimensions yet. Create one below.
            </p>
          )}

          <CreateDimensionForm
            name={newDimName}
            selectionType={newDimSelectionType}
            displayOrder={newDimDisplayOrder}
            saving={savingDim}
            onChangeName={setNewDimName}
            onChangeSelectionType={setNewDimSelectionType}
            onChangeDisplayOrder={setNewDimDisplayOrder}
            onCreate={handleCreateDimension}
          />
        </section>
      </div>
    </div>
  );
}
