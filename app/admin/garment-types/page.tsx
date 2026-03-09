"use client";

import { useEffect, useState, useCallback } from "react";

type GarmentPartRef = {
  id: string;
  name: string;
  slug: string;
};

type GarmentType = {
  id: string;
  name: string;
  slug: string;
  parts: GarmentPartRef[];
};

type GarmentPart = {
  id: string;
  name: string;
  slug: string;
  partRoleId: string;
  partRoleName: string;
  partRoleSlug: string;
  isAnchor: boolean;
};

export default function GarmentTypesPage() {
  const [types, setTypes] = useState<GarmentType[]>([]);
  const [allParts, setAllParts] = useState<GarmentPart[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [typesRes, partsRes] = await Promise.all([
        fetch("/api/admin/garment-types"),
        fetch("/api/admin/garment-parts"),
      ]);
      if (typesRes.ok && partsRes.ok) {
        setTypes(await typesRes.json());
        setAllParts(await partsRes.json());
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

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    clearError();
    try {
      const res = await fetch("/api/admin/garment-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        setNewName("");
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to create garment type");
      }
    } catch {
      setErrorMsg("Failed to create garment type");
    }
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!editingId || !editingName.trim()) return;
    setSaving(true);
    clearError();
    try {
      const res = await fetch("/api/admin/garment-types", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, name: editingName.trim() }),
      });
      if (res.ok) {
        setEditingId(null);
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to update garment type");
      }
    } catch {
      setErrorMsg("Failed to update garment type");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    clearError();
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/admin/garment-types?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to delete garment type");
      }
    } catch {
      setErrorMsg("Failed to delete garment type");
    }
  };

  const handleAddPart = async (garmentTypeId: string, garmentPartId: string) => {
    clearError();
    try {
      const res = await fetch("/api/admin/garment-type-parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ garmentTypeId, garmentPartId }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to add part mapping");
      }
    } catch {
      setErrorMsg("Failed to add part mapping");
    }
  };

  const handleRemovePart = async (
    garmentTypeId: string,
    garmentPartId: string,
  ) => {
    clearError();
    try {
      const res = await fetch(
        `/api/admin/garment-type-parts?garmentTypeId=${garmentTypeId}&garmentPartId=${garmentPartId}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to remove part mapping");
      }
    } catch {
      setErrorMsg("Failed to remove part mapping");
    }
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
          Garment Types
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
          {types.map((t) => {
            const isEditing = editingId === t.id;
            const isConfirming = confirmDeleteId === t.id;
            const linkedPartIds = new Set(t.parts.map((p) => p.id));
            const unlinkedParts = allParts.filter(
              (p) => !linkedPartIds.has(p.id),
            );

            return (
              <div
                key={t.id}
                className="mb-6 rounded border border-gray-700 bg-[#222] p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdate();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="rounded border border-gray-600 bg-[#2a2a2a] px-2 py-1 text-sm text-white outline-none"
                        autoFocus
                      />
                      <button
                        onClick={handleUpdate}
                        disabled={saving}
                        className="text-xs text-green-400 hover:text-green-300 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs text-gray-400 hover:text-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-white">
                        {t.name}
                      </h3>
                      <span className="text-xs text-gray-500">{t.slug}</span>
                    </div>
                  )}

                  {!isEditing && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingId(t.id);
                          setEditingName(t.name);
                        }}
                        className="text-xs text-gray-400 hover:text-white"
                      >
                        Edit
                      </button>
                      {isConfirming ? (
                        <>
                          <button
                            onClick={() => handleDelete(t.id)}
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
                          onClick={() => setConfirmDeleteId(t.id)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Linked parts */}
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {t.parts.length > 0 ? (
                    t.parts.map((p) => (
                      <span
                        key={p.id}
                        className="group/pill flex items-center gap-1 rounded-full border border-gray-600 bg-[#2a2a2a] px-2.5 py-0.5 text-xs text-gray-300"
                      >
                        {p.name}
                        <button
                          onClick={() => handleRemovePart(t.id, p.id)}
                          className="text-red-400 opacity-0 transition-opacity group-hover/pill:opacity-100 hover:text-red-300"
                        >
                          x
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-600">
                      No parts linked
                    </span>
                  )}
                </div>

                {/* Add part dropdown */}
                {unlinkedParts.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) handleAddPart(t.id, e.target.value);
                    }}
                    className="rounded border border-gray-700 bg-[#2a2a2a] px-2 py-1 text-xs text-gray-400 outline-none"
                  >
                    <option value="">Add part...</option>
                    {unlinkedParts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.partRoleName})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              placeholder="New garment type name"
              className="rounded border border-gray-700 bg-[#2a2a2a] px-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-gray-500"
            />
            <button
              onClick={handleCreate}
              disabled={saving || !newName.trim()}
              className="rounded bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
