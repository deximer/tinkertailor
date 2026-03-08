"use client";

import { useEffect, useState, useCallback } from "react";

interface ComponentType {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  designStage: string;
  isAnchor: boolean;
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

interface Mesh {
  id: string;
  componentId: string;
  variant: string;
  storagePath: string;
  publicUrl: string;
}

interface GroupedTypes {
  category: Category;
  types: ComponentType[];
}

const MESH_VARIANTS = ["heavy", "light", "standard"] as const;

export default function AdminComponentsPage() {
  const [components, setComponents] = useState<Component[]>([]);
  const [componentTypes, setComponentTypes] = useState<ComponentType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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

  // Mesh management
  const [expandedMeshId, setExpandedMeshId] = useState<string | null>(null);
  const [meshes, setMeshes] = useState<Record<string, Mesh[]>>({});
  const [meshLoading, setMeshLoading] = useState<string | null>(null);
  const [uploadingVariant, setUploadingVariant] = useState<string | null>(null);

  // Operation feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [compRes, typesRes, catsRes] = await Promise.all([
        fetch("/api/admin/components"),
        fetch("/api/component-types"),
        fetch("/api/categories"),
      ]);

      if (compRes.ok) setComponents(await compRes.json());
      if (typesRes.ok) setComponentTypes(await typesRes.json());
      if (catsRes.ok) setCategories(await catsRes.json());
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
      if (expandedMeshId === id) setExpandedMeshId(null);
    } else {
      const data = await res.json();
      setErrorMsg(data.error ?? "Failed to delete component");
    }
    setDeleting(null);
  };

  // Mesh management
  const fetchMeshes = async (componentId: string) => {
    setMeshLoading(componentId);
    try {
      const res = await fetch(
        `/api/admin/component-meshes?componentId=${componentId}`,
      );
      if (res.ok) {
        const data: Mesh[] = await res.json();
        setMeshes((prev) => ({ ...prev, [componentId]: data }));
      }
    } catch {
      setErrorMsg("Failed to load meshes");
    }
    setMeshLoading(null);
  };

  const toggleMeshPanel = (componentId: string) => {
    if (expandedMeshId === componentId) {
      setExpandedMeshId(null);
    } else {
      setExpandedMeshId(componentId);
      if (!meshes[componentId]) {
        fetchMeshes(componentId);
      }
    }
  };

  const handleMeshUpload = async (
    componentId: string,
    variant: string,
    file: File,
  ) => {
    setUploadingVariant(`${componentId}:${variant}`);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("componentId", componentId);
    formData.append("variant", variant);
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/component-meshes", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        await fetchMeshes(componentId);
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to upload mesh");
      }
    } catch {
      setErrorMsg("Failed to upload mesh");
    }
    setUploadingVariant(null);
  };

  const handleMeshDelete = async (meshId: string, componentId: string) => {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/component-meshes?id=${meshId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setMeshes((prev) => ({
          ...prev,
          [componentId]: (prev[componentId] ?? []).filter(
            (m) => m.id !== meshId,
          ),
        }));
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to delete mesh");
      }
    } catch {
      setErrorMsg("Failed to delete mesh");
    }
  };

  const getMeshForVariant = (componentId: string, variant: string) =>
    (meshes[componentId] ?? []).find((m) => m.variant === variant);

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
                      ({ct.slug} / {ct.designStage})
                    </span>
                  </h3>

                  {typeComponents.length > 0 ? (
                    <table className="w-full text-sm mb-4">
                      <thead>
                        <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wider text-gray-500">
                          <th className="pb-2">Name</th>
                          <th className="pb-2">Code</th>
                          <th className="pb-2">Asset Code</th>
                          <th className="pb-2">Meshes</th>
                          <th className="pb-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {typeComponents.map((comp) => (
                          <>
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
                                    <input
                                      type="text"
                                      value={editForm.modelPath}
                                      onChange={(e) =>
                                        setEditForm((f) => ({
                                          ...f,
                                          modelPath: e.target.value,
                                        }))
                                      }
                                      placeholder="e.g. BOD-27"
                                      className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white placeholder-gray-600"
                                    />
                                  </td>
                                  <td className="py-2" />
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
                                      <span className="text-gray-600">—</span>
                                    )}
                                  </td>
                                  <td className="py-2">
                                    <button
                                      onClick={() => toggleMeshPanel(comp.id)}
                                      className={`text-xs px-2 py-0.5 rounded ${
                                        expandedMeshId === comp.id
                                          ? "bg-blue-900/50 text-blue-300"
                                          : "text-gray-400 hover:text-white"
                                      }`}
                                    >
                                      {expandedMeshId === comp.id
                                        ? "Hide"
                                        : "Manage"}
                                    </button>
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
                            {/* Mesh management panel */}
                            {expandedMeshId === comp.id && (
                              <tr key={`${comp.id}-mesh`}>
                                <td
                                  colSpan={5}
                                  className="bg-[#1a1a1a] px-4 py-3"
                                >
                                  {meshLoading === comp.id ? (
                                    <p className="text-xs text-gray-500">
                                      Loading meshes...
                                    </p>
                                  ) : (
                                    <div className="space-y-2">
                                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Mesh Variants
                                      </p>
                                      {MESH_VARIANTS.map((variant) => {
                                        const mesh = getMeshForVariant(
                                          comp.id,
                                          variant,
                                        );
                                        const isUploading =
                                          uploadingVariant ===
                                          `${comp.id}:${variant}`;

                                        return (
                                          <div
                                            key={variant}
                                            className="flex items-center gap-3 rounded border border-gray-700 bg-[#222] px-3 py-2"
                                          >
                                            <span className="w-20 text-xs font-medium text-gray-300 capitalize">
                                              {variant}
                                            </span>
                                            {mesh ? (
                                              <>
                                                <span className="flex-1 truncate text-xs text-gray-500">
                                                  {mesh.storagePath}
                                                </span>
                                                <button
                                                  onClick={() =>
                                                    handleMeshDelete(
                                                      mesh.id,
                                                      comp.id,
                                                    )
                                                  }
                                                  className="text-xs text-red-400 hover:text-red-300"
                                                >
                                                  Delete
                                                </button>
                                              </>
                                            ) : (
                                              <>
                                                <span className="flex-1 text-xs text-gray-600">
                                                  No file uploaded
                                                </span>
                                                <label className="cursor-pointer text-xs text-blue-400 hover:text-blue-300">
                                                  {isUploading
                                                    ? "Uploading..."
                                                    : "Upload"}
                                                  <input
                                                    type="file"
                                                    className="hidden"
                                                    accept=".obj,.glb,.gltf"
                                                    disabled={isUploading}
                                                    onChange={(e) => {
                                                      const file =
                                                        e.target.files?.[0];
                                                      if (file) {
                                                        handleMeshUpload(
                                                          comp.id,
                                                          variant,
                                                          file,
                                                        );
                                                      }
                                                      e.target.value = "";
                                                    }}
                                                  />
                                                </label>
                                              </>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </>
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
                        Asset Code
                      </label>
                      <input
                        type="text"
                        value={form.modelPath}
                        onChange={(e) =>
                          updateCreateForm(ct.id, "modelPath", e.target.value)
                        }
                        placeholder="e.g. BOD-27"
                        className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white placeholder-gray-600"
                      />
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
