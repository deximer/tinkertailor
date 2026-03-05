import { create } from "zustand";
import type { DesignPhase } from "@/lib/compatibility/engine";

interface DesignSessionState {
  silhouetteId: string | null;
  selectedComponentIds: string[];
  selectedFabricSkinId: string | null;
  designPhase: DesignPhase;
}

interface DesignSessionActions {
  loadSilhouette: (id: string, componentIds: string[]) => void;
  selectComponent: (id: string) => void;
  deselectComponent: (id: string) => void;
  selectFabric: (id: string) => void;
  setDesignPhase: (phase: DesignPhase) => void;
  reset: () => void;
}

const initialState: DesignSessionState = {
  silhouetteId: null,
  selectedComponentIds: [],
  selectedFabricSkinId: null,
  designPhase: "silhouette",
};

export const useDesignSession = create<
  DesignSessionState & DesignSessionActions
>()((set) => ({
  ...initialState,

  loadSilhouette: (id, componentIds) =>
    set({
      silhouetteId: id,
      selectedComponentIds: componentIds,
      selectedFabricSkinId: null,
      designPhase: "embellishment",
    }),

  selectComponent: (id) =>
    set((state) => ({
      selectedComponentIds: state.selectedComponentIds.includes(id)
        ? state.selectedComponentIds
        : [...state.selectedComponentIds, id],
    })),

  deselectComponent: (id) =>
    set((state) => ({
      selectedComponentIds: state.selectedComponentIds.filter((c) => c !== id),
    })),

  selectFabric: (id) =>
    set({ selectedFabricSkinId: id }),

  setDesignPhase: (phase) =>
    set({ designPhase: phase }),

  reset: () => set(initialState),
}));
