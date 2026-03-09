import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import { garmentParts, partRoles, componentTypes } from "@/lib/db/schema";
import { eq, count, asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { slugify } from "@/lib/utils/slugify";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  partRoleId: z.string().uuid(),
  isAnchor: z.boolean(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  partRoleId: z.string().uuid().optional(),
  isAnchor: z.boolean().optional(),
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
        id: garmentParts.id,
        name: garmentParts.name,
        slug: garmentParts.slug,
        partRoleId: garmentParts.partRoleId,
        partRoleName: partRoles.name,
        partRoleSlug: partRoles.slug,
        isAnchor: garmentParts.isAnchor,
      })
      .from(garmentParts)
      .innerJoin(partRoles, eq(garmentParts.partRoleId, partRoles.id))
      .orderBy(asc(partRoles.sortOrder), asc(garmentParts.name));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[admin/garment-parts] DB error:", err);
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
      .insert(garmentParts)
      .values({
        name: body.name,
        slug,
        partRoleId: body.partRoleId,
        isAnchor: body.isAnchor,
      })
      .returning({
        id: garmentParts.id,
        name: garmentParts.name,
        slug: garmentParts.slug,
        partRoleId: garmentParts.partRoleId,
        isAnchor: garmentParts.isAnchor,
      });

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[admin/garment-parts] DB error:", err);
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
    if (body.partRoleId !== undefined) updates.partRoleId = body.partRoleId;
    if (body.isAnchor !== undefined) updates.isAnchor = body.isAnchor;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    const [row] = await db
      .update(garmentParts)
      .set(updates)
      .where(eq(garmentParts.id, body.id))
      .returning({
        id: garmentParts.id,
        name: garmentParts.name,
        slug: garmentParts.slug,
        partRoleId: garmentParts.partRoleId,
        isAnchor: garmentParts.isAnchor,
      });

    if (!row) {
      return NextResponse.json(
        { error: "Garment part not found" },
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
    console.error("[admin/garment-parts] DB error:", err);
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
      .from(componentTypes)
      .where(eq(componentTypes.garmentPartId, id));

    if (linked.value > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete garment part with linked component types",
          linkedCount: linked.value,
        },
        { status: 409 },
      );
    }

    const [row] = await db
      .delete(garmentParts)
      .where(eq(garmentParts.id, id))
      .returning({ id: garmentParts.id });

    if (!row) {
      return NextResponse.json(
        { error: "Garment part not found" },
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
    console.error("[admin/garment-parts] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
