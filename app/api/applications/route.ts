import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creatorApplications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "@/lib/auth/guards";

export async function GET() {
  const result = await requireAuth();
  if (result.error) return result.error;

  try {
    const [application] = await db
      .select()
      .from(creatorApplications)
      .where(eq(creatorApplications.userId, result.user.id))
      .limit(1);

    return NextResponse.json({ application: application ?? null });
  } catch (err) {
    console.error("[api/applications] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const result = await requireRole("shopper");
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const { name, bio, instagramUrl, tiktokUrl, portfolioUrl } = body as {
      name?: string;
      bio?: string;
      instagramUrl?: string;
      tiktokUrl?: string;
      portfolioUrl?: string;
    };

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 },
      );
    }

    if (!bio || !bio.trim()) {
      return NextResponse.json(
        { error: "Bio is required" },
        { status: 400 },
      );
    }

    const [application] = await db
      .insert(creatorApplications)
      .values({
        userId: result.user.id,
        name: name.trim(),
        bio: bio.trim(),
        instagramUrl: instagramUrl?.trim() || null,
        tiktokUrl: tiktokUrl?.trim() || null,
        portfolioUrl: portfolioUrl?.trim() || null,
      })
      .returning({ id: creatorApplications.id });

    return NextResponse.json({ id: application.id }, { status: 201 });
  } catch (err: unknown) {
    // Handle unique constraint violation on user_id
    if (
      err instanceof Error &&
      err.message.includes("unique") &&
      err.message.includes("user_id")
    ) {
      return NextResponse.json(
        { error: "You have already submitted an application" },
        { status: 409 },
      );
    }

    // Also check for PostgreSQL error code 23505 (unique_violation)
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "23505"
    ) {
      return NextResponse.json(
        { error: "You have already submitted an application" },
        { status: 409 },
      );
    }

    console.error("[api/applications] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
