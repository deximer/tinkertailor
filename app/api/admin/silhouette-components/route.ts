import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import {
  silhouetteTemplates,
  silhouetteComponents,
  components,
  fabricSkins,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";

const addSchema = z.object({
  silhouetteId: z.string().uuid(),
  componentId: z.string().uuid(),
  defaultFabricSkinId: z.string().uuid().nullable().optional(),
});

const removeSchema = z.object({
  silhouetteId: z.string().uuid(),
  componentId: z.string().uuid(),
});

export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const silhouetteId = searchParams.get("silhouetteId");

    if (!silhouetteId) {
      return NextResponse.json(
        { error: "silhouetteId query param required" },
        { status: 400 },
      );
    }

    const rows = await db
      .select({
        componentId: silhouetteComponents.componentId,
        componentName: components.name,
        componentCode: components.code,
        defaultFabricSkinId: silhouetteComponents.defaultFabricSkinId,
      })
      .from(silhouetteComponents)
      .innerJoin(
        components,
        eq(silhouetteComponents.componentId, components.id),
      )
      .where(eq(silhouetteComponents.silhouetteId, silhouetteId))
      .orderBy(components.name);

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[admin/silhouette-components] GET error:", err);
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
    const body = addSchema.parse(await request.json());

    // Validate silhouette exists
    const [silhouette] = await db
      .select({ id: silhouetteTemplates.id })
      .from(silhouetteTemplates)
      .where(eq(silhouetteTemplates.id, body.silhouetteId))
      .limit(1);

    if (!silhouette) {
      return NextResponse.json(
        { error: "Silhouette not found" },
        { status: 404 },
      );
    }

    // Validate component exists
    const [component] = await db
      .select({ id: components.id })
      .from(components)
      .where(eq(components.id, body.componentId))
      .limit(1);

    if (!component) {
      return NextResponse.json(
        { error: "Component not found" },
        { status: 404 },
      );
    }

    // Validate fabric skin exists if provided
    if (body.defaultFabricSkinId) {
      const [skin] = await db
        .select({ id: fabricSkins.id })
        .from(fabricSkins)
        .where(eq(fabricSkins.id, body.defaultFabricSkinId))
        .limit(1);

      if (!skin) {
        return NextResponse.json(
          { error: "Fabric skin not found" },
          { status: 404 },
        );
      }
    }

    // Idempotent insert — check if already exists
    const [existing] = await db
      .select({ componentId: silhouetteComponents.componentId })
      .from(silhouetteComponents)
      .where(
        and(
          eq(silhouetteComponents.silhouetteId, body.silhouetteId),
          eq(silhouetteComponents.componentId, body.componentId),
        ),
      )
      .limit(1);

    if (existing) {
      // Already assigned — update defaultFabricSkinId if provided
      if (body.defaultFabricSkinId !== undefined) {
        await db
          .update(silhouetteComponents)
          .set({ defaultFabricSkinId: body.defaultFabricSkinId ?? null })
          .where(
            and(
              eq(silhouetteComponents.silhouetteId, body.silhouetteId),
              eq(silhouetteComponents.componentId, body.componentId),
            ),
          );
      }
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    await db.insert(silhouetteComponents).values({
      silhouetteId: body.silhouetteId,
      componentId: body.componentId,
      defaultFabricSkinId: body.defaultFabricSkinId ?? null,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[admin/silhouette-components] POST error:", err);
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
    const body = removeSchema.parse(await request.json());

    await db
      .delete(silhouetteComponents)
      .where(
        and(
          eq(silhouetteComponents.silhouetteId, body.silhouetteId),
          eq(silhouetteComponents.componentId, body.componentId),
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
    console.error("[admin/silhouette-components] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
