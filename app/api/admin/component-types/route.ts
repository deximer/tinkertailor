import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import { componentTypes, components } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { slugify } from "@/lib/utils/slugify";

const stageEnum = z.enum(["silhouette", "embellishment", "finishing"]);
const garmentPartZodEnum = z.enum(["bodice", "skirt", "sleeve", "embellishment", "finishing"]);

const createSchema = z.object({
  name: z.string().min(1).max(100),
  categoryId: z.string().uuid(),
  stage: stageEnum,
  isFirstLeaf: z.boolean(),
  garmentPart: garmentPartZodEnum.nullable().optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  categoryId: z.string().uuid().optional(),
  stage: stageEnum.optional(),
  isFirstLeaf: z.boolean().optional(),
  garmentPart: garmentPartZodEnum.nullable().optional(),
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
      .insert(componentTypes)
      .values({
        name: body.name,
        slug,
        categoryId: body.categoryId,
        stage: body.stage,
        isFirstLeaf: body.isFirstLeaf,
        garmentPart: body.garmentPart ?? null,
      })
      .returning({
        id: componentTypes.id,
        name: componentTypes.name,
        slug: componentTypes.slug,
        categoryId: componentTypes.categoryId,
        stage: componentTypes.stage,
        isFirstLeaf: componentTypes.isFirstLeaf,
        garmentPart: componentTypes.garmentPart,
      });

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[admin/component-types] DB error:", err);
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
    if (body.categoryId !== undefined) updates.categoryId = body.categoryId;
    if (body.stage !== undefined) updates.stage = body.stage;
    if (body.isFirstLeaf !== undefined) updates.isFirstLeaf = body.isFirstLeaf;
    if (body.garmentPart !== undefined) updates.garmentPart = body.garmentPart;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    const [row] = await db
      .update(componentTypes)
      .set(updates)
      .where(eq(componentTypes.id, body.id))
      .returning({
        id: componentTypes.id,
        name: componentTypes.name,
        slug: componentTypes.slug,
        categoryId: componentTypes.categoryId,
        stage: componentTypes.stage,
        isFirstLeaf: componentTypes.isFirstLeaf,
        garmentPart: componentTypes.garmentPart,
      });

    if (!row) {
      return NextResponse.json(
        { error: "Component type not found" },
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
    console.error("[admin/component-types] DB error:", err);
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
      .from(components)
      .where(eq(components.componentTypeId, id));

    if (linked.value > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete component type with linked components",
          linkedCount: linked.value,
        },
        { status: 409 },
      );
    }

    const [row] = await db
      .delete(componentTypes)
      .where(eq(componentTypes.id, id))
      .returning({ id: componentTypes.id });

    if (!row) {
      return NextResponse.json(
        { error: "Component type not found" },
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
    console.error("[admin/component-types] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
