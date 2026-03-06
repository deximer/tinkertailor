import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDb } from "@/lib/db";
import { creatorApplications } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { sendApplicationRejectedEmail } from "@/lib/email/application-status";
import { eq } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const { id: applicationId } = await params;
    const body = await request.json().catch(() => ({}));
    const { note } = body as { note?: string };

    const db = getDb();

    // Fetch the application
    const [application] = await db
      .select()
      .from(creatorApplications)
      .where(eq(creatorApplications.id, applicationId))
      .limit(1);

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    if (application.status !== "pending") {
      return NextResponse.json(
        { error: `Application is already ${application.status}` },
        { status: 400 },
      );
    }

    // Update application status
    await db
      .update(creatorApplications)
      .set({
        status: "rejected",
        reviewedBy: user.id,
        reviewedAt: new Date(),
        adminNote: note || null,
      })
      .where(eq(creatorApplications.id, applicationId));

    // Get the applicant's email via Supabase admin API
    try {
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
      const {
        data: { user: applicantUser },
      } = await adminClient.auth.admin.getUserById(application.userId);

      if (applicantUser?.email) {
        await sendApplicationRejectedEmail(
          applicantUser.email,
          application.name,
          note,
        );
      }
    } catch (emailErr) {
      // Log but don't fail the rejection if email fails
      console.error("[admin/applications/reject] Email error:", emailErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/applications/reject] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
