"use client";

import { useEffect, useState, useCallback } from "react";

interface Silhouette {
  id: string;
  name: string;
  patternId: string;
  categoryId: string;
  basePrice: string;
  isComposable: boolean;
  description: string | null;
  createdAt: string;
  componentCount: number;
  tagCount: number;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface AssignedComponent {
  componentId: string;
  componentName: string;
  componentAssetCode: string;
  defaultFabricId: string | null;
}

interface ComponentOption {
  id: string;
  name: string;
  assetCode: string;
  componentTypeId: string;
}

interface Fabric {
  id: string;
  name: string;
  fabricCode: string;
  categoryId: string;
}

interface TagDimension {
  id: string;
  name: string;
  slug: string;
  selectionType: string;
  displayOrder: number;
}

interface TagValue {
  id: string;
  dimensionId: string;
  label: string;
  slug: string;
  displayOrder: number;
}

interface CreateForm {
  name: string;
  patternId: string;
  categoryId: string;
  basePrice: string;
  isComposable: boolean;
  description: string;
}

export default function AdminSilhouettesPage() {
  const [silhouettes, setSilhouettes] = useState<Silhouette[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allComponents, setAllComponents] = useState<ComponentOption[]>([]);
  const [allSkins, setAllSkins] = useState<Fabric[]>([]);
  const [dimensions, setDimensions] = useState<TagDimension[]>([]);
  const [tagValues, setTagValues] = useState<TagValue[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Detail panel state
  const [assignedComponents, setAssignedComponents] = useState<
    AssignedComponent[]
  >([]);
  const [assignedTagIds, setAssignedTagIds] = useState<string[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Edit form for selected silhouette
  const [editForm, setEditForm] = useState({
    name: "",
    patternId: "",
    basePrice: "",
    isComposable: false,
    description: "",
  });
  const [saving, setSaving] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    name: "",
    patternId: "",
    categoryId: "",
    basePrice: "0",
    isComposable: false,
    description: "",
  });

  // Add component
  const [addComponentId, setAddComponentId] = useState("");

  // Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [silRes, catRes, compRes, skinRes, tagRes] = await Promise.all([
        fetch("/api/admin/silhouettes"),
        fetch("/api/categories"),
        fetch("/api/admin/components"),
        fetch("/api/admin/fabrics"),
        fetch("/api/admin/tags"),
      ]);

      if (silRes.ok) setSilhouettes(await silRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (compRes.ok) setAllComponents(await compRes.json());
      if (skinRes.ok) setAllSkins(await skinRes.json());
      if (tagRes.ok) {
        const data = await tagRes.json();
        setDimensions(data.dimensions ?? []);
        setTagValues(data.values ?? []);
      }
    } catch {
      setErrorMsg("Failed to load data");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch detail panel data when a silhouette is selected
  const fetchDetail = useCallback(async (silhouetteId: string) => {
    setLoadingDetail(true);
    try {
      const [compRes, tagRes] = await Promise.all([
        fetch(
          `/api/admin/silhouette-components?silhouetteId=${silhouetteId}`,
        ),
        fetch(`/api/admin/silhouette-tags?silhouetteId=${silhouetteId}`),
      ]);

      if (compRes.ok) setAssignedComponents(await compRes.json());
      if (tagRes.ok) setAssignedTagIds(await tagRes.json());
    } catch {
      setErrorMsg("Failed to load detail data");
    }
    setLoadingDetail(false);
  }, []);

  const selectSilhouette = (sil: Silhouette) => {
    setSelectedId(sil.id);
    setEditForm({
      name: sil.name,
      patternId: sil.patternId,
      basePrice: sil.basePrice,
      isComposable: sil.isComposable,
      description: sil.description ?? "",
    });
    setErrorMsg(null);
    fetchDetail(sil.id);
  };

  const selectedSilhouette = silhouettes.find((s) => s.id === selectedId);

  // -- CRUD handlers --

  const handleCreate = async () => {
    if (!createForm.name || !createForm.patternId || !createForm.categoryId)
      return;

    setErrorMsg(null);
    const res = await fetch("/api/admin/silhouettes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: createForm.name,
        patternId: createForm.patternId,
        categoryId: createForm.categoryId,
        basePrice: createForm.basePrice || "0",
        isComposable: createForm.isComposable,
        description: createForm.description || null,
      }),
    });

    if (res.ok) {
      const created: Silhouette = await res.json();
      setSilhouettes((prev) => [...prev, created]);
      setCreateForm({
        name: "",
        patternId: "",
        categoryId: "",
        basePrice: "0",
        isComposable: false,
        description: "",
      });
      setShowCreate(false);
    } else {
      const data = await res.json();
      setErrorMsg(data.error ?? "Failed to create silhouette");
    }
  };

  const handleSave = async () => {
    if (!selectedId) return;

    setSaving(true);
    setErrorMsg(null);
    const res = await fetch("/api/admin/silhouettes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selectedId,
        name: editForm.name,
        patternId: editForm.patternId,
        basePrice: editForm.basePrice,
        isComposable: editForm.isComposable,
        description: editForm.description || null,
      }),
    });

    if (res.ok) {
      const updated: Silhouette = await res.json();
      setSilhouettes((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s)),
      );
    } else {
      const data = await res.json();
      setErrorMsg(data.error ?? "Failed to update silhouette");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setErrorMsg(null);
    const res = await fetch(`/api/admin/silhouettes?id=${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setSilhouettes((prev) => prev.filter((s) => s.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setAssignedComponents([]);
        setAssignedTagIds([]);
      }
    } else {
      const data = await res.json();
      setErrorMsg(data.error ?? "Failed to delete silhouette");
    }
  };

  // -- Component assignment --

  const handleAddComponent = async () => {
    if (!selectedId || !addComponentId) return;

    setErrorMsg(null);
    const res = await fetch("/api/admin/silhouette-components", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        silhouetteId: selectedId,
        componentId: addComponentId,
      }),
    });

    if (res.ok) {
      setAddComponentId("");
      fetchDetail(selectedId);
    } else {
      const data = await res.json();
      setErrorMsg(data.error ?? "Failed to add component");
    }
  };

  const handleRemoveComponent = async (componentId: string) => {
    if (!selectedId) return;

    setErrorMsg(null);
    const res = await fetch("/api/admin/silhouette-components", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        silhouetteId: selectedId,
        componentId,
      }),
    });

    if (res.ok) {
      setAssignedComponents((prev) =>
        prev.filter((c) => c.componentId !== componentId),
      );
    } else {
      const data = await res.json();
      setErrorMsg(data.error ?? "Failed to remove component");
    }
  };

  const handleChangeFabric = async (
    componentId: string,
    fabricId: string | null,
  ) => {
    if (!selectedId) return;

    setErrorMsg(null);
    const res = await fetch("/api/admin/silhouette-components", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        silhouetteId: selectedId,
        componentId,
        defaultFabricId: fabricId,
      }),
    });

    if (res.ok) {
      setAssignedComponents((prev) =>
        prev.map((c) =>
          c.componentId === componentId
            ? { ...c, defaultFabricId: fabricId }
            : c,
        ),
      );
    } else {
      const data = await res.json();
      setErrorMsg(data.error ?? "Failed to update default fabric");
    }
  };

  // -- Tag assignment --

  const handleToggleTag = async (tagValueId: string, checked: boolean) => {
    if (!selectedId) return;

    setErrorMsg(null);
    if (checked) {
      const res = await fetch("/api/admin/silhouette-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          silhouetteId: selectedId,
          tagValueId,
        }),
      });

      if (res.ok) {
        setAssignedTagIds((prev) => [...prev, tagValueId]);
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to assign tag");
      }
    } else {
      const res = await fetch("/api/admin/silhouette-tags", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          silhouetteId: selectedId,
          tagValueId,
        }),
      });

      if (res.ok) {
        setAssignedTagIds((prev) => prev.filter((id) => id !== tagValueId));
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to remove tag");
      }
    }
  };

  // -- Helpers --

  const categoryName = (catId: string) =>
    categories.find((c) => c.id === catId)?.name ?? catId;

  const componentCount = (sil: Silhouette) => {
    if (sil.id === selectedId) return assignedComponents.length;
    return sil.componentCount;
  };

  const tagCount = (sil: Silhouette) => {
    if (sil.id === selectedId) return assignedTagIds.length;
    return sil.tagCount;
  };

  const assignedComponentIds = new Set(
    assignedComponents.map((c) => c.componentId),
  );
  const unassignedComponents = allComponents.filter(
    (c) => !assignedComponentIds.has(c.id),
  );

  const valuesForDimension = (dimId: string) =>
    tagValues.filter((v) => v.dimensionId === dimId);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <p className="text-gray-400 text-sm">Loading silhouettes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            Tinker Tailor — Silhouettes
          </h1>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="rounded bg-white px-4 py-1.5 text-sm font-medium text-black hover:bg-gray-200 transition-colors"
            >
              {showCreate ? "Cancel" : "New Silhouette"}
            </button>
            <a
              href="/admin"
              className="rounded border border-gray-600 px-3 py-1.5 text-sm text-gray-300 hover:bg-[#2a2a2a] transition-colors"
            >
              Back to Admin
            </a>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-300">
            {errorMsg}
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-400">
              New Silhouette
            </h2>
            <div className="rounded border border-gray-700 bg-[#222] p-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">
                    Name
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="e.g. A-Line Dress"
                    className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">
                    Pattern ID
                  </label>
                  <input
                    type="text"
                    value={createForm.patternId}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        patternId: e.target.value,
                      }))
                    }
                    placeholder="e.g. ALINE-001"
                    className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">
                    Category
                  </label>
                  <select
                    value={createForm.categoryId}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        categoryId: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white"
                  >
                    <option value="">Select category...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">
                    Base Price
                  </label>
                  <input
                    type="text"
                    value={createForm.basePrice}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        basePrice: e.target.value,
                      }))
                    }
                    placeholder="49.99"
                    className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white placeholder-gray-600"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="create-isComposable"
                    checked={createForm.isComposable}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, isComposable: e.target.checked }))
                    }
                    className="rounded border-gray-600"
                  />
                  <label htmlFor="create-isComposable" className="text-xs text-gray-500">
                    Composable (multi-component silhouette)
                  </label>
                </div>
              </div>
              <div className="mb-4">
                <label className="mb-1 block text-xs text-gray-500">
                  Description
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      description: e.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="Optional description..."
                  className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white placeholder-gray-600"
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={
                  !createForm.name ||
                  !createForm.patternId ||
                  !createForm.categoryId
                }
                className="rounded bg-white px-4 py-1.5 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Create
              </button>
            </div>
          </section>
        )}

        {/* Silhouette list */}
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-400">
            Silhouette Templates
          </h2>
          {silhouettes.length > 0 ? (
            <div className="rounded border border-gray-700 bg-[#222] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Pattern ID</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">Base Price</th>
                    <th className="px-4 py-2">Mode</th>
                    <th className="px-4 py-2">Components</th>
                    <th className="px-4 py-2">Tags</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {silhouettes.map((sil, rowIdx) => (
                    <tr
                      key={sil.id}
                      onClick={() => selectSilhouette(sil)}
                      className={`border-b border-gray-800 cursor-pointer transition-colors ${
                        selectedId === sil.id
                          ? "bg-[#2a2a2a]"
                          : rowIdx % 2 === 1
                          ? "bg-[#1e1e1e] hover:bg-[#252525]"
                          : "hover:bg-[#252525]"
                      }`}
                    >
                      <td className="px-4 py-2 text-white">{sil.name}</td>
                      <td className="px-4 py-2 text-gray-400">
                        {sil.patternId}
                      </td>
                      <td className="px-4 py-2 text-gray-400">
                        {categoryName(sil.categoryId)}
                      </td>
                      <td className="px-4 py-2 text-gray-400">
                        ${sil.basePrice}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                          sil.isComposable
                            ? "bg-teal-900/40 text-teal-300"
                            : "bg-gray-700/40 text-gray-400"
                        }`}>
                          {sil.isComposable ? "Composable" : "Legacy"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-400">
                        {componentCount(sil)}
                      </td>
                      <td className="px-4 py-2 text-gray-400">
                        {tagCount(sil)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(sil.id);
                          }}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              No silhouette templates yet. Create one above.
            </p>
          )}
        </section>

        {/* Detail panel */}
        {selectedSilhouette && (
          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-400">
              Detail: {selectedSilhouette.name}
            </h2>

            {loadingDetail ? (
              <p className="text-gray-400 text-sm">Loading detail...</p>
            ) : (
              <div className="space-y-6">
                {/* Editable fields */}
                <div className="rounded border border-gray-700 bg-[#222] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-white">
                    Properties
                  </h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="mb-1 block text-xs text-gray-500">
                        Name
                      </label>
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
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-500">
                        Pattern ID
                      </label>
                      <input
                        type="text"
                        value={editForm.patternId}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            patternId: e.target.value,
                          }))
                        }
                        className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-500">
                        Base Price
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.basePrice}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            basePrice: e.target.value,
                          }))
                        }
                        className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="edit-isComposable"
                        checked={editForm.isComposable}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, isComposable: e.target.checked }))
                        }
                        className="rounded border-gray-600"
                      />
                      <label htmlFor="edit-isComposable" className="text-xs text-gray-500">
                        Composable
                      </label>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="mb-1 block text-xs text-gray-500">
                      Description
                    </label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          description: e.target.value,
                        }))
                      }
                      rows={2}
                      className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white"
                    />
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded bg-white px-4 py-1.5 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>

                {/* Component assignment panel */}
                <div className="rounded border border-gray-700 bg-[#222] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-white">
                    Assigned Components
                  </h3>
                  {assignedComponents.length > 0 ? (
                    <table className="w-full text-sm mb-4">
                      <thead>
                        <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wider text-gray-500">
                          <th className="pb-2">Component</th>
                          <th className="pb-2">Code</th>
                          <th className="pb-2">Default Fabric</th>
                          <th className="pb-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {assignedComponents.map((ac) => (
                          <tr
                            key={ac.componentId}
                            className="border-b border-gray-800"
                          >
                            <td className="py-2 text-white">
                              {ac.componentName}
                            </td>
                            <td className="py-2 text-gray-400">
                              {ac.componentAssetCode}
                            </td>
                            <td className="py-2">
                              <select
                                value={ac.defaultFabricId ?? ""}
                                onChange={(e) =>
                                  handleChangeFabric(
                                    ac.componentId,
                                    e.target.value || null,
                                  )
                                }
                                className="rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white"
                              >
                                <option value="">None</option>
                                {allSkins.map((skin) => (
                                  <option key={skin.id} value={skin.id}>
                                    {skin.name} ({skin.fabricCode})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 text-right">
                              <button
                                onClick={() =>
                                  handleRemoveComponent(ac.componentId)
                                }
                                className="text-red-400 hover:text-red-300 text-xs"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="mb-4 text-xs text-gray-500">
                      No components assigned yet
                    </p>
                  )}

                  <div className="flex items-end gap-2 border-t border-gray-700 pt-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-gray-500">
                        Add Component
                      </label>
                      <select
                        value={addComponentId}
                        onChange={(e) => setAddComponentId(e.target.value)}
                        className="w-full rounded border border-gray-600 bg-[#1a1a1a] px-2 py-1 text-sm text-white"
                      >
                        <option value="">Select component...</option>
                        {unassignedComponents.map((comp) => (
                          <option key={comp.id} value={comp.id}>
                            {comp.name} ({comp.assetCode})
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleAddComponent}
                      disabled={!addComponentId}
                      className="rounded bg-white px-3 py-1 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Tag assignment panel */}
                <div className="rounded border border-gray-700 bg-[#222] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-white">
                    Tag Assignments
                  </h3>
                  {dimensions.length > 0 ? (
                    <div className="space-y-4">
                      {dimensions.map((dim) => {
                        const values = valuesForDimension(dim.id);
                        if (values.length === 0) return null;

                        return (
                          <div key={dim.id}>
                            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
                              {dim.name}
                            </p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              {values.map((val) => {
                                const isChecked = assignedTagIds.includes(
                                  val.id,
                                );
                                return (
                                  <label
                                    key={val.id}
                                    className="flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) =>
                                        handleToggleTag(
                                          val.id,
                                          e.target.checked,
                                        )
                                      }
                                      className="rounded border-gray-600"
                                    />
                                    {val.label}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">
                      No tag dimensions found. Create tag dimensions and values
                      first.
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
