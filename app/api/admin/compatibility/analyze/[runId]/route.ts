import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  components,
  compatibilityAnalysisRuns,
  compatibilitySuggestions,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { requireAdmin } from "@/lib/auth/guards";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { runId } = await params;

    // Fetch the run
    const [run] = await db
      .select()
      .from(compatibilityAnalysisRuns)
      .where(eq(compatibilityAnalysisRuns.id, runId))
      .limit(1);

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Fetch suggestions with component names via aliased joins
    const bodice = alias(components, "bodice");
    const partner = alias(components, "partner");

    const suggestions = await db
      .select({
        id: compatibilitySuggestions.id,
        runId: compatibilitySuggestions.runId,
        bodiceId: compatibilitySuggestions.bodiceId,
        partnerId: compatibilitySuggestions.partnerId,
        confidence: compatibilitySuggestions.confidence,
        sleeveStyle: compatibilitySuggestions.sleeveStyle,
        alreadyExists: compatibilitySuggestions.alreadyExists,
        status: compatibilitySuggestions.status,
        createdAt: compatibilitySuggestions.createdAt,
        bodiceName: bodice.name,
        bodiceAssetCode: bodice.assetCode,
        partnerName: partner.name,
        partnerAssetCode: partner.assetCode,
      })
      .from(compatibilitySuggestions)
      .leftJoin(bodice, eq(compatibilitySuggestions.bodiceId, bodice.id))
      .leftJoin(partner, eq(compatibilitySuggestions.partnerId, partner.id))
      .where(eq(compatibilitySuggestions.runId, runId))
      .orderBy(desc(compatibilitySuggestions.confidence));

    return NextResponse.json({ run, suggestions });
  } catch (err) {
    console.error("[admin/compatibility/analyze/[runId]] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
