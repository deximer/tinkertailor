"use client";

import { useRouter } from "next/navigation";
import { useDesignSession } from "@/lib/store/design-session";
import ModeSwitcher from "./ModeSwitcher";
import DesignPhaseIndicator from "./DesignPhaseIndicator";
import SaveDesignButton from "./SaveDesignButton";

export default function DesignSessionHeader() {
  const router = useRouter();
  const designName = useDesignSession((s) => s.designName);
  const setDesignName = useDesignSession((s) => s.setDesignName);
  const selectedComponentIds = useDesignSession((s) => s.selectedComponentIds);
  const savedDesignId = useDesignSession((s) => s.savedDesignId);
  const silhouetteId = useDesignSession((s) => s.silhouetteId);
  const selectedFabricSkinId = useDesignSession((s) => s.selectedFabricSkinId);
  const reset = useDesignSession((s) => s.reset);

  const canCheckout = !!savedDesignId && !!silhouetteId && !!selectedFabricSkinId;

  const handleNew = () => {
    // Skip confirmation if nothing to lose (no components selected or already saved)
    if (selectedComponentIds.length === 0 || savedDesignId) {
      reset();
      return;
    }
    if (window.confirm("Start a new design? Your unsaved changes will be lost.")) {
      reset();
    }
  };

  return (
    <header className="flex items-center gap-4 border-b border-gray-800 bg-[#1a1a1a] px-4 py-2">
      {/* Mode tabs */}
      <ModeSwitcher />

      {/* Design name (editable) */}
      <input
        value={designName}
        onChange={(e) => setDesignName(e.target.value)}
        className="min-w-0 flex-1 truncate border-none bg-transparent text-sm font-medium text-white outline-none placeholder-gray-500 focus:ring-0"
        placeholder="Untitled Design"
      />

      {/* Phase indicator */}
      <DesignPhaseIndicator />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <SaveDesignButton />
        <button
          disabled={!canCheckout}
          onClick={() => router.push(`/checkout?productId=${savedDesignId}`)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            canCheckout
              ? "bg-emerald-600 text-white hover:bg-emerald-500"
              : "cursor-not-allowed bg-gray-700 text-gray-500"
          }`}
        >
          Checkout
        </button>
        <button
          onClick={handleNew}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-[#2a2a2a] hover:text-white"
        >
          New
        </button>
      </div>
    </header>
  );
}
