import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import { fabricCategories, fabrics } from "@/lib/db/schema";
import { eq, count, asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { slugify } from "@/lib/utils/slugify";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const rows = await db
      .select({
        id: fabricCategories.id,
        name: fabricCategories.name,
        slug: fabricCategories.slug,
        parentId: fabricCategories.parentId,
        merchandisingOrder: fabricCategories.merchandisingOrder,
        hidden: fabricCategories.hidden,
        createdAt: fabricCategories.createdAt,
      })
      .from(fabricCategories)
      .orderBy(asc(fabricCategories.merchandisingOrder));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[admin/fabric-categories] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  parentId: z.string().uuid().nullable().optional(),
  merchandisingOrder: z.number().int().default(0),
  hidden: z.boolean().default(false),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  parentId: z.string().uuid().nullable().optional(),
  merchandisingOrder: z.number().int().optional(),
  hidden: z.boolean().optional(),
});

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = createSchema.parse(await request.json());
    const slug = slugify(body.name);

    if (body.parentId) {
      const [parent] = await db
        .select({ id: fabricCategories.id })
        .from(fabricCategories)
        .where(eq(fabricCategories.id, body.parentId))
        .limit(1);

      if (!parent) {
        return NextResponse.json(
          { error: "Parent category not found" },
          { status: 404 },
        );
      }
    }

    const [row] = await db
      .insert(fabricCategories)
      .values({
        name: body.name,
        slug,
        parentId: body.parentId ?? null,
        merchandisingOrder: body.merchandisingOrder,
        hidden: body.hidden,
      })
      .returning({
        id: fabricCategories.id,
        name: fabricCategories.name,
        slug: fabricCategories.slug,
        parentId: fabricCategories.parentId,
        merchandisingOrder: fabricCategories.merchandisingOrder,
        hidden: fabricCategories.hidden,
        createdAt: fabricCategories.createdAt,
      });

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[admin/fabric-categories] POST error:", err);
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

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) {
      updates.name = body.name;
      updates.slug = slugify(body.name);
    }
    if (body.parentId !== undefined) updates.parentId = body.parentId;
    if (body.merchandisingOrder !== undefined)
      updates.merchandisingOrder = body.merchandisingOrder;
    if (body.hidden !== undefined) updates.hidden = body.hidden;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    const [row] = await db
      .update(fabricCategories)
      .set(updates)
      .where(eq(fabricCategories.id, body.id))
      .returning({
        id: fabricCategories.id,
        name: fabricCategories.name,
        slug: fabricCategories.slug,
        parentId: fabricCategories.parentId,
        merchandisingOrder: fabricCategories.merchandisingOrder,
        hidden: fabricCategories.hidden,
        createdAt: fabricCategories.createdAt,
      });

    if (!row) {
      return NextResponse.json(
        { error: "Fabric category not found" },
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
    console.error("[admin/fabric-categories] PUT error:", err);
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

    const [linked] = await db
      .select({ value: count() })
      .from(fabrics)
      .where(eq(fabrics.categoryId, id));

    if (linked.value > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete category with linked fabrics",
          linkedCount: linked.value,
        },
        { status: 409 },
      );
    }

    const [row] = await db
      .delete(fabricCategories)
      .where(eq(fabricCategories.id, id))
      .returning({ id: fabricCategories.id });

    if (!row) {
      return NextResponse.json(
        { error: "Fabric category not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/fabric-categories] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
