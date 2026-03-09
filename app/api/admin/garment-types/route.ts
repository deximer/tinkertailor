import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import { garmentTypes, garmentTypeParts, garmentParts } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { slugify } from "@/lib/utils/slugify";

const createSchema = z.object({
  name: z.string().min(1).max(100),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
});

const deleteBodySchema = z.object({
  id: z.string().uuid(),
});

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const types = await db
      .select({
        id: garmentTypes.id,
        name: garmentTypes.name,
        slug: garmentTypes.slug,
      })
      .from(garmentTypes)
      .orderBy(asc(garmentTypes.name));

    // Fetch associated parts for each garment type
    const mappings = await db
      .select({
        garmentTypeId: garmentTypeParts.garmentTypeId,
        garmentPartId: garmentTypeParts.garmentPartId,
        partName: garmentParts.name,
        partSlug: garmentParts.slug,
      })
      .from(garmentTypeParts)
      .innerJoin(garmentParts, eq(garmentTypeParts.garmentPartId, garmentParts.id));

    const result = types.map((t) => ({
      ...t,
      parts: mappings
        .filter((m) => m.garmentTypeId === t.id)
        .map((m) => ({
          id: m.garmentPartId,
          name: m.partName,
          slug: m.partSlug,
        })),
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("[admin/garment-types] DB error:", err);
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
      .insert(garmentTypes)
      .values({ name: body.name, slug })
      .returning({
        id: garmentTypes.id,
        name: garmentTypes.name,
        slug: garmentTypes.slug,
      });

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[admin/garment-types] DB error:", err);
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
    const slug = slugify(body.name);

    const [row] = await db
      .update(garmentTypes)
      .set({ name: body.name, slug })
      .where(eq(garmentTypes.id, body.id))
      .returning({
        id: garmentTypes.id,
        name: garmentTypes.name,
        slug: garmentTypes.slug,
      });

    if (!row) {
      return NextResponse.json(
        { error: "Garment type not found" },
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
    console.error("[admin/garment-types] DB error:", err);
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

    // garment_type_parts cascade on delete, so no referential integrity check needed
    const [row] = await db
      .delete(garmentTypes)
      .where(eq(garmentTypes.id, id))
      .returning({ id: garmentTypes.id });

    if (!row) {
      return NextResponse.json(
        { error: "Garment type not found" },
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
    console.error("[admin/garment-types] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
