import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import { compatibilitySuggestions } from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";

const bulkByIds = z.object({
  ids: z.array(z.string().uuid()),
  status: z.enum(["accepted", "rejected"]),
});

const bulkByConfidence = z.object({
  minConfidence: z.number().min(0).max(1),
  status: z.literal("accepted"),
});

const bodySchema = z.union([bulkByIds, bulkByConfidence]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { runId } = await params;
    const body = bodySchema.parse(await request.json());

    let updated: number;

    if ("ids" in body) {
      // Bulk update by explicit IDs
      const rows = await db
        .update(compatibilitySuggestions)
        .set({ status: body.status })
        .where(
          and(
            eq(compatibilitySuggestions.runId, runId),
            inArray(compatibilitySuggestions.id, body.ids),
          ),
        )
        .returning({ id: compatibilitySuggestions.id });

      updated = rows.length;
    } else {
      // Bulk accept by confidence threshold
      const rows = await db
        .update(compatibilitySuggestions)
        .set({ status: body.status })
        .where(
          and(
            eq(compatibilitySuggestions.runId, runId),
            eq(compatibilitySuggestions.status, "pending"),
            sql`CAST(${compatibilitySuggestions.confidence} AS double precision) >= ${body.minConfidence}`,
          ),
        )
        .returning({ id: compatibilitySuggestions.id });

      updated = rows.length;
    }

    return NextResponse.json({ updated });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    console.error(
      "[admin/compatibility/analyze/[runId]/suggestions] PATCH error:",
      err,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
