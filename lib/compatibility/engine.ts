/**
 * Compatibility engine — the core business logic for enforcing component
 * and fabric compatibility rules.
 *
 * Used by both Atelier (real-time filtering) and TARA (validation).
 *
 * Key rules (from legacy app):
 * 1. If a component's type has is_anchor=true, selecting it clears all
 *    other selected components.
 * 2. Otherwise, selecting a component deselects only other components of the
 *    same type.
 * 3. Stage sequencing: silhouette must complete before embellishment,
 *    embellishment before finishing.
 * 4. Fabric filtering: intersect compatible_skin_categories across selected
 *    components; show only fabrics from the anchor component's categories.
 */

import { eq, and, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  components,
  componentTypes,
  componentCompatibility,
  fabricCategories,
  fabrics,
  componentFabricRules,
} from "../db/schema";
import type { ComponentDesignStage } from "../db/schema/component-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DesignPhase = "silhouette" | "embellishment" | "finishing" | "complete";

export interface ComponentWithType {
  id: string;
  name: string;
  code: string;
  componentTypeId: string;
  modelPath: string | null;
  typeName: string;
  typeSlug: string;
  designStage: ComponentDesignStage;
  isAnchor: boolean;
}

export interface CompatibleComponentsResult {
  designPhase: DesignPhase;
  components: ComponentWithType[];
  selectedComponents: ComponentWithType[];
}

export interface FabricCategoryWithSkins {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  skins: {
    id: string;
    name: string;
    fabricCode: string;
    priceMarkup: string;
  }[];
}

// ---------------------------------------------------------------------------
// Selection logic
// ---------------------------------------------------------------------------

/**
 * Apply selection rules when a new component is selected.
 *
 * Returns the new set of selected component IDs after deselection rules.
 */
export async function applySelectionRules(
  db: PostgresJsDatabase,
  currentSelectionIds: string[],
  newComponentId: string,
): Promise<string[]> {
  // Get the new component's type info
  const newComp = await db
    .select({
      id: components.id,
      typeId: componentTypes.id,
      isAnchor: componentTypes.isAnchor,
    })
    .from(components)
    .innerJoin(componentTypes, eq(components.componentTypeId, componentTypes.id))
    .where(eq(components.id, newComponentId))
    .limit(1);

  if (newComp.length === 0) return currentSelectionIds;

  const { isAnchor, typeId } = newComp[0];

  if (isAnchor) {
    // Anchor selection: clear ALL other components
    return [newComponentId];
  }

  // Non-anchor: deselect only components of the same type
  if (currentSelectionIds.length === 0) return [newComponentId];

  const currentComps = await db
    .select({ id: components.id, typeId: components.componentTypeId })
    .from(components)
    .where(inArray(components.id, currentSelectionIds));

  const kept = currentComps
    .filter((c) => c.typeId !== typeId)
    .map((c) => c.id);

  return [...kept, newComponentId];
}

// ---------------------------------------------------------------------------
// Compatible components query
// ---------------------------------------------------------------------------

/**
 * Given an array of selected component IDs, return all components that
 * remain compatible with the full selection set.
 *
 * Compatibility is bidirectional: if A-B exists in the edge table, both
 * A and B are compatible when the other is selected.
 */
export async function getCompatibleComponents(
  db: PostgresJsDatabase,
  selectedComponentIds: string[],
): Promise<CompatibleComponentsResult> {
  // Get selected components with type info
  let selectedComps: ComponentWithType[] = [];
  if (selectedComponentIds.length > 0) {
    selectedComps = await db
      .select({
        id: components.id,
        name: components.name,
        code: components.code,
        componentTypeId: components.componentTypeId,
        modelPath: components.modelPath,
        typeName: componentTypes.name,
        typeSlug: componentTypes.slug,
        designStage: componentTypes.designStage,
        isAnchor: componentTypes.isAnchor,
      })
      .from(components)
      .innerJoin(componentTypes, eq(components.componentTypeId, componentTypes.id))
      .where(inArray(components.id, selectedComponentIds));
  }

  // Determine current design phase
  const designPhase = determineDesignPhase(selectedComps);

  // Get allowed stages based on design phase
  const allowedStages = getAllowedStages(designPhase);

  // If no selection, return all components in allowed stages
  if (selectedComponentIds.length === 0) {
    const allComps = await db
      .select({
        id: components.id,
        name: components.name,
        code: components.code,
        componentTypeId: components.componentTypeId,
        modelPath: components.modelPath,
        typeName: componentTypes.name,
        typeSlug: componentTypes.slug,
        designStage: componentTypes.designStage,
        isAnchor: componentTypes.isAnchor,
      })
      .from(components)
      .innerJoin(componentTypes, eq(components.componentTypeId, componentTypes.id))
      .where(inArray(componentTypes.designStage, allowedStages));

    return {
      designPhase,
      components: allComps,
      selectedComponents: [],
    };
  }

  // Find components compatible with ALL selected components
  // For each selected component, get its compatible set, then intersect
  let compatibleIds: Set<string> | null = null;

  for (const selId of selectedComponentIds) {
    // Get IDs compatible with this selected component (bidirectional)
    const edges = await db
      .select({
        compatId: componentCompatibility.componentBId,
      })
      .from(componentCompatibility)
      .where(eq(componentCompatibility.componentAId, selId));

    const reverseEdges = await db
      .select({
        compatId: componentCompatibility.componentAId,
      })
      .from(componentCompatibility)
      .where(eq(componentCompatibility.componentBId, selId));

    const thisSet = new Set([
      ...edges.map((e) => e.compatId),
      ...reverseEdges.map((e) => e.compatId),
    ]);

    if (compatibleIds === null) {
      compatibleIds = thisSet;
    } else {
      // Intersect — use temp to preserve TypeScript narrowing across reassignment
      const current: Set<string> = compatibleIds;
      compatibleIds = new Set<string>(
        [...current].filter((id) => thisSet.has(id)),
      );
    }
  }

  // Also include the selected components themselves
  const resultIds = compatibleIds ?? new Set<string>();
  for (const id of selectedComponentIds) {
    resultIds.add(id);
  }

  if (resultIds.size === 0) {
    return { designPhase, components: [], selectedComponents: selectedComps };
  }

  // Fetch full component data, filtered by allowed stages
  const compatComps = await db
    .select({
      id: components.id,
      name: components.name,
      code: components.code,
      componentTypeId: components.componentTypeId,
      modelPath: components.modelPath,
      typeName: componentTypes.name,
      typeSlug: componentTypes.slug,
      designStage: componentTypes.designStage,
      isAnchor: componentTypes.isAnchor,
    })
    .from(components)
    .innerJoin(componentTypes, eq(components.componentTypeId, componentTypes.id))
    .where(
      and(
        inArray(components.id, [...resultIds]),
        inArray(componentTypes.designStage, allowedStages),
      ),
    );

  // Filter out already-selected components from the compatible list
  const selectedIdSet = new Set(selectedComponentIds);
  const available = compatComps.filter((c) => !selectedIdSet.has(c.id));

  return {
    designPhase,
    components: available,
    selectedComponents: selectedComps,
  };
}

// ---------------------------------------------------------------------------
// Compatible fabrics query
// ---------------------------------------------------------------------------

/**
 * Given selected component IDs, return fabric options valid for the selection.
 *
 * Logic: find the is_anchor component; return its compatible fabric
 * categories and their non-hidden leaf skins.
 */
export async function getCompatibleFabrics(
  db: PostgresJsDatabase,
  selectedComponentIds: string[],
): Promise<FabricCategoryWithSkins[]> {
  if (selectedComponentIds.length === 0) return [];

  // Find the anchor component in the selection
  const selectedWithTypes = await db
    .select({
      compId: components.id,
      isAnchor: componentTypes.isAnchor,
    })
    .from(components)
    .innerJoin(componentTypes, eq(components.componentTypeId, componentTypes.id))
    .where(inArray(components.id, selectedComponentIds));

  const anchor = selectedWithTypes.find((c) => c.isAnchor);
  if (!anchor) return [];

  // Get fabric categories linked to the anchor component
  const linkedCats = await db
    .select({
      categoryId: componentFabricRules.fabricCategoryId,
    })
    .from(componentFabricRules)
    .where(eq(componentFabricRules.componentId, anchor.compId));

  if (linkedCats.length === 0) return [];

  const catIds = linkedCats.map((c) => c.categoryId);

  // Get the categories with their parent info
  const cats = await db
    .select()
    .from(fabricCategories)
    .where(inArray(fabricCategories.id, catIds));

  // For each category, get non-hidden leaf skins
  const result: FabricCategoryWithSkins[] = [];

  for (const cat of cats) {
    if (cat.hidden) continue;

    const skins = await db
      .select({
        id: fabrics.id,
        name: fabrics.name,
        fabricCode: fabrics.fabricCode,
        priceMarkup: fabrics.priceMarkup,
      })
      .from(fabrics)
      .where(
        and(
          eq(fabrics.categoryId, cat.id),
          eq(fabrics.hidden, false),
        ),
      );

    if (skins.length > 0) {
      result.push({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        parentId: cat.parentId,
        skins,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Stage sequencing helpers
// ---------------------------------------------------------------------------

function determineDesignPhase(selectedComps: ComponentWithType[]): DesignPhase {
  if (selectedComps.length === 0) return "silhouette";

  const stages = new Set(selectedComps.map((c) => c.designStage));
  const hasAnchor = selectedComps.some((c) => c.isAnchor);

  // If no anchor component selected yet, still in silhouette phase
  if (!hasAnchor) return "silhouette";

  // Check if silhouette is complete (has bodice at minimum)
  if (!stages.has("silhouette")) return "silhouette";

  // If we have silhouette components but haven't moved to embellishment yet
  if (stages.has("finishing")) return "complete";
  if (stages.has("embellishment")) return "finishing";

  // Only silhouette components selected — ready for embellishment
  return "embellishment";
}

function getAllowedStages(phase: DesignPhase): ComponentDesignStage[] {
  switch (phase) {
    case "silhouette":
      return ["silhouette"];
    case "embellishment":
      return ["silhouette", "embellishment"];
    case "finishing":
      return ["silhouette", "embellishment", "finishing"];
    case "complete":
      return ["silhouette", "embellishment", "finishing"];
  }
}
