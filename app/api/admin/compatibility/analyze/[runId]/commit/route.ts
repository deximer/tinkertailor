import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  compatibilityAnalysisRuns,
  compatibilitySuggestions,
  bodiceSkirtCompatibility,
  bodiceSleeveCompatibility,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { runId } = await params;

    // Fetch the run to determine pair type
    const [run] = await db
      .select({ pairType: compatibilityAnalysisRuns.pairType })
      .from(compatibilityAnalysisRuns)
      .where(eq(compatibilityAnalysisRuns.id, runId))
      .limit(1);

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Fetch all accepted suggestions for this run
    const accepted = await db
      .select({
        bodiceId: compatibilitySuggestions.bodiceId,
        partnerId: compatibilitySuggestions.partnerId,
        sleeveStyle: compatibilitySuggestions.sleeveStyle,
      })
      .from(compatibilitySuggestions)
      .where(
        and(
          eq(compatibilitySuggestions.runId, runId),
          eq(compatibilitySuggestions.status, "accepted"),
        ),
      );

    if (accepted.length === 0) {
      return NextResponse.json({ inserted: 0, skipped: 0 });
    }

    let inserted = 0;

    if (run.pairType === "bodice_skirt") {
      for (const suggestion of accepted) {
        const rows = await db
          .insert(bodiceSkirtCompatibility)
          .values({
            bodiceId: suggestion.bodiceId,
            skirtId: suggestion.partnerId,
          })
          .onConflictDoNothing()
          .returning({ bodiceId: bodiceSkirtCompatibility.bodiceId });

        if (rows.length > 0) {
          inserted++;
        }
      }
    } else {
      // bodice_sleeve
      for (const suggestion of accepted) {
        const rows = await db
          .insert(bodiceSleeveCompatibility)
          .values({
            bodiceId: suggestion.bodiceId,
            sleeveId: suggestion.partnerId,
            sleeveStyleCode: suggestion.sleeveStyle ?? null,
          })
          .onConflictDoNothing()
          .returning({ bodiceId: bodiceSleeveCompatibility.bodiceId });

        if (rows.length > 0) {
          inserted++;
        }
      }
    }

    const skipped = accepted.length - inserted;

    return NextResponse.json({ inserted, skipped });
  } catch (err) {
    console.error(
      "[admin/compatibility/analyze/[runId]/commit] POST error:",
      err,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
