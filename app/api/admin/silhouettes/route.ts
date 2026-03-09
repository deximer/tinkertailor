import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import {
  silhouetteTemplates,
  silhouetteComponents,
  silhouetteTags,
  products,
} from "@/lib/db/schema";
import { eq, count, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  patternId: z.string().min(1).max(50),
  categoryId: z.string().uuid(),
  basePrice: z.string().default("0"),
  description: z.string().max(2000).nullable().optional(),
  isComposable: z.boolean().optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  patternId: z.string().min(1).max(50).optional(),
  categoryId: z.string().uuid().optional(),
  basePrice: z.string().optional(),
  description: z.string().max(2000).nullable().optional(),
  isComposable: z.boolean().optional(),
});

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const rows = await db
      .select({
        id: silhouetteTemplates.id,
        name: silhouetteTemplates.name,
        patternId: silhouetteTemplates.patternId,
        categoryId: silhouetteTemplates.categoryId,
        basePrice: silhouetteTemplates.basePrice,
        description: silhouetteTemplates.description,
        isComposable: silhouetteTemplates.isComposable,
        createdAt: silhouetteTemplates.createdAt,
        componentCount: sql<number>`(select count(*) from ${silhouetteComponents} where ${silhouetteComponents.silhouetteId} = ${silhouetteTemplates.id})::int`,
        tagCount: sql<number>`(select count(*) from ${silhouetteTags} where ${silhouetteTags.silhouetteId} = ${silhouetteTemplates.id})::int`,
      })
      .from(silhouetteTemplates)
      .orderBy(silhouetteTemplates.name);

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[admin/silhouettes] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = createSchema.parse(await request.json());

    const [existing] = await db
      .select({ id: silhouetteTemplates.id })
      .from(silhouetteTemplates)
      .where(eq(silhouetteTemplates.patternId, body.patternId))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "Pattern ID already exists", patternId: body.patternId },
        { status: 409 },
      );
    }

    const [row] = await db
      .insert(silhouetteTemplates)
      .values({
        name: body.name,
        patternId: body.patternId,
        categoryId: body.categoryId,
        basePrice: body.basePrice,
        description: body.description ?? null,
        isComposable: body.isComposable ?? false,
      })
      .returning({
        id: silhouetteTemplates.id,
        name: silhouetteTemplates.name,
        patternId: silhouetteTemplates.patternId,
        categoryId: silhouetteTemplates.categoryId,
        basePrice: silhouetteTemplates.basePrice,
        description: silhouetteTemplates.description,
        isComposable: silhouetteTemplates.isComposable,
        createdAt: silhouetteTemplates.createdAt,
      });

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[admin/silhouettes] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = updateSchema.parse(await request.json());

    if (body.patternId !== undefined) {
      const [existing] = await db
        .select({ id: silhouetteTemplates.id })
        .from(silhouetteTemplates)
        .where(eq(silhouetteTemplates.patternId, body.patternId))
        .limit(1);

      if (existing && existing.id !== body.id) {
        return NextResponse.json(
          { error: "Pattern ID already exists", patternId: body.patternId },
          { status: 409 },
        );
      }
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.patternId !== undefined) updates.patternId = body.patternId;
    if (body.categoryId !== undefined) updates.categoryId = body.categoryId;
    if (body.basePrice !== undefined) updates.basePrice = body.basePrice;
    if (body.description !== undefined) updates.description = body.description;
    if (body.isComposable !== undefined) updates.isComposable = body.isComposable;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    const [row] = await db
      .update(silhouetteTemplates)
      .set(updates)
      .where(eq(silhouetteTemplates.id, body.id))
      .returning({
        id: silhouetteTemplates.id,
        name: silhouetteTemplates.name,
        patternId: silhouetteTemplates.patternId,
        categoryId: silhouetteTemplates.categoryId,
        basePrice: silhouetteTemplates.basePrice,
        description: silhouetteTemplates.description,
        isComposable: silhouetteTemplates.isComposable,
        createdAt: silhouetteTemplates.createdAt,
      });

    if (!row) {
      return NextResponse.json(
        { error: "Silhouette not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(row);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[admin/silhouettes] PUT error:", err);
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id query param required" },
        { status: 400 },
      );
    }

    // Check if any products reference this silhouette
    const [inUse] = await db
      .select({ value: count() })
      .from(products)
      .where(eq(products.silhouetteTemplateId, id));

    if (inUse.value > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete silhouette referenced by existing products",
          productCount: inUse.value,
        },
        { status: 409 },
      );
    }

    // Cascade-delete silhouette component assignments
    await db
      .delete(silhouetteComponents)
      .where(eq(silhouetteComponents.silhouetteId, id));

    // Cascade-delete silhouette tag assignments
    await db
      .delete(silhouetteTags)
      .where(eq(silhouetteTags.silhouetteId, id));

    // Delete the silhouette itself
    const [row] = await db
      .delete(silhouetteTemplates)
      .where(eq(silhouetteTemplates.id, id))
      .returning({ id: silhouetteTemplates.id });

    if (!row) {
      return NextResponse.json(
        { error: "Silhouette not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/silhouettes] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
