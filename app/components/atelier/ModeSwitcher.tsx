"use client";

import { useDesignSession } from "@/lib/store/design-session";
import type { StudioMode } from "@/lib/store/design-session";

const modes: { key: StudioMode; label: string }[] = [
  { key: "imagine", label: "Imagine" },
  { key: "atelier", label: "Atelier" },
];

export default function ModeSwitcher() {
  const studioMode = useDesignSession((s) => s.studioMode);
  const setStudioMode = useDesignSession((s) => s.setStudioMode);

  return (
    <div className="flex rounded-lg bg-[#2a2a2a] p-0.5">
      {modes.map((m) => (
        <button
          key={m.key}
          onClick={() => setStudioMode(m.key)}
          className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
            studioMode === m.key
              ? "bg-white text-black"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
