import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import {
  components,
  componentCompatibility,
  silhouetteComponents,
  productComponents,
} from "@/lib/db/schema";
import { componentFabricRules } from "@/lib/db/schema/fabrics";
import { eq, or, count } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  componentTypeId: z.string().uuid(),
  modelPath: z.string().max(500).nullable().optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  code: z.string().min(1).max(50).optional(),
  componentTypeId: z.string().uuid().optional(),
  modelPath: z.string().max(500).nullable().optional(),
});

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const rows = await db
      .select({
        id: components.id,
        name: components.name,
        code: components.code,
        componentTypeId: components.componentTypeId,
        modelPath: components.modelPath,
        createdAt: components.createdAt,
      })
      .from(components)
      .orderBy(components.name);

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[admin/components] GET error:", err);
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
      .select({ id: components.id })
      .from(components)
      .where(eq(components.code, body.code))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "Component code already exists", code: body.code },
        { status: 409 },
      );
    }

    const [row] = await db
      .insert(components)
      .values({
        name: body.name,
        code: body.code,
        componentTypeId: body.componentTypeId,
        modelPath: body.modelPath ?? null,
      })
      .returning({
        id: components.id,
        name: components.name,
        code: components.code,
        componentTypeId: components.componentTypeId,
        modelPath: components.modelPath,
        createdAt: components.createdAt,
      });

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[admin/components] POST error:", err);
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

    if (body.code !== undefined) {
      const [existing] = await db
        .select({ id: components.id })
        .from(components)
        .where(eq(components.code, body.code))
        .limit(1);

      if (existing && existing.id !== body.id) {
        return NextResponse.json(
          { error: "Component code already exists", code: body.code },
          { status: 409 },
        );
      }
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.code !== undefined) updates.code = body.code;
    if (body.componentTypeId !== undefined)
      updates.componentTypeId = body.componentTypeId;
    if (body.modelPath !== undefined) updates.modelPath = body.modelPath;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    const [row] = await db
      .update(components)
      .set(updates)
      .where(eq(components.id, body.id))
      .returning({
        id: components.id,
        name: components.name,
        code: components.code,
        componentTypeId: components.componentTypeId,
        modelPath: components.modelPath,
        createdAt: components.createdAt,
      });

    if (!row) {
      return NextResponse.json(
        { error: "Component not found" },
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
    console.error("[admin/components] PUT error:", err);
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

    // Check if the component is used in any active order's product
    const [inUse] = await db
      .select({ value: count() })
      .from(productComponents)
      .where(eq(productComponents.componentId, id));

    if (inUse.value > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete component used in existing products",
          linkedCount: inUse.value,
        },
        { status: 409 },
      );
    }

    // Cascade-delete compatibility edges (both directions)
    await db
      .delete(componentCompatibility)
      .where(
        or(
          eq(componentCompatibility.componentAId, id),
          eq(componentCompatibility.componentBId, id),
        ),
      );

    // Cascade-delete silhouette assignments
    await db
      .delete(silhouetteComponents)
      .where(eq(silhouetteComponents.componentId, id));

    // Cascade-delete fabric category associations
    await db
      .delete(componentFabricRules)
      .where(eq(componentFabricRules.componentId, id));

    // Delete the component itself
    const [row] = await db
      .delete(components)
      .where(eq(components.id, id))
      .returning({ id: components.id });

    if (!row) {
      return NextResponse.json(
        { error: "Component not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/components] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
