import { create } from "zustand";
import type { DesignPhase } from "@/lib/compatibility/engine";

interface DesignSessionState {
  silhouetteId: string | null;
  selectedComponentIds: string[];
  selectedFabricSkinId: string | null;
  selectedFabricCode: string | null;
  designPhase: DesignPhase;
  designName: string;
  savedDesignId: string | null;
}

interface DesignSessionActions {
  loadSilhouette: (id: string, componentIds: string[]) => void;
  selectComponent: (id: string) => void;
  deselectComponent: (id: string) => void;
  setSelectedComponents: (ids: string[]) => void;
  selectFabric: (id: string, fabricCode: string) => void;
  setDesignPhase: (phase: DesignPhase) => void;
  setDesignName: (name: string) => void;
  reset: () => void;
}

const initialState: DesignSessionState = {
  silhouetteId: null,
  selectedComponentIds: [],
  selectedFabricSkinId: null,
  selectedFabricCode: null,
  designPhase: "silhouette",
  designName: "My Design",
  savedDesignId: null,
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
      selectedFabricCode: null,
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

  setSelectedComponents: (ids) =>
    set({ selectedComponentIds: ids }),

  selectFabric: (id, fabricCode) =>
    set({ selectedFabricSkinId: id, selectedFabricCode: fabricCode }),

  setDesignPhase: (phase) =>
    set({ designPhase: phase }),

  setDesignName: (name) =>
    set({ designName: name }),

  reset: () => set(initialState),
}));
