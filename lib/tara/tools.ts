import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  silhouetteTemplates,
  silhouetteComponents,
  silhouetteTags,
  tagValues,
  tagDimensions,
  components,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  getCompatibleComponents,
  getCompatibleFabrics,
} from "@/lib/compatibility";

// The compatibility engine expects plain PostgresJsDatabase; our db proxy
// carries the full schema generic. Cast once to avoid repeated casts.
const plainDb = db as unknown as PostgresJsDatabase;

// ---------------------------------------------------------------------------
// search_silhouettes
// ---------------------------------------------------------------------------

export const searchSilhouettes = tool({
  description:
    "Search silhouette templates by tag filters. Returns matching silhouettes " +
    "with their name, pattern ID, and tags. Use extracted tag values from the " +
    "user's description to find relevant designs.",
  inputSchema: z.object({
    coreSilhouette: z.string().optional().describe("Core silhouette slug (e.g. a-line, sheath)"),
    length: z.string().optional().describe("Length slug (e.g. midi, floor-length)"),
    waistPosition: z.string().optional().describe("Waist position slug"),
    shoulderConstruction: z.string().optional().describe("Shoulder construction slug"),
    sleeveType: z.array(z.string()).optional().describe("Sleeve type slugs"),
    necklineBack: z.array(z.string()).optional().describe("Neckline/back detail slugs"),
    detailFeatures: z.array(z.string()).optional().describe("Detail feature slugs"),
    aestheticMood: z.array(z.string()).optional().describe("Aesthetic mood slugs"),
    eraReferences: z.array(z.string()).optional().describe("Era reference slugs"),
    occasion: z.array(z.string()).optional().describe("Occasion slugs"),
    designerInspiration: z.array(z.string()).optional().describe("Designer inspiration slugs"),
  }),
  execute: async (input) => {
    // Collect all requested tag slugs
    const requestedSlugs: string[] = [];
    for (const [, value] of Object.entries(input)) {
      if (value === undefined) continue;
      if (typeof value === "string") requestedSlugs.push(value);
      if (Array.isArray(value)) requestedSlugs.push(...value);
    }

    // Fetch all silhouettes
    const allSilhouettes = await db
      .select({
        id: silhouetteTemplates.id,
        name: silhouetteTemplates.name,
        patternId: silhouetteTemplates.patternId,
      })
      .from(silhouetteTemplates);

    if (allSilhouettes.length === 0) return { silhouettes: [] };

    const silhouetteIds = allSilhouettes.map((s) => s.id);

    // Fetch tags for all silhouettes
    const tagAssignments = await db
      .select({
        silhouetteId: silhouetteTags.silhouetteId,
        tagSlug: tagValues.slug,
        tagLabel: tagValues.label,
        dimensionSlug: tagDimensions.slug,
        dimensionName: tagDimensions.name,
      })
      .from(silhouetteTags)
      .innerJoin(tagValues, eq(silhouetteTags.tagValueId, tagValues.id))
      .innerJoin(tagDimensions, eq(tagValues.dimensionId, tagDimensions.id))
      .where(inArray(silhouetteTags.silhouetteId, silhouetteIds));

    // Filter silhouettes that have ALL requested tags
    const matches = allSilhouettes.filter((sil) => {
      if (requestedSlugs.length === 0) return true;
      const silTags = tagAssignments
        .filter((t) => t.silhouetteId === sil.id)
        .map((t) => t.tagSlug);
      return requestedSlugs.every((slug) => silTags.includes(slug));
    });

    // Fetch components for matching silhouettes
    const matchIds = matches.map((m) => m.id);
    const compAssignments = matchIds.length > 0
      ? await db
          .select({
            silhouetteId: silhouetteComponents.silhouetteId,
            componentId: components.id,
            componentName: components.name,
            componentCode: components.code,
          })
          .from(silhouetteComponents)
          .innerJoin(components, eq(silhouetteComponents.componentId, components.id))
          .where(inArray(silhouetteComponents.silhouetteId, matchIds))
      : [];

    return {
      silhouettes: matches.map((sil) => ({
        id: sil.id,
        name: sil.name,
        patternId: sil.patternId,
        tags: tagAssignments
          .filter((t) => t.silhouetteId === sil.id)
          .map((t) => ({
            dimension: t.dimensionSlug,
            value: t.tagSlug,
            label: t.tagLabel,
          })),
        components: compAssignments
          .filter((c) => c.silhouetteId === sil.id)
          .map((c) => ({
            id: c.componentId,
            name: c.componentName,
            code: c.componentCode,
          })),
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// get_compatible_components
// ---------------------------------------------------------------------------

export const getCompatibleComponentsTool = tool({
  description:
    "Given currently selected component IDs, return all compatible components " +
    "that can be added to the design. Also returns the current design phase " +
    "(silhouette, embellishment, finishing, or complete).",
  inputSchema: z.object({
    selectedComponentIds: z.array(z.string()).describe(
      "UUIDs of currently selected components",
    ),
  }),
  execute: async ({ selectedComponentIds }) => {
    const result = await getCompatibleComponents(plainDb, selectedComponentIds);
    return {
      designPhase: result.designPhase,
      components: result.components.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        type: c.typeName,
        stage: c.stage,
      })),
      selectedComponents: result.selectedComponents.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        type: c.typeName,
        stage: c.stage,
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// get_compatible_fabrics
// ---------------------------------------------------------------------------

export const getCompatibleFabricsTool = tool({
  description:
    "Given currently selected component IDs, return fabric categories and " +
    "individual fabrics that are compatible with the selection. Requires at " +
    "least one first-leaf (bodice) component in the selection.",
  inputSchema: z.object({
    selectedComponentIds: z.array(z.string()).describe(
      "UUIDs of currently selected components",
    ),
  }),
  execute: async ({ selectedComponentIds }) => {
    const categories = await getCompatibleFabrics(plainDb, selectedComponentIds);
    return {
      categories: categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        skins: cat.skins.map((skin) => ({
          id: skin.id,
          name: skin.name,
          fabricCode: skin.fabricCode,
          priceMarkup: skin.priceMarkup,
        })),
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// All tools object for streamText
// ---------------------------------------------------------------------------

export const taraTools = {
  search_silhouettes: searchSilhouettes,
  get_compatible_components: getCompatibleComponentsTool,
  get_compatible_fabrics: getCompatibleFabricsTool,
};
