import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import {
  silhouetteTemplates,
  silhouetteTags,
  tagValues,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";

const addSchema = z.object({
  silhouetteId: z.string().uuid(),
  tagValueId: z.string().uuid(),
});

const removeSchema = z.object({
  silhouetteId: z.string().uuid(),
  tagValueId: z.string().uuid(),
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
        tagValueId: silhouetteTags.tagValueId,
      })
      .from(silhouetteTags)
      .where(eq(silhouetteTags.silhouetteId, silhouetteId));

    return NextResponse.json(rows.map((r) => r.tagValueId));
  } catch (err) {
    console.error("[admin/silhouette-tags] GET error:", err);
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

    // Validate tag value exists
    const [value] = await db
      .select({ id: tagValues.id })
      .from(tagValues)
      .where(eq(tagValues.id, body.tagValueId))
      .limit(1);

    if (!value) {
      return NextResponse.json(
        { error: "Tag value not found" },
        { status: 404 },
      );
    }

    // Idempotent insert — check if already exists
    const [existing] = await db
      .select({ tagValueId: silhouetteTags.tagValueId })
      .from(silhouetteTags)
      .where(
        and(
          eq(silhouetteTags.silhouetteId, body.silhouetteId),
          eq(silhouetteTags.tagValueId, body.tagValueId),
        ),
      )
      .limit(1);

    if (existing) {
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    await db.insert(silhouetteTags).values({
      silhouetteId: body.silhouetteId,
      tagValueId: body.tagValueId,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[admin/silhouette-tags] POST error:", err);
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
      .delete(silhouetteTags)
      .where(
        and(
          eq(silhouetteTags.silhouetteId, body.silhouetteId),
          eq(silhouetteTags.tagValueId, body.tagValueId),
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
    console.error("[admin/silhouette-tags] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
