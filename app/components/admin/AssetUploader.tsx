"use client";

import { useRef, useState } from "react";

interface UploadResult {
  name: string;
  ok: boolean;
  error?: string;
}

export default function AssetUploader({
  onUploaded,
}: {
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[] | null>(null);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setSelectedFiles(files);
    setResults(null);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setResults(null);

    const formData = new FormData();
    selectedFiles.forEach((f) => formData.append("files", f));

    const res = await fetch("/api/admin/assets/upload", {
      method: "POST",
      body: formData,
    });

    const data: UploadResult[] = await res.json();
    setResults(data);
    setUploading(false);

    const allOk = data.every((r) => r.ok);
    if (allOk) {
      setSelectedFiles([]);
      if (inputRef.current) inputRef.current.value = "";
      onUploaded();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept=".obj,.mtl"
        multiple
        onChange={handleSelect}
        className="text-sm text-gray-300 file:mr-3 file:rounded file:border-0 file:bg-gray-700 file:px-3 file:py-1.5 file:text-sm file:text-white file:cursor-pointer hover:file:bg-gray-600"
      />

      {selectedFiles.length > 0 && (
        <div className="text-sm text-gray-400">
          {selectedFiles.map((f) => (
            <div key={f.name}>
              {f.name}{" "}
              <span className="text-gray-500">
                ({(f.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          ))}
        </div>
      )}

      {selectedFiles.length > 0 && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-fit rounded bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-50"
        >
          {uploading
            ? `Uploading ${selectedFiles.length} file(s)...`
            : `Upload ${selectedFiles.length} file(s)`}
        </button>
      )}

      {results && (
        <div className="flex flex-col gap-1 text-sm">
          {results.map((r) => (
            <div
              key={r.name}
              className={r.ok ? "text-green-400" : "text-red-400"}
            >
              {r.name}: {r.ok ? "uploaded" : r.error}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
