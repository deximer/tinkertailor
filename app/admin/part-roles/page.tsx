"use client";

import { useEffect, useState, useCallback } from "react";

type PartRole = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
};

export default function PartRolesPage() {
  const [roles, setRoles] = useState<PartRole[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [newSortOrder, setNewSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingFields, setEditingFields] = useState({ name: "", sortOrder: 0 });

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/part-roles");
      if (res.ok) {
        setRoles(await res.json());
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
      const res = await fetch("/api/admin/part-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), sortOrder: newSortOrder }),
      });
      if (res.ok) {
        setNewName("");
        setNewSortOrder(0);
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to create part role");
      }
    } catch {
      setErrorMsg("Failed to create part role");
    }
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!editingId || !editingFields.name.trim()) return;
    setSaving(true);
    clearError();
    try {
      const res = await fetch("/api/admin/part-roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          name: editingFields.name.trim(),
          sortOrder: editingFields.sortOrder,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to update part role");
      }
    } catch {
      setErrorMsg("Failed to update part role");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    clearError();
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/admin/part-roles?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to delete part role");
      }
    } catch {
      setErrorMsg("Failed to delete part role");
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
        <h1 className="mb-8 text-xl font-bold tracking-tight">Part Roles</h1>

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
          {roles.length > 0 ? (
            <table className="mb-4 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Slug</th>
                  <th className="pb-2">Sort Order</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => {
                  const isEditing = editingId === r.id;
                  const isConfirming = confirmDeleteId === r.id;

                  if (isEditing) {
                    return (
                      <tr key={r.id} className="border-b border-gray-800">
                        <td className="py-2">
                          <input
                            type="text"
                            value={editingFields.name}
                            onChange={(e) =>
                              setEditingFields((f) => ({
                                ...f,
                                name: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleUpdate();
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="w-full rounded border border-gray-600 bg-[#2a2a2a] px-2 py-1 text-sm text-white outline-none"
                            autoFocus
                          />
                        </td>
                        <td className="py-2 text-gray-500">-</td>
                        <td className="py-2">
                          <input
                            type="number"
                            value={editingFields.sortOrder}
                            onChange={(e) =>
                              setEditingFields((f) => ({
                                ...f,
                                sortOrder: parseInt(e.target.value) || 0,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleUpdate();
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="w-20 rounded border border-gray-600 bg-[#2a2a2a] px-2 py-1 text-sm text-white outline-none"
                          />
                        </td>
                        <td className="py-2 text-right">
                          <button
                            onClick={handleUpdate}
                            disabled={saving}
                            className="mr-2 text-xs text-green-400 hover:text-green-300 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
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
                      key={r.id}
                      className="group border-b border-gray-800 hover:bg-[#252525] transition-colors"
                    >
                      <td className="py-2 text-white">{r.name}</td>
                      <td className="py-2 text-gray-500">{r.slug}</td>
                      <td className="py-2 text-gray-400">{r.sortOrder}</td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => {
                              setEditingId(r.id);
                              setEditingFields({
                                name: r.name,
                                sortOrder: r.sortOrder,
                              });
                            }}
                            className="text-xs text-gray-400 hover:text-white"
                          >
                            Edit
                          </button>
                          {isConfirming ? (
                            <>
                              <button
                                onClick={() => handleDelete(r.id)}
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
                              onClick={() => setConfirmDeleteId(r.id)}
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
            <p className="mb-4 text-sm text-gray-600">No part roles yet.</p>
          )}

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              placeholder="New part role name"
              className="rounded border border-gray-700 bg-[#2a2a2a] px-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-gray-500"
            />
            <input
              type="number"
              value={newSortOrder}
              onChange={(e) => setNewSortOrder(parseInt(e.target.value) || 0)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              placeholder="Order"
              className="w-20 rounded border border-gray-700 bg-[#2a2a2a] px-2 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-gray-500"
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
