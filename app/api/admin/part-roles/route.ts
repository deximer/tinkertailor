import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import { partRoles, garmentParts } from "@/lib/db/schema";
import { eq, count, asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { slugify } from "@/lib/utils/slugify";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
});

const deleteBodySchema = z.object({
  id: z.string().uuid(),
});

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const rows = await db
      .select({
        id: partRoles.id,
        name: partRoles.name,
        slug: partRoles.slug,
        sortOrder: partRoles.sortOrder,
      })
      .from(partRoles)
      .orderBy(asc(partRoles.sortOrder));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[admin/part-roles] DB error:", err);
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
      .insert(partRoles)
      .values({
        name: body.name,
        slug,
        sortOrder: body.sortOrder ?? 0,
      })
      .returning({
        id: partRoles.id,
        name: partRoles.name,
        slug: partRoles.slug,
        sortOrder: partRoles.sortOrder,
      });

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[admin/part-roles] DB error:", err);
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
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    const [row] = await db
      .update(partRoles)
      .set(updates)
      .where(eq(partRoles.id, body.id))
      .returning({
        id: partRoles.id,
        name: partRoles.name,
        slug: partRoles.slug,
        sortOrder: partRoles.sortOrder,
      });

    if (!row) {
      return NextResponse.json(
        { error: "Part role not found" },
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
    console.error("[admin/part-roles] DB error:", err);
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
    let id = searchParams.get("id");

    if (!id) {
      const body = deleteBodySchema.parse(await request.json());
      id = body.id;
    }

    const [linked] = await db
      .select({ value: count() })
      .from(garmentParts)
      .where(eq(garmentParts.partRoleId, id));

    if (linked.value > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete part role with linked garment parts",
          linkedCount: linked.value,
        },
        { status: 409 },
      );
    }

    const [row] = await db
      .delete(partRoles)
      .where(eq(partRoles.id, id))
      .returning({ id: partRoles.id });

    if (!row) {
      return NextResponse.json(
        { error: "Part role not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[admin/part-roles] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
