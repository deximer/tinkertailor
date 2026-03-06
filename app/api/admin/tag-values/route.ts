import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import { tagValues, silhouetteTags } from "@/lib/db/schema";
import { eq, count, asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { slugify } from "@/lib/utils/slugify";

const createSchema = z.object({
  dimensionId: z.string().uuid(),
  label: z.string().min(1).max(200),
  displayOrder: z.number().int().default(0),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(200).optional(),
  displayOrder: z.number().int().optional(),
});

export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const dimensionId = searchParams.get("dimensionId");

    const query = db
      .select({
        id: tagValues.id,
        dimensionId: tagValues.dimensionId,
        label: tagValues.label,
        slug: tagValues.slug,
        displayOrder: tagValues.displayOrder,
        createdAt: tagValues.createdAt,
      })
      .from(tagValues);

    const rows = dimensionId
      ? await query
          .where(eq(tagValues.dimensionId, dimensionId))
          .orderBy(asc(tagValues.displayOrder))
      : await query.orderBy(asc(tagValues.displayOrder));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[admin/tag-values] GET error:", err);
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
    const slug = slugify(body.label);

    const [row] = await db
      .insert(tagValues)
      .values({
        dimensionId: body.dimensionId,
        label: body.label,
        slug,
        displayOrder: body.displayOrder,
      })
      .returning({
        id: tagValues.id,
        dimensionId: tagValues.dimensionId,
        label: tagValues.label,
        slug: tagValues.slug,
        displayOrder: tagValues.displayOrder,
        createdAt: tagValues.createdAt,
      });

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[admin/tag-values] POST error:", err);
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
    if (body.label !== undefined) {
      updates.label = body.label;
      updates.slug = slugify(body.label);
    }
    if (body.displayOrder !== undefined)
      updates.displayOrder = body.displayOrder;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    const [row] = await db
      .update(tagValues)
      .set(updates)
      .where(eq(tagValues.id, body.id))
      .returning({
        id: tagValues.id,
        dimensionId: tagValues.dimensionId,
        label: tagValues.label,
        slug: tagValues.slug,
        displayOrder: tagValues.displayOrder,
        createdAt: tagValues.createdAt,
      });

    if (!row) {
      return NextResponse.json(
        { error: "Tag value not found" },
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
    console.error("[admin/tag-values] PUT error:", err);
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
      .from(silhouetteTags)
      .where(eq(silhouetteTags.tagValueId, id));

    if (linked.value > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete tag value with linked silhouettes",
          silhouetteCount: linked.value,
        },
        { status: 409 },
      );
    }

    const [row] = await db
      .delete(tagValues)
      .where(eq(tagValues.id, id))
      .returning({ id: tagValues.id });

    if (!row) {
      return NextResponse.json(
        { error: "Tag value not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/tag-values] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
