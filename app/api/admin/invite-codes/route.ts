import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { inviteCodes } from "@/lib/db/schema/invite-codes";
import { requireAdmin } from "@/lib/auth/guards";
import { desc } from "drizzle-orm";
import crypto from "crypto";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(inviteCodes)
      .orderBy(desc(inviteCodes.createdAt));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[admin/invite-codes] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const { role, expiresAt } = body as {
      role: "creator" | "shopper";
      expiresAt?: string;
    };

    if (!role || !["creator", "shopper"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be 'creator' or 'shopper'." },
        { status: 400 },
      );
    }

    const code = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

    const db = getDb();
    const [row] = await db
      .insert(inviteCodes)
      .values({
        code,
        role,
        createdBy: result.user.id,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error("[admin/invite-codes] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
