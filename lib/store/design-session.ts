import { create } from "zustand";
import type { DesignPhase } from "@/lib/compatibility/engine";

export type StudioMode = "imagine" | "atelier";

interface DesignSessionState {
  studioMode: StudioMode;
  silhouetteId: string | null;
  selectedComponentIds: string[];
  selectedFabricSkinId: string | null;
  selectedFabricCode: string | null;
  designPhase: DesignPhase;
  designName: string;
  savedDesignId: string | null;
}

interface DesignSessionActions {
  setStudioMode: (mode: StudioMode) => void;
  loadSilhouette: (id: string, componentIds: string[]) => void;
  selectComponent: (id: string) => void;
  deselectComponent: (id: string) => void;
  setSelectedComponents: (ids: string[]) => void;
  selectFabric: (id: string, fabricCode: string) => void;
  setDesignPhase: (phase: DesignPhase) => void;
  setDesignName: (name: string) => void;
  saveDesign: () => Promise<string | null>;
  loadDesign: (id: string) => Promise<{ error: string } | null>;
  reset: () => void;
}

const initialState: DesignSessionState = {
  studioMode: "imagine",
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
>()((set, get) => ({
  ...initialState,

  setStudioMode: (mode) => set({ studioMode: mode }),

  loadSilhouette: (id, componentIds) =>
    set({
      studioMode: "atelier",
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

  saveDesign: async () => {
    const state = get();
    if (state.selectedComponentIds.length === 0) return null;

    try {
      const res = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.designName,
          silhouetteTemplateId: state.silhouetteId,
          selectedComponentIds: state.selectedComponentIds,
          selectedFabricSkinId: state.selectedFabricSkinId,
        }),
      });

      if (!res.ok) return null;

      const { id } = (await res.json()) as { id: string };
      set({ savedDesignId: id });
      return id;
    } catch {
      return null;
    }
  },

  loadDesign: async (id) => {
    try {
      const res = await fetch(`/api/designs/${id}`);
      if (!res.ok) {
        return { error: res.status === 404 ? "Design not found" : "Failed to load design" };
      }

      const data = (await res.json()) as {
        id: string;
        name: string;
        silhouetteTemplateId: string | null;
        components: {
          id: string;
          fabricSkinId: string | null;
          fabricCode: string | null;
        }[];
      };

      const componentIds = data.components.map((c) => c.id);
      const fabric = data.components.find((c) => c.fabricSkinId);

      set({
        savedDesignId: data.id,
        designName: data.name,
        silhouetteId: data.silhouetteTemplateId,
        selectedComponentIds: componentIds,
        selectedFabricSkinId: fabric?.fabricSkinId ?? null,
        selectedFabricCode: fabric?.fabricCode ?? null,
      });
      return null;
    } catch {
      return { error: "Failed to load design" };
    }
  },

  reset: () => set(initialState),
}));
