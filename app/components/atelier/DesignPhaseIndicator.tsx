"use client";

import { useDesignSession } from "@/lib/store/design-session";
import type { DesignPhase } from "@/lib/compatibility/engine";

const PHASES: { key: DesignPhase; label: string }[] = [
  { key: "silhouette", label: "Silhouette" },
  { key: "embellishment", label: "Embellishment" },
  { key: "finishing", label: "Finishing" },
  { key: "complete", label: "Complete" },
];

const PHASE_INDEX: Record<DesignPhase, number> = {
  silhouette: 0,
  embellishment: 1,
  finishing: 2,
  complete: 3,
};

export default function DesignPhaseIndicator() {
  const designPhase = useDesignSession((s) => s.designPhase);
  const currentIdx = PHASE_INDEX[designPhase];

  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {PHASES.map((phase, i) => {
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={phase.key} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className={`h-px w-4 ${isDone ? "bg-green-400" : "bg-gray-700"}`}
              />
            )}
            <div
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                isCurrent
                  ? "bg-white text-black"
                  : isDone
                    ? "bg-green-400/20 text-green-400"
                    : "bg-[#2a2a2a] text-gray-500"
              }`}
            >
              {phase.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
