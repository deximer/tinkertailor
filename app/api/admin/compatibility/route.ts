import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import {
  components,
  componentTypes,
  bodiceSkirtCompatibility,
  bodiceSleeveCompatibility,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";

type EdgeType = "bodice_skirt" | "bodice_sleeve";

function resolveEdgeType(
  partA: string | null,
  partB: string | null,
): EdgeType | null {
  const parts = new Set([partA, partB]);
  if (parts.has("bodice") && parts.has("skirt")) return "bodice_skirt";
  if (parts.has("bodice") && parts.has("sleeve")) return "bodice_sleeve";
  return null;
}

const edgeSchema = z.object({
  componentAId: z.string().uuid(),
  componentBId: z.string().uuid(),
  sleeveStyleCode: z.enum(["ST", "DS", "OS"]).nullable().optional(),
});

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = edgeSchema.parse(await request.json());

    if (body.componentAId === body.componentBId) {
      return NextResponse.json(
        { error: "A component cannot be compatible with itself" },
        { status: 400 },
      );
    }

    // Fetch both components with their garment parts
    const found = await db
      .select({
        id: components.id,
        garmentPart: componentTypes.garmentPart,
      })
      .from(components)
      .innerJoin(componentTypes, eq(components.componentTypeId, componentTypes.id))
      .where(inArray(components.id, [body.componentAId, body.componentBId]));

    if (found.length < 2) {
      const foundIds = new Set(found.map((r) => r.id));
      const missing = [body.componentAId, body.componentBId].filter(
        (id) => !foundIds.has(id),
      );
      return NextResponse.json(
        { error: "Component not found", missingIds: missing },
        { status: 404 },
      );
    }

    const compA = found.find((r) => r.id === body.componentAId)!;
    const compB = found.find((r) => r.id === body.componentBId)!;
    const edgeType = resolveEdgeType(compA.garmentPart, compB.garmentPart);

    if (!edgeType) {
      return NextResponse.json(
        { error: "No compatibility table exists for this component type pair" },
        { status: 400 },
      );
    }

    if (edgeType === "bodice_skirt") {
      const bodiceId = compA.garmentPart === "bodice" ? compA.id : compB.id;
      const skirtId = compA.garmentPart === "skirt" ? compA.id : compB.id;

      const [existing] = await db
        .select({ bodiceId: bodiceSkirtCompatibility.bodiceId })
        .from(bodiceSkirtCompatibility)
        .where(
          and(
            eq(bodiceSkirtCompatibility.bodiceId, bodiceId),
            eq(bodiceSkirtCompatibility.skirtId, skirtId),
          ),
        )
        .limit(1);

      if (existing) {
        return NextResponse.json({ bodiceId, skirtId }, { status: 200 });
      }

      const [row] = await db
        .insert(bodiceSkirtCompatibility)
        .values({ bodiceId, skirtId })
        .returning({
          bodiceId: bodiceSkirtCompatibility.bodiceId,
          skirtId: bodiceSkirtCompatibility.skirtId,
          createdAt: bodiceSkirtCompatibility.createdAt,
        });

      return NextResponse.json(row, { status: 201 });
    } else {
      // bodice_sleeve
      const bodiceId = compA.garmentPart === "bodice" ? compA.id : compB.id;
      const sleeveId = compA.garmentPart === "sleeve" ? compA.id : compB.id;
      const sleeveStyleCode = body.sleeveStyleCode ?? null;

      const [existing] = await db
        .select({ bodiceId: bodiceSleeveCompatibility.bodiceId })
        .from(bodiceSleeveCompatibility)
        .where(
          and(
            eq(bodiceSleeveCompatibility.bodiceId, bodiceId),
            eq(bodiceSleeveCompatibility.sleeveId, sleeveId),
          ),
        )
        .limit(1);

      if (existing) {
        return NextResponse.json({ bodiceId, sleeveId }, { status: 200 });
      }

      const [row] = await db
        .insert(bodiceSleeveCompatibility)
        .values({ bodiceId, sleeveId, sleeveStyleCode })
        .returning({
          bodiceId: bodiceSleeveCompatibility.bodiceId,
          sleeveId: bodiceSleeveCompatibility.sleeveId,
          sleeveStyleCode: bodiceSleeveCompatibility.sleeveStyleCode,
          createdAt: bodiceSleeveCompatibility.createdAt,
        });

      return NextResponse.json(row, { status: 201 });
    }
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[admin/compatibility] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = edgeSchema.parse(await request.json());

    // Fetch both components with garment parts
    const found = await db
      .select({
        id: components.id,
        garmentPart: componentTypes.garmentPart,
      })
      .from(components)
      .innerJoin(componentTypes, eq(components.componentTypeId, componentTypes.id))
      .where(inArray(components.id, [body.componentAId, body.componentBId]));

    const compA = found.find((r) => r.id === body.componentAId);
    const compB = found.find((r) => r.id === body.componentBId);

    if (compA && compB) {
      const edgeType = resolveEdgeType(compA.garmentPart, compB.garmentPart);

      if (edgeType === "bodice_skirt") {
        const bodiceId = compA.garmentPart === "bodice" ? compA.id : compB.id;
        const skirtId = compA.garmentPart === "skirt" ? compA.id : compB.id;
        await db
          .delete(bodiceSkirtCompatibility)
          .where(
            and(
              eq(bodiceSkirtCompatibility.bodiceId, bodiceId),
              eq(bodiceSkirtCompatibility.skirtId, skirtId),
            ),
          );
      } else if (edgeType === "bodice_sleeve") {
        const bodiceId = compA.garmentPart === "bodice" ? compA.id : compB.id;
        const sleeveId = compA.garmentPart === "sleeve" ? compA.id : compB.id;
        await db
          .delete(bodiceSleeveCompatibility)
          .where(
            and(
              eq(bodiceSleeveCompatibility.bodiceId, bodiceId),
              eq(bodiceSleeveCompatibility.sleeveId, sleeveId),
            ),
          );
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[admin/compatibility] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const typeASlug = searchParams.get("typeA");
    const typeBSlug = searchParams.get("typeB");

    if (!typeASlug || !typeBSlug) {
      return NextResponse.json(
        { error: "typeA and typeB query params required" },
        { status: 400 },
      );
    }

    // Resolve type slugs to IDs and garment parts
    const [typeARows, typeBRows] = await Promise.all([
      db
        .select({ id: componentTypes.id, garmentPart: componentTypes.garmentPart })
        .from(componentTypes)
        .where(eq(componentTypes.slug, typeASlug))
        .limit(1),
      db
        .select({ id: componentTypes.id, garmentPart: componentTypes.garmentPart })
        .from(componentTypes)
        .where(eq(componentTypes.slug, typeBSlug))
        .limit(1),
    ]);

    if (typeARows.length === 0) {
      return NextResponse.json(
        { error: `Component type not found: ${typeASlug}` },
        { status: 404 },
      );
    }
    if (typeBRows.length === 0) {
      return NextResponse.json(
        { error: `Component type not found: ${typeBSlug}` },
        { status: 404 },
      );
    }

    const typeA = typeARows[0];
    const typeB = typeBRows[0];
    const edgeType = resolveEdgeType(typeA.garmentPart, typeB.garmentPart);

    if (!edgeType) {
      return NextResponse.json(
        { error: "No compatibility table exists for this component type pair" },
        { status: 400 },
      );
    }

    // Fetch components for each type
    const [rowComponents, colComponents] = await Promise.all([
      db
        .select({
          id: components.id,
          name: components.name,
          assetCode: components.assetCode,
        })
        .from(components)
        .where(eq(components.componentTypeId, typeA.id))
        .orderBy(components.name),
      db
        .select({
          id: components.id,
          name: components.name,
          assetCode: components.assetCode,
        })
        .from(components)
        .where(eq(components.componentTypeId, typeB.id))
        .orderBy(components.name),
    ]);

    const rowIds = rowComponents.map((c) => c.id);
    const colIds = colComponents.map((c) => c.id);

    let edges: string[] = [];

    if (rowIds.length > 0 && colIds.length > 0) {
      const rowIsBodice = typeA.garmentPart === "bodice";

      if (edgeType === "bodice_skirt") {
        const bodiceIds = rowIsBodice ? rowIds : colIds;
        const skirtIds = rowIsBodice ? colIds : rowIds;

        const edgeRows = await db
          .select({
            bodiceId: bodiceSkirtCompatibility.bodiceId,
            skirtId: bodiceSkirtCompatibility.skirtId,
          })
          .from(bodiceSkirtCompatibility)
          .where(
            and(
              inArray(bodiceSkirtCompatibility.bodiceId, bodiceIds),
              inArray(bodiceSkirtCompatibility.skirtId, skirtIds),
            ),
          );

        edges = edgeRows.map((e) =>
          rowIsBodice
            ? `${e.bodiceId}:${e.skirtId}`
            : `${e.skirtId}:${e.bodiceId}`,
        );
      } else {
        // bodice_sleeve
        const bodiceIds = rowIsBodice ? rowIds : colIds;
        const sleeveIds = rowIsBodice ? colIds : rowIds;

        const edgeRows = await db
          .select({
            bodiceId: bodiceSleeveCompatibility.bodiceId,
            sleeveId: bodiceSleeveCompatibility.sleeveId,
          })
          .from(bodiceSleeveCompatibility)
          .where(
            and(
              inArray(bodiceSleeveCompatibility.bodiceId, bodiceIds),
              inArray(bodiceSleeveCompatibility.sleeveId, sleeveIds),
            ),
          );

        edges = edgeRows.map((e) =>
          rowIsBodice
            ? `${e.bodiceId}:${e.sleeveId}`
            : `${e.sleeveId}:${e.bodiceId}`,
        );
      }
    }

    return NextResponse.json({
      rows: rowComponents,
      cols: colComponents,
      edges,
    });
  } catch (err) {
    console.error("[admin/compatibility] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
