"use client";

import { useEffect, useState, useCallback } from "react";

interface ComponentType {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  designStage: string;
  isAnchor: boolean;
  garmentPart: string | null;
}

interface MatrixComponent {
  id: string;
  name: string;
  code: string;
}

interface MatrixData {
  rows: MatrixComponent[];
  cols: MatrixComponent[];
  edges: string[];
}

export default function AdminCompatibilityPage() {
  const [componentTypes, setComponentTypes] = useState<ComponentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [typeASlug, setTypeASlug] = useState<string>("");
  const [typeBSlug, setTypeBSlug] = useState<string>("");

  const [matrix, setMatrix] = useState<MatrixData | null>(null);
  const [edgeSet, setEdgeSet] = useState<Set<string>>(new Set());

  // Track in-flight toggle requests to disable checkboxes during mutation
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  // Fetch component types on mount
  useEffect(() => {
    async function loadTypes() {
      try {
        const res = await fetch("/api/component-types");
        if (res.ok) {
          const types: ComponentType[] = await res.json();
          // Only show types that participate in compatibility (have a garmentPart)
          const compatibleTypes = types.filter((t) => t.garmentPart != null);
          setComponentTypes(compatibleTypes);

          // Default to bodice + skirt if available, otherwise first two compatible types
          const bodice = compatibleTypes.find((t) => t.garmentPart === "bodice");
          const skirt = compatibleTypes.find((t) => t.garmentPart === "skirt");
          if (bodice && skirt) {
            setTypeASlug(bodice.slug);
            setTypeBSlug(skirt.slug);
          } else if (compatibleTypes.length >= 2) {
            setTypeASlug(compatibleTypes[0].slug);
            setTypeBSlug(compatibleTypes[1].slug);
          } else if (compatibleTypes.length === 1) {
            setTypeASlug(compatibleTypes[0].slug);
          }
        } else {
          setErrorMsg("Failed to load component types");
        }
      } catch {
        setErrorMsg("Failed to load component types");
      }
      setLoading(false);
    }
    loadTypes();
  }, []);

  // Fetch matrix when type pair changes
  const fetchMatrix = useCallback(async () => {
    if (!typeASlug || !typeBSlug) {
      setMatrix(null);
      setEdgeSet(new Set());
      return;
    }

    setMatrixLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(
        `/api/admin/compatibility?typeA=${encodeURIComponent(typeASlug)}&typeB=${encodeURIComponent(typeBSlug)}`,
      );

      if (res.ok) {
        const data: MatrixData = await res.json();
        setMatrix(data);
        setEdgeSet(new Set(data.edges));
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to load matrix");
        setMatrix(null);
        setEdgeSet(new Set());
      }
    } catch {
      setErrorMsg("Failed to load compatibility matrix");
      setMatrix(null);
      setEdgeSet(new Set());
    }

    setMatrixLoading(false);
  }, [typeASlug, typeBSlug]);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  const handleToggle = async (rowId: string, colId: string) => {
    const key = `${rowId}:${colId}`;
    const isCurrentlyCompatible = edgeSet.has(key);

    // Mark as toggling
    setToggling((prev) => new Set(prev).add(key));

    // Optimistic update
    setEdgeSet((prev) => {
      const next = new Set(prev);
      if (isCurrentlyCompatible) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

    try {
      const res = await fetch("/api/admin/compatibility", {
        method: isCurrentlyCompatible ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          componentAId: rowId,
          componentBId: colId,
        }),
      });

      if (!res.ok && res.status !== 204) {
        // Revert optimistic update
        setEdgeSet((prev) => {
          const next = new Set(prev);
          if (isCurrentlyCompatible) {
            next.add(key);
          } else {
            next.delete(key);
          }
          return next;
        });
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to update compatibility");
      }
    } catch {
      // Revert optimistic update
      setEdgeSet((prev) => {
        const next = new Set(prev);
        if (isCurrentlyCompatible) {
          next.add(key);
        } else {
          next.delete(key);
        }
        return next;
      });
      setErrorMsg("Failed to update compatibility");
    }

    setToggling((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  // Count compatible edges per row and per column
  const rowCounts = new Map<string, number>();
  const colCounts = new Map<string, number>();

  if (matrix) {
    for (const row of matrix.rows) {
      let count = 0;
      for (const col of matrix.cols) {
        if (edgeSet.has(`${row.id}:${col.id}`)) count++;
      }
      rowCounts.set(row.id, count);
    }
    for (const col of matrix.cols) {
      let count = 0;
      for (const row of matrix.rows) {
        if (edgeSet.has(`${row.id}:${col.id}`)) count++;
      }
      colCounts.set(col.id, count);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            Tinker Tailor — Compatibility
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
            <button
              onClick={() => setErrorMsg(null)}
              className="ml-3 text-red-400 hover:text-red-300"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Type pair selector */}
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-400">
            Select Component Types
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-gray-500">
                Row Type (A)
              </label>
              <select
                value={typeASlug}
                onChange={(e) => setTypeASlug(e.target.value)}
                className="w-full rounded border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm text-white"
              >
                <option value="">Select type...</option>
                {componentTypes.map((ct) => (
                  <option key={ct.id} value={ct.slug}>
                    {ct.name} ({ct.slug})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-1 text-gray-500 text-lg font-light">
              x
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-gray-500">
                Column Type (B)
              </label>
              <select
                value={typeBSlug}
                onChange={(e) => setTypeBSlug(e.target.value)}
                className="w-full rounded border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm text-white"
              >
                <option value="">Select type...</option>
                {componentTypes.map((ct) => (
                  <option key={ct.id} value={ct.slug}>
                    {ct.name} ({ct.slug})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Matrix */}
        {matrixLoading && (
          <p className="text-gray-400 text-sm">Loading matrix...</p>
        )}

        {!matrixLoading && !typeASlug && !typeBSlug && (
          <div className="rounded border border-gray-700 bg-[#222] p-8 text-center">
            <p className="text-gray-500 text-sm">
              Select two component types above to view and edit their
              compatibility matrix.
            </p>
          </div>
        )}

        {!matrixLoading && (typeASlug || typeBSlug) && (!typeASlug || !typeBSlug) && (
          <div className="rounded border border-gray-700 bg-[#222] p-8 text-center">
            <p className="text-gray-500 text-sm">
              Select both component types to load the matrix.
            </p>
          </div>
        )}

        {!matrixLoading && matrix && matrix.rows.length === 0 && matrix.cols.length === 0 && (
          <div className="rounded border border-gray-700 bg-[#222] p-8 text-center">
            <p className="text-gray-500 text-sm">
              No components found for either type. Add components first.
            </p>
          </div>
        )}

        {!matrixLoading && matrix && matrix.rows.length === 0 && matrix.cols.length > 0 && (
          <div className="rounded border border-gray-700 bg-[#222] p-8 text-center">
            <p className="text-gray-500 text-sm">
              No components found for the row type. Add components first.
            </p>
          </div>
        )}

        {!matrixLoading && matrix && matrix.rows.length > 0 && matrix.cols.length === 0 && (
          <div className="rounded border border-gray-700 bg-[#222] p-8 text-center">
            <p className="text-gray-500 text-sm">
              No components found for the column type. Add components first.
            </p>
          </div>
        )}

        {!matrixLoading && matrix && matrix.rows.length > 0 && matrix.cols.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wider text-gray-400">
                Compatibility Matrix
              </h2>
              <p className="text-xs text-gray-500">
                {edgeSet.size} edge{edgeSet.size !== 1 ? "s" : ""} of{" "}
                {matrix.rows.length * matrix.cols.length} possible
              </p>
            </div>
            <div className="rounded border border-gray-700 bg-[#222] overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="sticky top-0 z-10 bg-[#222]">
                    <th className="sticky left-0 z-20 bg-[#222] border-b border-r border-gray-700 px-3 py-2 text-left text-xs uppercase tracking-wider text-gray-500 min-w-[160px]">
                      {componentTypes.find((ct) => ct.slug === typeASlug)?.name ?? typeASlug}
                      {" \\ "}
                      {componentTypes.find((ct) => ct.slug === typeBSlug)?.name ?? typeBSlug}
                    </th>
                    {matrix.cols.map((col) => (
                      <th
                        key={col.id}
                        className="border-b border-gray-700 px-2 py-2 text-center text-xs text-gray-400 font-normal min-w-[60px]"
                        title={`${col.name} (${col.code})`}
                      >
                        <div className="truncate max-w-[80px]">{col.code}</div>
                      </th>
                    ))}
                    <th className="border-b border-l border-gray-700 px-3 py-2 text-center text-xs uppercase tracking-wider text-gray-500">
                      Count
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map((row) => (
                    <tr key={row.id} className="border-b border-gray-800 hover:bg-[#2a2a2a]">
                      <td
                        className="sticky left-0 bg-[#222] border-r border-gray-700 px-3 py-1.5 text-xs text-white font-medium whitespace-nowrap"
                        title={`${row.name} (${row.code})`}
                      >
                        {row.name}
                      </td>
                      {matrix.cols.map((col) => {
                        const key = `${row.id}:${col.id}`;
                        const isChecked = edgeSet.has(key);
                        const isToggling = toggling.has(key);

                        return (
                          <td
                            key={col.id}
                            className="px-2 py-1.5 text-center"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isToggling}
                              onChange={() => handleToggle(row.id, col.id)}
                              className="h-4 w-4 rounded border-gray-600 bg-[#1a1a1a] text-white accent-white cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                            />
                          </td>
                        );
                      })}
                      <td className="border-l border-gray-700 px-3 py-1.5 text-center text-xs text-gray-400 tabular-nums">
                        {rowCounts.get(row.id) ?? 0}
                      </td>
                    </tr>
                  ))}
                  {/* Column counts footer */}
                  <tr className="border-t border-gray-700">
                    <td className="sticky left-0 bg-[#222] border-r border-gray-700 px-3 py-2 text-xs uppercase tracking-wider text-gray-500">
                      Count
                    </td>
                    {matrix.cols.map((col) => (
                      <td
                        key={col.id}
                        className="px-2 py-2 text-center text-xs text-gray-400 tabular-nums"
                      >
                        {colCounts.get(col.id) ?? 0}
                      </td>
                    ))}
                    <td className="border-l border-gray-700 px-3 py-2 text-center text-xs text-gray-500 tabular-nums">
                      {edgeSet.size}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {componentTypes.length === 0 && (
          <div className="rounded border border-gray-700 bg-[#222] p-8 text-center">
            <p className="text-gray-500 text-sm">
              No component types found. Create component types first.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
