import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import { garmentTypeParts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";

const createSchema = z.object({
  garmentTypeId: z.string().uuid(),
  garmentPartId: z.string().uuid(),
});

const deleteSchema = z.object({
  garmentTypeId: z.string().uuid(),
  garmentPartId: z.string().uuid(),
});

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = createSchema.parse(await request.json());

    const [row] = await db
      .insert(garmentTypeParts)
      .values({
        garmentTypeId: body.garmentTypeId,
        garmentPartId: body.garmentPartId,
      })
      .onConflictDoNothing()
      .returning({
        garmentTypeId: garmentTypeParts.garmentTypeId,
        garmentPartId: garmentTypeParts.garmentPartId,
      });

    if (!row) {
      return NextResponse.json(
        { message: "Mapping already exists" },
        { status: 200 },
      );
    }

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[admin/garment-type-parts] DB error:", err);
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
    let garmentTypeId = searchParams.get("garmentTypeId");
    let garmentPartId = searchParams.get("garmentPartId");

    if (!garmentTypeId || !garmentPartId) {
      const body = deleteSchema.parse(await request.json());
      garmentTypeId = body.garmentTypeId;
      garmentPartId = body.garmentPartId;
    }

    const [row] = await db
      .delete(garmentTypeParts)
      .where(
        and(
          eq(garmentTypeParts.garmentTypeId, garmentTypeId),
          eq(garmentTypeParts.garmentPartId, garmentPartId),
        ),
      )
      .returning({
        garmentTypeId: garmentTypeParts.garmentTypeId,
        garmentPartId: garmentTypeParts.garmentPartId,
      });

    if (!row) {
      return NextResponse.json(
        { error: "Mapping not found" },
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
    console.error("[admin/garment-type-parts] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
