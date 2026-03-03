"use client";

import { useEffect, useState, useCallback } from "react";

interface Asset {
  name: string;
  size: number;
  updatedAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function AssetList({
  refreshKey,
}: {
  refreshKey: number;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/assets");
    if (res.ok) {
      const data = await res.json();
      setAssets(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets, refreshKey]);

  const handleDelete = async (name: string) => {
    setDeleting(name);
    const res = await fetch(`/api/admin/assets?name=${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setAssets((prev) => prev.filter((a) => a.name !== name));
    }
    setDeleting(null);
  };

  if (loading) {
    return <p className="text-gray-400 text-sm">Loading assets...</p>;
  }

  if (assets.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        No files in the models bucket yet. Upload some OBJ/MTL files above.
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wider text-gray-500">
          <th className="pb-2">File</th>
          <th className="pb-2">Size</th>
          <th className="pb-2">Updated</th>
          <th className="pb-2" />
        </tr>
      </thead>
      <tbody>
        {assets.map((asset) => (
          <tr key={asset.name} className="border-b border-gray-800">
            <td className="py-2 text-white">{asset.name}</td>
            <td className="py-2 text-gray-400">{formatBytes(asset.size)}</td>
            <td className="py-2 text-gray-400">
              {asset.updatedAt
                ? new Date(asset.updatedAt).toLocaleDateString()
                : "-"}
            </td>
            <td className="py-2 text-right">
              <button
                onClick={() => handleDelete(asset.name)}
                disabled={deleting === asset.name}
                className="text-red-400 hover:text-red-300 disabled:opacity-50 text-xs"
              >
                {deleting === asset.name ? "Deleting..." : "Delete"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
