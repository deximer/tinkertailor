import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import { categories, componentTypes } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
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

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = createSchema.parse(await request.json());
    const slug = slugify(body.name);

    const [row] = await db
      .insert(categories)
      .values({ name: body.name, slug })
      .returning({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
      });

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[admin/categories] DB error:", err);
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
      .update(categories)
      .set({ name: body.name, slug })
      .where(eq(categories.id, body.id))
      .returning({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
      });

    if (!row) {
      return NextResponse.json(
        { error: "Category not found" },
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
    console.error("[admin/categories] DB error:", err);
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
      .where(eq(componentTypes.categoryId, id));

    if (linked.value > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete category with linked component types",
          linkedCount: linked.value,
        },
        { status: 409 },
      );
    }

    const [row] = await db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning({ id: categories.id });

    if (!row) {
      return NextResponse.json(
        { error: "Category not found" },
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
    console.error("[admin/categories] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
