"use client";

import { useEffect, useState, useCallback } from "react";

interface ComponentType {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  stage: string;
  isFirstLeaf: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Component {
  id: string;
  name: string;
  code: string;
  componentTypeId: string;
  modelPath: string | null;
  createdAt: string;
}

interface Asset {
  name: string;
  size: number;
  updatedAt: string;
}

interface ImportResult {
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

interface GroupedTypes {
  category: Category;
  types: ComponentType[];
}

export default function AdminComponentsPage() {
  const [components, setComponents] = useState<Component[]>([]);
  const [componentTypes, setComponentTypes] = useState<ComponentType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  // Inline create form state per component type
  const [createForms, setCreateForms] = useState<
    Record<string, { name: string; code: string; modelPath: string }>
  >({});

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    code: string;
    modelPath: string;
  }>({ name: "", code: "", modelPath: "" });

  // CSV import
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Operation feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [compRes, typesRes, catsRes, assetsRes] = await Promise.all([
        fetch("/api/admin/components"),
        fetch("/api/component-types"),
        fetch("/api/categories"),
        fetch("/api/admin/assets"),
      ]);

      if (compRes.ok) setComponents(await compRes.json());
      if (typesRes.ok) setComponentTypes(await typesRes.json());
      if (catsRes.ok) setCategories(await catsRes.json());
      if (assetsRes.ok) setAssets(await assetsRes.json());
    } catch {
      setErrorMsg("Failed to load data");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group component types by category
  const groupedByCategory: GroupedTypes[] = categories
    .map((cat) => ({
      category: cat,
      types: componentTypes.filter((ct) => ct.categoryId === cat.id),
    }))
    .filter((g) => g.types.length > 0);

  const componentsForType = (typeId: string) =>
    components.filter((c) => c.componentTypeId === typeId);

  const getCreateForm = (typeId: string) =>
    createForms[typeId] ?? { name: "", code: "", modelPath: "" };

  const updateCreateForm = (
    typeId: string,
    field: string,
    value: string,
  ) => {
    setCreateForms((prev) => ({
      ...prev,
      [typeId]: { ...getCreateForm(typeId), [field]: value },
    }));
  };

  const handleCreate = async (typeId: string) => {
    const form = getCreateForm(typeId);
    if (!form.name || !form.code) return;

    setErrorMsg(null);
    const res = await fetch("/api/admin/components", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        code: form.code,
        componentTypeId: typeId,
        modelPath: form.modelPath || null,
      }),
    });

    if (res.ok) {
      const created = await res.json();
      setComponents((prev) => [...prev, created]);
      setCreateForms((prev) => ({
        ...prev,
        [typeId]: { name: "", code: "", modelPath: "" },
      }));
    } else {
      const data = await res.json();
      setErrorMsg(data.error ?? "Failed to create component");
    }
  };

  const startEdit = (comp: Component) => {
    setEditingId(comp.id);
    setEditForm({
      name: comp.name,
      code: comp.code,
      modelPath: comp.modelPath ?? "",
    });
    setErrorMsg(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setErrorMsg(null);
  };

  const handleUpdate = async () => {
    if (!editingId) return;

    setErrorMsg(null);
    const res = await fetch("/api/admin/components", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingId,
        name: editForm.name,
        code: editForm.code,
        modelPath: editForm.modelPath || null,
      }),
    });

    if (res.ok) {
      const updated = await res.json();
      setComponents((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      );
      setEditingId(null);
    } else {
      const data = await res.json();
      setErrorMsg(data.error ?? "Failed to update component");
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    setErrorMsg(null);
    const res = await fetch(`/api/admin/components?id=${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setComponents((prev) => prev.filter((c) => c.id !== id));
      if (editingId === id) setEditingId(null);
    } else {
      const data = await res.json();
      setErrorMsg(data.error ?? "Failed to delete component");
    }
    setDeleting(null);
  };

  const handleImport = async () => {
    if (!importFile) return;

    setImporting(true);
    setImportResult(null);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("file", importFile);

    const res = await fetch("/api/admin/components/import", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const result: ImportResult = await res.json();
      setImportResult(result);
      setImportFile(null);
      // Refresh component list to include newly imported rows
      const compRes = await fetch("/api/admin/components");
      if (compRes.ok) setComponents(await compRes.json());
    } else {
      const data = await res.json();
      setErrorMsg(data.error ?? "Import failed");
    }

    setImporting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <p className="text-gray-400 text-sm">Loading components...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            Tinker Tailor — Components
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
          </div>
        )}

        {/* CSV Import Section */}
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-400">
            CSV Import
          </h2>
          <div className="rounded border border-gray-700 bg-[#222] p-4">
            <p className="mb-3 text-xs text-gray-400">
              Upload a CSV with columns: name, code, type_slug
            </p>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                className="text-sm text-gray-300 file:mr-3 file:rounded file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-black hover:file:bg-gray-200"
              />
              <button
                onClick={handleImport}
                disabled={!importFile || importing}
                className="rounded bg-white px-4 py-1.5 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                {importing ? "Importing..." : "Import"}
              </button>
            </div>
            {importResult && (
              <div className="mt-3 text-sm">
                <p className="text-green-400">
                  Created: {importResult.created} | Skipped:{" "}
                  {importResult.skipped}
                </p>
                {importResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-red-400 mb-1">Errors:</p>
                    <ul className="list-disc pl-5 text-xs text-red-300 space-y-0.5">
                      {importResult.errors.map((e, i) => (
                        <li key={i}>
                          Row {e.row}: {e.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Components grouped by category, then by type */}
        {groupedByCategory.map((group) => (
          <section key={group.category.id} className="mb-10">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-400">
              {group.category.name}
            </h2>

            {group.types.map((ct) => {
              const typeComponents = componentsForType(ct.id);
              const form = getCreateForm(ct.id);

              return (
                <div
                  key={ct.id}
                  className="mb-6 rounded border border-gray-700 bg-[#222] p-4"
                >
                  <h3 className="mb-3 text-sm font-semibold text-white">
                    {ct.name}{" "}
                    <span className="font-normal text-gray-500">
                      ({ct.slug} / {ct.stage})
                    </span>
                  </h3>

                  {typeComponents.length > 0 ? (
                    <table className="w-full text-sm mb-4">
                      <thead>
                        <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wider text-gray-500">
                          <th className="pb-2">Name</th>
                          <th className="pb-2">Code</th>
                          <th className="pb-2">Model Path</th>
                          <th className="pb-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {typeComponents.map((comp) => (
                          <tr
                            key={comp.id}
                            className="border-b border-gray-800"
                          >
                            {editingId === comp.id ? (
                              <>
                                <td className="py-2 pr-2">
                                  <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) =>
                                      setEditForm((f) => ({
                                        ...f,
                                        name: e.target.value,
                                      }))
                                    }
                                    className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white"
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <input
                                    type="text"
                                    value={editForm.code}
                                    onChange={(e) =>
                                      setEditForm((f) => ({
                                        ...f,
                                        code: e.target.value,
                                      }))
                                    }
                                    className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white"
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <select
                                    value={editForm.modelPath}
                                    onChange={(e) =>
                                      setEditForm((f) => ({
                                        ...f,
                                        modelPath: e.target.value,
                                      }))
                                    }
                                    className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white"
                                  >
                                    <option value="">None</option>
                                    {assets.map((a) => (
                                      <option key={a.name} value={a.name}>
                                        {a.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-2 text-right space-x-2">
                                  <button
                                    onClick={handleUpdate}
                                    className="rounded bg-white px-2 py-1 text-xs font-medium text-black hover:bg-gray-200 transition-colors"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-[#2a2a2a] transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-2 text-white">
                                  {comp.name}
                                </td>
                                <td className="py-2 text-gray-400">
                                  {comp.code}
                                </td>
                                <td className="py-2 text-gray-400">
                                  {comp.modelPath ?? (
                                    <span className="text-gray-600">-</span>
                                  )}
                                </td>
                                <td className="py-2 text-right space-x-2">
                                  <button
                                    onClick={() => startEdit(comp)}
                                    className="text-blue-400 hover:text-blue-300 text-xs"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDelete(comp.id)}
                                    disabled={deleting === comp.id}
                                    className="text-red-400 hover:text-red-300 disabled:opacity-50 text-xs"
                                  >
                                    {deleting === comp.id
                                      ? "Deleting..."
                                      : "Delete"}
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="mb-4 text-xs text-gray-500">
                      No components yet
                    </p>
                  )}

                  {/* Inline create form */}
                  <div className="flex items-end gap-2 border-t border-gray-700 pt-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-gray-500">
                        Name
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) =>
                          updateCreateForm(ct.id, "name", e.target.value)
                        }
                        placeholder="Component name"
                        className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white placeholder-gray-600"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-gray-500">
                        Code
                      </label>
                      <input
                        type="text"
                        value={form.code}
                        onChange={(e) =>
                          updateCreateForm(ct.id, "code", e.target.value)
                        }
                        placeholder="unique-code"
                        className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white placeholder-gray-600"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-gray-500">
                        Model
                      </label>
                      <select
                        value={form.modelPath}
                        onChange={(e) =>
                          updateCreateForm(ct.id, "modelPath", e.target.value)
                        }
                        className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white"
                      >
                        <option value="">None</option>
                        {assets.map((a) => (
                          <option key={a.name} value={a.name}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => handleCreate(ct.id)}
                      disabled={!form.name || !form.code}
                      className="rounded bg-white px-3 py-1 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        ))}

        {groupedByCategory.length === 0 && (
          <p className="text-gray-500 text-sm">
            No component types found. Create categories and component types
            first.
          </p>
        )}
      </div>
    </div>
  );
}
