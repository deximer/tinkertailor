"use client";

import { useState } from "react";
import { useDesignSession } from "@/lib/store/design-session";

export default function SaveDesignButton() {
  const selectedComponentIds = useDesignSession((s) => s.selectedComponentIds);
  const savedDesignId = useDesignSession((s) => s.savedDesignId);
  const saveDesign = useDesignSession((s) => s.saveDesign);

  const [saving, setSaving] = useState(false);

  const canSave = selectedComponentIds.length > 0 && !saving;

  const handleSave = async () => {
    setSaving(true);
    await saveDesign();
    setSaving(false);
  };

  return (
    <button
      onClick={handleSave}
      disabled={!canSave}
      className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {saving ? "Saving..." : savedDesignId ? "Saved" : "Save Design"}
    </button>
  );
}
