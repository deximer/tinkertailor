import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import { tagDimensions, tagValues } from "@/lib/db/schema";
import { eq, count, asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { slugify } from "@/lib/utils/slugify";

const selectionTypeEnum = z.enum(["single", "multi"]);

const createSchema = z.object({
  name: z.string().min(1).max(200),
  selectionType: selectionTypeEnum,
  displayOrder: z.number().int().default(0),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  selectionType: selectionTypeEnum.optional(),
  displayOrder: z.number().int().optional(),
});

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const rows = await db
      .select({
        id: tagDimensions.id,
        name: tagDimensions.name,
        slug: tagDimensions.slug,
        selectionType: tagDimensions.selectionType,
        displayOrder: tagDimensions.displayOrder,
        createdAt: tagDimensions.createdAt,
      })
      .from(tagDimensions)
      .orderBy(asc(tagDimensions.displayOrder));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[admin/tag-dimensions] GET error:", err);
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
    const slug = slugify(body.name);

    const [row] = await db
      .insert(tagDimensions)
      .values({
        name: body.name,
        slug,
        selectionType: body.selectionType,
        displayOrder: body.displayOrder,
      })
      .returning({
        id: tagDimensions.id,
        name: tagDimensions.name,
        slug: tagDimensions.slug,
        selectionType: tagDimensions.selectionType,
        displayOrder: tagDimensions.displayOrder,
        createdAt: tagDimensions.createdAt,
      });

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[admin/tag-dimensions] POST error:", err);
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
    if (body.selectionType !== undefined)
      updates.selectionType = body.selectionType;
    if (body.displayOrder !== undefined)
      updates.displayOrder = body.displayOrder;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    const [row] = await db
      .update(tagDimensions)
      .set(updates)
      .where(eq(tagDimensions.id, body.id))
      .returning({
        id: tagDimensions.id,
        name: tagDimensions.name,
        slug: tagDimensions.slug,
        selectionType: tagDimensions.selectionType,
        displayOrder: tagDimensions.displayOrder,
        createdAt: tagDimensions.createdAt,
      });

    if (!row) {
      return NextResponse.json(
        { error: "Tag dimension not found" },
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
    console.error("[admin/tag-dimensions] PUT error:", err);
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
      .from(tagValues)
      .where(eq(tagValues.dimensionId, id));

    if (linked.value > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete dimension with existing tag values",
          valueCount: linked.value,
        },
        { status: 409 },
      );
    }

    const [row] = await db
      .delete(tagDimensions)
      .where(eq(tagDimensions.id, id))
      .returning({ id: tagDimensions.id });

    if (!row) {
      return NextResponse.json(
        { error: "Tag dimension not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/tag-dimensions] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
