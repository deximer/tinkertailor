import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import {
  components,
  fabricCategories,
  componentFabricRules,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";

const linkSchema = z.object({
  componentId: z.string().uuid(),
  fabricCategoryId: z.string().uuid(),
});

export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const componentId = searchParams.get("componentId");

    // Bulk mode: return all rules as { componentId, fabricCategoryId }[]
    if (!componentId) {
      const rows = await db
        .select({
          componentId: componentFabricRules.componentId,
          fabricCategoryId: componentFabricRules.fabricCategoryId,
        })
        .from(componentFabricRules);
      return NextResponse.json(rows);
    }

    const [comp] = await db
      .select({ id: components.id })
      .from(components)
      .where(eq(components.id, componentId))
      .limit(1);

    if (!comp) {
      return NextResponse.json(
        { error: "Component not found" },
        { status: 404 },
      );
    }

    const rows = await db
      .select({
        fabricCategoryId: componentFabricRules.fabricCategoryId,
      })
      .from(componentFabricRules)
      .where(eq(componentFabricRules.componentId, componentId));

    return NextResponse.json(
      rows.map((r) => r.fabricCategoryId),
    );
  } catch (err) {
    console.error("[admin/component-fabric-rules] GET error:", err);
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
    const body = linkSchema.parse(await request.json());

    const [comp] = await db
      .select({ id: components.id })
      .from(components)
      .where(eq(components.id, body.componentId))
      .limit(1);

    if (!comp) {
      return NextResponse.json(
        { error: "Component not found" },
        { status: 404 },
      );
    }

    const [cat] = await db
      .select({ id: fabricCategories.id })
      .from(fabricCategories)
      .where(eq(fabricCategories.id, body.fabricCategoryId))
      .limit(1);

    if (!cat) {
      return NextResponse.json(
        { error: "Fabric category not found" },
        { status: 404 },
      );
    }

    await db
      .insert(componentFabricRules)
      .values({
        componentId: body.componentId,
        fabricCategoryId: body.fabricCategoryId,
      })
      .onConflictDoNothing();

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[admin/component-fabric-rules] POST error:", err);
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
    const body = linkSchema.parse(await request.json());

    const [comp] = await db
      .select({ id: components.id })
      .from(components)
      .where(eq(components.id, body.componentId))
      .limit(1);

    if (!comp) {
      return NextResponse.json(
        { error: "Component not found" },
        { status: 404 },
      );
    }

    const [cat] = await db
      .select({ id: fabricCategories.id })
      .from(fabricCategories)
      .where(eq(fabricCategories.id, body.fabricCategoryId))
      .limit(1);

    if (!cat) {
      return NextResponse.json(
        { error: "Fabric category not found" },
        { status: 404 },
      );
    }

    await db
      .delete(componentFabricRules)
      .where(
        and(
          eq(componentFabricRules.componentId, body.componentId),
          eq(
            componentFabricRules.fabricCategoryId,
            body.fabricCategoryId,
          ),
        ),
      );

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[admin/component-fabric-rules] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
