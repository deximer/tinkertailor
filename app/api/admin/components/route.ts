import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import {
  components,
  componentTypes,
  garmentParts,
  silhouetteComponents,
  productComponents,
} from "@/lib/db/schema";
import type { GarmentPart } from "@/lib/db/schema/components";
import { componentFabricRules } from "@/lib/db/schema/fabrics";
import { eq, count } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  assetCode: z.string().min(1).max(50),
  componentTypeId: z.string().uuid(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  assetCode: z.string().min(1).max(50).optional(),
  componentTypeId: z.string().uuid().optional(),
});

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const rows = await db
      .select({
        id: components.id,
        name: components.name,
        assetCode: components.assetCode,
        componentTypeId: components.componentTypeId,
        garmentPart: components.garmentPart,
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
      .where(eq(components.assetCode, body.assetCode))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "Component asset code already exists", assetCode: body.assetCode },
        { status: 409 },
      );
    }

    // Look up garmentPart slug from the component type → garment_parts join
    const [ct] = await db
      .select({ garmentPartSlug: garmentParts.slug })
      .from(componentTypes)
      .leftJoin(garmentParts, eq(componentTypes.garmentPartId, garmentParts.id))
      .where(eq(componentTypes.id, body.componentTypeId))
      .limit(1);

    const [row] = await db
      .insert(components)
      .values({
        name: body.name,
        assetCode: body.assetCode,
        componentTypeId: body.componentTypeId,
        garmentPart: (ct?.garmentPartSlug as GarmentPart) ?? null,
      })
      .returning({
        id: components.id,
        name: components.name,
        assetCode: components.assetCode,
        componentTypeId: components.componentTypeId,
        garmentPart: components.garmentPart,
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

    if (body.assetCode !== undefined) {
      const [existing] = await db
        .select({ id: components.id })
        .from(components)
        .where(eq(components.assetCode, body.assetCode))
        .limit(1);

      if (existing && existing.id !== body.id) {
        return NextResponse.json(
          { error: "Component asset code already exists", assetCode: body.assetCode },
          { status: 409 },
        );
      }
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.assetCode !== undefined) updates.assetCode = body.assetCode;
    if (body.componentTypeId !== undefined) {
      updates.componentTypeId = body.componentTypeId;
      // Re-sync garmentPart from new component type → garment_parts join
      const [ct] = await db
        .select({ garmentPartSlug: garmentParts.slug })
        .from(componentTypes)
        .leftJoin(garmentParts, eq(componentTypes.garmentPartId, garmentParts.id))
        .where(eq(componentTypes.id, body.componentTypeId))
        .limit(1);
      updates.garmentPart = (ct?.garmentPartSlug as GarmentPart) ?? null;
    }
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
        assetCode: components.assetCode,
        componentTypeId: components.componentTypeId,
        garmentPart: components.garmentPart,
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
