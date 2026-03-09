"use client";

import { useEffect, useState, useCallback } from "react";

type PartRole = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
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

export default function GarmentPartsPage() {
  const [roles, setRoles] = useState<PartRole[]>([]);
  const [parts, setParts] = useState<GarmentPart[]>([]);
  const [loading, setLoading] = useState(true);

  const [newForms, setNewForms] = useState<
    Record<string, { name: string; isAnchor: boolean }>
  >({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingFields, setEditingFields] = useState({
    name: "",
    partRoleId: "",
    isAnchor: false,
  });
  const [saving, setSaving] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, partsRes] = await Promise.all([
        fetch("/api/admin/part-roles"),
        fetch("/api/admin/garment-parts"),
      ]);
      if (rolesRes.ok && partsRes.ok) {
        setRoles(await rolesRes.json());
        setParts(await partsRes.json());
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

  const getNewForm = (roleId: string) =>
    newForms[roleId] ?? { name: "", isAnchor: false };

  const setNewForm = (
    roleId: string,
    patch: Partial<{ name: string; isAnchor: boolean }>,
  ) => {
    setNewForms((prev) => ({
      ...prev,
      [roleId]: { ...getNewForm(roleId), ...patch },
    }));
  };

  const handleCreate = async (partRoleId: string) => {
    const form = getNewForm(partRoleId);
    if (!form.name.trim()) return;
    setSaving(true);
    clearError();
    try {
      const res = await fetch("/api/admin/garment-parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          partRoleId,
          isAnchor: form.isAnchor,
        }),
      });
      if (res.ok) {
        setNewForms((prev) => {
          const next = { ...prev };
          delete next[partRoleId];
          return next;
        });
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to create garment part");
      }
    } catch {
      setErrorMsg("Failed to create garment part");
    }
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!editingId || !editingFields.name.trim()) return;
    setSaving(true);
    clearError();
    try {
      const res = await fetch("/api/admin/garment-parts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          name: editingFields.name.trim(),
          partRoleId: editingFields.partRoleId,
          isAnchor: editingFields.isAnchor,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to update garment part");
      }
    } catch {
      setErrorMsg("Failed to update garment part");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    clearError();
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/admin/garment-parts?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to delete garment part");
      }
    } catch {
      setErrorMsg("Failed to delete garment part");
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
          Garment Parts
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

        {roles.map((role) => {
          const roleParts = parts.filter((p) => p.partRoleId === role.id);
          const form = getNewForm(role.id);

          return (
            <section key={role.id} className="mb-8">
              <h2 className="mb-3 text-sm font-semibold text-gray-300">
                {role.name}
              </h2>

              {roleParts.length > 0 ? (
                <table className="mb-3 w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wider text-gray-500">
                      <th className="pb-2">Name</th>
                      <th className="pb-2">Slug</th>
                      <th className="pb-2">Anchor</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {roleParts.map((p) => {
                      const isEditing = editingId === p.id;
                      const isConfirming = confirmDeleteId === p.id;

                      if (isEditing) {
                        return (
                          <tr
                            key={p.id}
                            className="border-b border-gray-800"
                          >
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
                              <button
                                onClick={() =>
                                  setEditingFields((f) => ({
                                    ...f,
                                    isAnchor: !f.isAnchor,
                                  }))
                                }
                                className={`h-5 w-5 rounded border ${
                                  editingFields.isAnchor
                                    ? "border-green-500 bg-green-900/50"
                                    : "border-gray-600 bg-[#2a2a2a]"
                                }`}
                              >
                                {editingFields.isAnchor && (
                                  <span className="text-xs text-green-400">
                                    Y
                                  </span>
                                )}
                              </button>
                            </td>
                            <td className="py-2 text-right">
                              <select
                                value={editingFields.partRoleId}
                                onChange={(e) =>
                                  setEditingFields((f) => ({
                                    ...f,
                                    partRoleId: e.target.value,
                                  }))
                                }
                                className="mr-2 rounded border border-gray-600 bg-[#2a2a2a] px-2 py-1 text-xs text-white outline-none"
                              >
                                {roles.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                              </select>
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
                          key={p.id}
                          className="group border-b border-gray-800 hover:bg-[#252525] transition-colors"
                        >
                          <td className="py-2 text-white">{p.name}</td>
                          <td className="py-2 text-gray-500">{p.slug}</td>
                          <td className="py-2">
                            {p.isAnchor && (
                              <span className="text-xs text-green-400">
                                Yes
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                onClick={() => {
                                  setEditingId(p.id);
                                  setEditingFields({
                                    name: p.name,
                                    partRoleId: p.partRoleId,
                                    isAnchor: p.isAnchor,
                                  });
                                }}
                                className="text-xs text-gray-400 hover:text-white"
                              >
                                Edit
                              </button>
                              {isConfirming ? (
                                <>
                                  <button
                                    onClick={() => handleDelete(p.id)}
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
                                  onClick={() => setConfirmDeleteId(p.id)}
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
                  No garment parts in this role.
                </p>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setNewForm(role.id, { name: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate(role.id);
                  }}
                  placeholder="New garment part name"
                  className="rounded border border-gray-700 bg-[#2a2a2a] px-2 py-1 text-sm text-white placeholder-gray-500 outline-none focus:border-gray-500"
                />
                <label className="flex items-center gap-1 text-xs text-gray-400">
                  <input
                    type="checkbox"
                    checked={form.isAnchor}
                    onChange={(e) =>
                      setNewForm(role.id, { isAnchor: e.target.checked })
                    }
                    className="accent-green-500"
                  />
                  Anchor
                </label>
                <button
                  onClick={() => handleCreate(role.id)}
                  disabled={saving || !form.name.trim()}
                  className="rounded bg-white px-3 py-1 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </section>
          );
        })}

        {roles.length === 0 && (
          <p className="text-sm text-gray-500">
            Create part roles first, then add garment parts.
          </p>
        )}
      </div>
    </div>
  );
}
