/**
 * Compatibility engine — the core business logic for enforcing component
 * and fabric compatibility rules.
 *
 * Used by both Atelier (real-time filtering) and TARA (validation).
 *
 * Key rules (from legacy app):
 * 1. If a component's garment part has is_anchor=true, selecting it clears all
 *    other selected components.
 * 2. Otherwise, selecting a component deselects only other components of the
 *    same type.
 * 3. Stage sequencing: structural (silhouette) must complete before decorative
 *    (embellishment), decorative before finishing.
 * 4. Fabric filtering: intersect compatible_skin_categories across selected
 *    components; show only fabrics from the anchor component's categories.
 */

import { eq, and, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  components,
  componentTypes,
  garmentParts,
  partRoles,
  bodiceSkirtCompatibility,
  bodiceSleeveCompatibility,
  fabricCategories,
  fabrics,
  componentFabricRules,
} from "../db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DesignPhase = "silhouette" | "embellishment" | "finishing" | "complete";

export interface ComponentWithType {
  id: string;
  name: string;
  assetCode: string;
  componentTypeId: string;
  typeName: string;
  typeSlug: string;
  partRoleSlug: string | null;
  isAnchor: boolean | null;
  garmentPartSlug: string | null;
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

// Part role slugs map to legacy design stages:
// structural → silhouette, decorative → embellishment, finishing → finishing
const ROLE_TO_STAGE: Record<string, DesignPhase> = {
  structural: "silhouette",
  decorative: "embellishment",
  finishing: "finishing",
};

// ---------------------------------------------------------------------------
// Shared query helper — selects component + type + garmentPart + partRole
// ---------------------------------------------------------------------------

const componentWithTypeSelect = {
  id: components.id,
  name: components.name,
  assetCode: components.assetCode,
  componentTypeId: components.componentTypeId,
  typeName: componentTypes.name,
  typeSlug: componentTypes.slug,
  partRoleSlug: partRoles.slug,
  isAnchor: garmentParts.isAnchor,
  garmentPartSlug: garmentParts.slug,
};

function componentWithTypeFrom(db: PostgresJsDatabase) {
  return db
    .select(componentWithTypeSelect)
    .from(components)
    .innerJoin(componentTypes, eq(components.componentTypeId, componentTypes.id))
    .leftJoin(garmentParts, eq(componentTypes.garmentPartId, garmentParts.id))
    .leftJoin(partRoles, eq(garmentParts.partRoleId, partRoles.id));
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
      isAnchor: garmentParts.isAnchor,
    })
    .from(components)
    .innerJoin(componentTypes, eq(components.componentTypeId, componentTypes.id))
    .leftJoin(garmentParts, eq(componentTypes.garmentPartId, garmentParts.id))
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
    selectedComps = await componentWithTypeFrom(db)
      .where(inArray(components.id, selectedComponentIds));
  }

  // Determine current design phase
  const designPhase = determineDesignPhase(selectedComps);

  // If no selection, return all components in allowed roles
  if (selectedComponentIds.length === 0) {
    const allowedRoles = getAllowedRoles(designPhase);
    const allComps = await componentWithTypeFrom(db)
      .where(inArray(partRoles.slug, allowedRoles));

    return {
      designPhase,
      components: allComps,
      selectedComponents: [],
    };
  }

  // Find components compatible with ALL selected components.
  //
  // The compatibility graph is star-shaped around bodice:
  //   bodice ↔ skirt  (bodice_skirt_compatibility)
  //   bodice ↔ sleeve (bodice_sleeve_compatibility)
  //   No direct skirt ↔ sleeve relationship.
  //
  // Complete-silhouette parts (dress-silhouette, top-silhouette, etc.) are
  // structural anchors that do NOT participate in the graph — selecting one
  // skips straight to embellishment without showing bodice/skirt/sleeve tabs.
  //
  // We collect constraints per garment-part type and intersect within each
  // type, so a skirt selection only constrains bodice choices, not sleeves.
  const bodiceConstraints: Set<string>[] = [];
  const skirtConstraints: Set<string>[] = [];
  const sleeveConstraints: Set<string>[] = [];
  let hasGraphParticipant = false;

  for (const selId of selectedComponentIds) {
    const selComp = selectedComps.find((c) => c.id === selId);
    const gpSlug = selComp?.garmentPartSlug ?? null;

    // Non-graph components (embellishment, finishing, complete-silhouette) skip
    if (!gpSlug || !["bodice", "skirt", "sleeve"].includes(gpSlug)) {
      continue;
    }

    hasGraphParticipant = true;

    if (gpSlug === "bodice") {
      // Bodice constrains which skirts and sleeves are valid
      const [skirtEdges, sleeveEdges] = await Promise.all([
        db
          .select({ compatId: bodiceSkirtCompatibility.skirtId })
          .from(bodiceSkirtCompatibility)
          .where(eq(bodiceSkirtCompatibility.bodiceId, selId)),
        db
          .select({ compatId: bodiceSleeveCompatibility.sleeveId })
          .from(bodiceSleeveCompatibility)
          .where(eq(bodiceSleeveCompatibility.bodiceId, selId)),
      ]);
      skirtConstraints.push(new Set(skirtEdges.map((e) => e.compatId)));
      sleeveConstraints.push(new Set(sleeveEdges.map((e) => e.compatId)));
    } else if (gpSlug === "skirt") {
      // Skirt constrains which bodices are valid
      const edges = await db
        .select({ compatId: bodiceSkirtCompatibility.bodiceId })
        .from(bodiceSkirtCompatibility)
        .where(eq(bodiceSkirtCompatibility.skirtId, selId));
      bodiceConstraints.push(new Set(edges.map((e) => e.compatId)));
    } else if (gpSlug === "sleeve") {
      // Sleeve constrains which bodices are valid
      const edges = await db
        .select({ compatId: bodiceSleeveCompatibility.bodiceId })
        .from(bodiceSleeveCompatibility)
        .where(eq(bodiceSleeveCompatibility.sleeveId, selId));
      bodiceConstraints.push(new Set(edges.map((e) => e.compatId)));
    }
  }

  // Compute allowed roles contextually:
  // Complete-silhouette anchors (no graph participants) exclude "structural"
  // so users see only decorative/finishing — not bodice/skirt/sleeve tabs.
  const hasAnchor = selectedComps.some((c) => c.isAnchor === true);
  const baseRoles = getAllowedRoles(designPhase);
  const allowedRoles = (hasAnchor && !hasGraphParticipant)
    ? baseRoles.filter((r) => r !== "structural")
    : baseRoles;

  // Complete-silhouette path: no graph constraints, return all phase-appropriate components
  if (!hasGraphParticipant) {
    const allInPhase = await componentWithTypeFrom(db)
      .where(inArray(partRoles.slug, allowedRoles));

    const selectedIdSet = new Set(selectedComponentIds);
    const available = allInPhase.filter((c) => !selectedIdSet.has(c.id));

    return {
      designPhase,
      components: available,
      selectedComponents: selectedComps,
    };
  }

  // Intersect constraint sets within each garment-part type
  function intersectSets(sets: Set<string>[]): Set<string> | null {
    if (sets.length === 0) return null;
    let result = sets[0];
    for (let i = 1; i < sets.length; i++) {
      result = new Set([...result].filter((id) => sets[i].has(id)));
    }
    return result;
  }

  const validBodices = intersectSets(bodiceConstraints);
  const validSkirts = intersectSets(skirtConstraints);
  const validSleeves = intersectSets(sleeveConstraints);

  // Combine all valid IDs + selected components
  const resultIds = new Set<string>();
  if (validBodices) for (const id of validBodices) resultIds.add(id);
  if (validSkirts) for (const id of validSkirts) resultIds.add(id);
  if (validSleeves) for (const id of validSleeves) resultIds.add(id);
  for (const id of selectedComponentIds) resultIds.add(id);

  if (resultIds.size === 0) {
    return { designPhase, components: [], selectedComponents: selectedComps };
  }

  // Fetch full component data, filtered by allowed roles
  const compatComps = await componentWithTypeFrom(db)
    .where(
      and(
        inArray(components.id, [...resultIds]),
        inArray(partRoles.slug, allowedRoles),
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
      isAnchor: garmentParts.isAnchor,
    })
    .from(components)
    .innerJoin(componentTypes, eq(components.componentTypeId, componentTypes.id))
    .leftJoin(garmentParts, eq(componentTypes.garmentPartId, garmentParts.id))
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

  const stages = new Set(
    selectedComps
      .map((c) => c.partRoleSlug ? ROLE_TO_STAGE[c.partRoleSlug] : null)
      .filter(Boolean),
  );
  const hasAnchor = selectedComps.some((c) => c.isAnchor === true);

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

function getAllowedRoles(phase: DesignPhase): string[] {
  switch (phase) {
    case "silhouette":
      return ["structural"];
    case "embellishment":
      return ["structural", "decorative"];
    case "finishing":
      return ["structural", "decorative", "finishing"];
    case "complete":
      return ["structural", "decorative", "finishing"];
  }
}
