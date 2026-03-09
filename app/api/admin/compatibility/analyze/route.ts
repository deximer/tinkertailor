import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import {
  components,
  componentMeshes,
  bodiceSkirtCompatibility,
  bodiceSleeveCompatibility,
  compatibilityAnalysisRuns,
  compatibilitySuggestions,
} from "@/lib/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@supabase/supabase-js";
import {
  parseObjBoundaryLoops,
  classifyLoops,
  normalizeLoop,
  computeSimilarity,
  classifySleeveStyle,
} from "@/lib/compatibility";
import type { ComponentRole } from "@/lib/compatibility";

// ---------------------------------------------------------------------------
// Supabase service client (for storage downloads)
// ---------------------------------------------------------------------------

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const analyzeBodySchema = z.object({
  pairType: z.enum(["bodice_skirt", "bodice_sleeve"]),
  confidenceThreshold: z.number().min(0.5).max(1.0),
  onlyUnmatched: z.boolean(),
});

type AnalyzeBody = z.infer<typeof analyzeBodySchema>;

// ---------------------------------------------------------------------------
// Types for internal use
// ---------------------------------------------------------------------------

interface ComponentRow {
  id: string;
  name: string;
}

interface MeshRow {
  componentId: string;
  storagePath: string;
  fabricWeight: string;
}

// ---------------------------------------------------------------------------
// POST — Launch analysis run with SSE progress stream
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: AnalyzeBody;
  try {
    body = analyzeBodySchema.parse(await request.json());
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { pairType, confidenceThreshold, onlyUnmatched } = body;
  const partnerPart = pairType === "bodice_skirt" ? "skirt" : "sleeve";

  // Insert the analysis run row
  const [run] = await db
    .insert(compatibilityAnalysisRuns)
    .values({
      pairType,
      status: "running",
      confidenceThreshold: String(confidenceThreshold),
      onlyUnmatched,
    })
    .returning({ id: compatibilityAnalysisRuns.id });

  const runId = run.id;

  // Build the SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const emit = (data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        // -----------------------------------------------------------------
        // 1. Query bodice and partner components
        // -----------------------------------------------------------------
        const [bodiceRows, partnerRows] = await Promise.all([
          db
            .select({ id: components.id, name: components.name })
            .from(components)
            .where(eq(components.garmentPart, "bodice")),
          db
            .select({ id: components.id, name: components.name })
            .from(components)
            .where(eq(components.garmentPart, partnerPart)),
        ]);

        // -----------------------------------------------------------------
        // 2. Build pair combinations, optionally excluding existing edges
        // -----------------------------------------------------------------
        const existingPairs = new Set<string>();

        if (onlyUnmatched && bodiceRows.length > 0 && partnerRows.length > 0) {
          const bodiceIds = bodiceRows.map((b) => b.id);
          const partnerIds = partnerRows.map((p) => p.id);

          if (pairType === "bodice_skirt") {
            const existing = await db
              .select({
                bodiceId: bodiceSkirtCompatibility.bodiceId,
                skirtId: bodiceSkirtCompatibility.skirtId,
              })
              .from(bodiceSkirtCompatibility)
              .where(
                and(
                  inArray(bodiceSkirtCompatibility.bodiceId, bodiceIds),
                  inArray(bodiceSkirtCompatibility.skirtId, partnerIds),
                ),
              );
            for (const row of existing) {
              existingPairs.add(`${row.bodiceId}:${row.skirtId}`);
            }
          } else {
            const existing = await db
              .select({
                bodiceId: bodiceSleeveCompatibility.bodiceId,
                sleeveId: bodiceSleeveCompatibility.sleeveId,
              })
              .from(bodiceSleeveCompatibility)
              .where(
                and(
                  inArray(bodiceSleeveCompatibility.bodiceId, bodiceIds),
                  inArray(bodiceSleeveCompatibility.sleeveId, partnerIds),
                ),
              );
            for (const row of existing) {
              existingPairs.add(`${row.bodiceId}:${row.sleeveId}`);
            }
          }
        }

        const pairs: Array<{ bodice: ComponentRow; partner: ComponentRow }> =
          [];
        for (const bodice of bodiceRows) {
          for (const partner of partnerRows) {
            if (
              onlyUnmatched &&
              existingPairs.has(`${bodice.id}:${partner.id}`)
            ) {
              continue;
            }
            pairs.push({ bodice, partner });
          }
        }

        // Update total_pairs on the run
        await db
          .update(compatibilityAnalysisRuns)
          .set({ totalPairs: pairs.length })
          .where(eq(compatibilityAnalysisRuns.id, runId));

        // -----------------------------------------------------------------
        // 3. Pre-load all relevant meshes in bulk
        // -----------------------------------------------------------------
        const allComponentIds = Array.from(
          new Set(
            bodiceRows.map((b) => b.id).concat(partnerRows.map((p) => p.id)),
          ),
        );

        const meshMap = new Map<string, MeshRow>();

        if (allComponentIds.length > 0) {
          const allMeshes = await db
            .select({
              componentId: componentMeshes.componentId,
              storagePath: componentMeshes.storagePath,
              fabricWeight: componentMeshes.fabricWeight,
            })
            .from(componentMeshes)
            .where(inArray(componentMeshes.componentId, allComponentIds));

          // Group by componentId, prefer "standard" fabric weight
          const meshesByComponent: Record<string, MeshRow[]> = {};
          for (const mesh of allMeshes) {
            if (!meshesByComponent[mesh.componentId]) {
              meshesByComponent[mesh.componentId] = [];
            }
            meshesByComponent[mesh.componentId].push(mesh);
          }

          for (const compId of Object.keys(meshesByComponent)) {
            const meshes = meshesByComponent[compId];
            const standard = meshes.find(
              (m) => m.fabricWeight === "standard",
            );
            meshMap.set(compId, standard ?? meshes[0]);
          }
        }

        // -----------------------------------------------------------------
        // 4. Analyze each pair
        // -----------------------------------------------------------------
        const supabase = getServiceClient();
        let processed = 0;
        let suggestionsCount = 0;

        // Cache downloaded + parsed OBJ data to avoid re-downloading
        const objCache = new Map<
          string,
          { text: string } | null
        >();

        const downloadObj = async (
          storagePath: string,
        ): Promise<string | null> => {
          if (objCache.has(storagePath)) {
            const cached = objCache.get(storagePath);
            return cached ? cached.text : null;
          }

          try {
            const { data, error: dlError } = await supabase.storage
              .from("models")
              .download(storagePath);

            if (dlError || !data) {
              objCache.set(storagePath, null);
              return null;
            }

            const text = await data.text();
            objCache.set(storagePath, { text });
            return text;
          } catch {
            objCache.set(storagePath, null);
            return null;
          }
        };

        for (const pair of pairs) {
          processed++;

          // Get meshes for both components
          const bodiceMesh = meshMap.get(pair.bodice.id);
          const partnerMesh = meshMap.get(pair.partner.id);

          if (!bodiceMesh || !partnerMesh) {
            // Skip pairs where either component has no mesh
            emit({
              type: "progress",
              processed,
              total: pairs.length,
              latestSuggestion: null,
            });
            continue;
          }

          // Download OBJ files
          const [bodiceObjText, partnerObjText] = await Promise.all([
            downloadObj(bodiceMesh.storagePath),
            downloadObj(partnerMesh.storagePath),
          ]);

          if (!bodiceObjText || !partnerObjText) {
            // Skip pairs where OBJ download fails
            emit({
              type: "progress",
              processed,
              total: pairs.length,
              latestSuggestion: null,
            });
            continue;
          }

          // Parse boundary loops
          const bodiceLoops = parseObjBoundaryLoops(bodiceObjText);
          const partnerLoops = parseObjBoundaryLoops(partnerObjText);

          if (bodiceLoops.length === 0 || partnerLoops.length === 0) {
            emit({
              type: "progress",
              processed,
              total: pairs.length,
              latestSuggestion: null,
            });
            continue;
          }

          // Classify loops
          const bodiceClassified = classifyLoops(bodiceLoops, "bodice");
          const partnerRole: ComponentRole = partnerPart as ComponentRole;
          const partnerClassified = classifyLoops(partnerLoops, partnerRole);

          // Find waist loops from each
          const bodiceWaist = bodiceClassified.find(
            (l) => l.role === "waist",
          );
          const partnerWaist = partnerClassified.find(
            (l) => l.role === "waist",
          );

          let confidence = 0;

          if (bodiceWaist && partnerWaist) {
            const normalizedBodice = normalizeLoop(bodiceWaist);
            const normalizedPartner = normalizeLoop(partnerWaist);
            confidence = computeSimilarity(normalizedBodice, normalizedPartner);
          }

          // For bodice_sleeve pairs, also classify sleeve style
          let sleeveStyle: "ST" | "DS" | "OS" | null = null;
          if (pairType === "bodice_sleeve") {
            // Find an armhole loop from the bodice
            const armholeLoop = bodiceClassified.find(
              (l) =>
                l.role === "armhole_left" || l.role === "armhole_right",
            );

            if (armholeLoop) {
              // Compute bodice bounding box
              const allBodiceVerts = bodiceLoops.flatMap((l) => l.vertices);
              let minX = Infinity;
              let maxX = -Infinity;
              let minY = Infinity;
              let maxY = -Infinity;
              for (const v of allBodiceVerts) {
                if (v.x < minX) minX = v.x;
                if (v.x > maxX) maxX = v.x;
                if (v.y < minY) minY = v.y;
                if (v.y > maxY) maxY = v.y;
              }

              sleeveStyle = classifySleeveStyle(armholeLoop, {
                minX,
                maxX,
                minY,
                maxY,
              });
            }
          }

          // Check if the pair already exists in the compat table
          let alreadyExists = false;

          if (pairType === "bodice_skirt") {
            const [existing] = await db
              .select({
                bodiceId: bodiceSkirtCompatibility.bodiceId,
              })
              .from(bodiceSkirtCompatibility)
              .where(
                and(
                  eq(bodiceSkirtCompatibility.bodiceId, pair.bodice.id),
                  eq(bodiceSkirtCompatibility.skirtId, pair.partner.id),
                ),
              )
              .limit(1);
            alreadyExists = !!existing;
          } else {
            const [existing] = await db
              .select({
                bodiceId: bodiceSleeveCompatibility.bodiceId,
              })
              .from(bodiceSleeveCompatibility)
              .where(
                and(
                  eq(
                    bodiceSleeveCompatibility.bodiceId,
                    pair.bodice.id,
                  ),
                  eq(
                    bodiceSleeveCompatibility.sleeveId,
                    pair.partner.id,
                  ),
                ),
              )
              .limit(1);
            alreadyExists = !!existing;
          }

          // Insert suggestion if above threshold
          let latestSuggestion: Record<string, unknown> | null = null;

          if (confidence >= confidenceThreshold) {
            await db.insert(compatibilitySuggestions).values({
              runId,
              bodiceId: pair.bodice.id,
              partnerId: pair.partner.id,
              confidence: String(confidence),
              sleeveStyle,
              alreadyExists,
              status: "pending",
            });

            suggestionsCount++;
            latestSuggestion = {
              bodiceName: pair.bodice.name,
              partnerName: pair.partner.name,
              confidence,
              sleeveStyle,
              alreadyExists,
            };
          }

          emit({
            type: "progress",
            processed,
            total: pairs.length,
            latestSuggestion,
          });
        }

        // -----------------------------------------------------------------
        // 5. Mark run as completed
        // -----------------------------------------------------------------
        await db
          .update(compatibilityAnalysisRuns)
          .set({
            status: "completed",
            completedAt: sql`now()`,
            suggestionsCount,
          })
          .where(eq(compatibilityAnalysisRuns.id, runId));

        emit({ type: "done", runId });
      } catch (err) {
        console.error("[admin/compatibility/analyze] run error:", err);

        // Mark run as failed
        try {
          await db
            .update(compatibilityAnalysisRuns)
            .set({
              status: "failed",
              completedAt: sql`now()`,
            })
            .where(eq(compatibilityAnalysisRuns.id, runId));
        } catch (updateErr) {
          console.error(
            "[admin/compatibility/analyze] failed to update run status:",
            updateErr,
          );
        }

        emit({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ---------------------------------------------------------------------------
// GET — List past analysis runs
// ---------------------------------------------------------------------------

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const runs = await db
      .select({
        id: compatibilityAnalysisRuns.id,
        pairType: compatibilityAnalysisRuns.pairType,
        status: compatibilityAnalysisRuns.status,
        confidenceThreshold: compatibilityAnalysisRuns.confidenceThreshold,
        totalPairs: compatibilityAnalysisRuns.totalPairs,
        suggestionsCount: compatibilityAnalysisRuns.suggestionsCount,
        createdAt: compatibilityAnalysisRuns.createdAt,
        completedAt: compatibilityAnalysisRuns.completedAt,
      })
      .from(compatibilityAnalysisRuns)
      .orderBy(desc(compatibilityAnalysisRuns.createdAt));

    return NextResponse.json(runs);
  } catch (err) {
    console.error("[admin/compatibility/analyze] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
