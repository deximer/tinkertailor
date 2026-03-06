import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import {
  components,
  componentTypes,
  componentCompatibility,
} from "@/lib/db/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";

const edgeSchema = z.object({
  componentAId: z.string().uuid(),
  componentBId: z.string().uuid(),
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

    // Validate both component IDs exist
    const found = await db
      .select({ id: components.id })
      .from(components)
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

    // Store in canonical order (smaller UUID first) to prevent duplicates
    const [canonA, canonB] =
      body.componentAId < body.componentBId
        ? [body.componentAId, body.componentBId]
        : [body.componentBId, body.componentAId];

    // Check if edge already exists
    const [existing] = await db
      .select({
        componentAId: componentCompatibility.componentAId,
        componentBId: componentCompatibility.componentBId,
      })
      .from(componentCompatibility)
      .where(
        and(
          eq(componentCompatibility.componentAId, canonA),
          eq(componentCompatibility.componentBId, canonB),
        ),
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        {
          componentAId: existing.componentAId,
          componentBId: existing.componentBId,
        },
        { status: 200 },
      );
    }

    const [row] = await db
      .insert(componentCompatibility)
      .values({ componentAId: canonA, componentBId: canonB })
      .returning({
        componentAId: componentCompatibility.componentAId,
        componentBId: componentCompatibility.componentBId,
        createdAt: componentCompatibility.createdAt,
      });

    return NextResponse.json(row, { status: 201 });
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

    // Delete both directions (A,B) and (B,A) if they exist
    await db
      .delete(componentCompatibility)
      .where(
        or(
          and(
            eq(componentCompatibility.componentAId, body.componentAId),
            eq(componentCompatibility.componentBId, body.componentBId),
          ),
          and(
            eq(componentCompatibility.componentAId, body.componentBId),
            eq(componentCompatibility.componentBId, body.componentAId),
          ),
        ),
      );

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

    // Resolve type slugs to IDs
    const [typeARows, typeBRows] = await Promise.all([
      db
        .select({ id: componentTypes.id })
        .from(componentTypes)
        .where(eq(componentTypes.slug, typeASlug))
        .limit(1),
      db
        .select({ id: componentTypes.id })
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

    const typeAId = typeARows[0].id;
    const typeBId = typeBRows[0].id;

    // Fetch components for each type
    const [rowComponents, colComponents] = await Promise.all([
      db
        .select({
          id: components.id,
          name: components.name,
          code: components.code,
        })
        .from(components)
        .where(eq(components.componentTypeId, typeAId))
        .orderBy(components.name),
      db
        .select({
          id: components.id,
          name: components.name,
          code: components.code,
        })
        .from(components)
        .where(eq(components.componentTypeId, typeBId))
        .orderBy(components.name),
    ]);

    const rowIds = rowComponents.map((c) => c.id);
    const colIds = colComponents.map((c) => c.id);

    // Fetch edges between the two groups (both directions)
    let edges: string[] = [];

    if (rowIds.length > 0 && colIds.length > 0) {
      const edgeRows = await db
        .select({
          componentAId: componentCompatibility.componentAId,
          componentBId: componentCompatibility.componentBId,
        })
        .from(componentCompatibility)
        .where(
          or(
            // A in rows, B in cols
            and(
              inArray(componentCompatibility.componentAId, rowIds),
              inArray(componentCompatibility.componentBId, colIds),
            ),
            // A in cols, B in rows
            and(
              inArray(componentCompatibility.componentAId, colIds),
              inArray(componentCompatibility.componentBId, rowIds),
            ),
          ),
        );

      const rowIdSet = new Set(rowIds);
      const colIdSet = new Set(colIds);

      edges = edgeRows.map((e) => {
        // Normalize to rowId:colId format
        if (rowIdSet.has(e.componentAId) && colIdSet.has(e.componentBId)) {
          return `${e.componentAId}:${e.componentBId}`;
        }
        // Reverse direction: A is col, B is row
        return `${e.componentBId}:${e.componentAId}`;
      });
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
