import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDb } from "@/lib/db";
import { creatorApplications, profiles } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { sendApplicationApprovedEmail } from "@/lib/email/application-status";
import { eq } from "drizzle-orm";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const { id: applicationId } = await params;
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

    // Generate handle from application name
    let handle = slugify(application.name);
    if (!handle) {
      handle = "creator";
    }

    // Check if handle already exists
    const [existingProfile] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.handle, handle))
      .limit(1);

    if (existingProfile) {
      const suffix = Math.random().toString(36).substring(2, 6);
      handle = `${handle}-${suffix}`;
    }

    // Update application status
    await db
      .update(creatorApplications)
      .set({
        status: "approved",
        reviewedBy: user.id,
        reviewedAt: new Date(),
      })
      .where(eq(creatorApplications.id, applicationId));

    // Update profile role to creator and set handle
    await db
      .update(profiles)
      .set({ role: "creator", handle })
      .where(eq(profiles.id, application.userId));

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
        await sendApplicationApprovedEmail(
          applicantUser.email,
          application.name,
        );
      }
    } catch (emailErr) {
      // Log but don't fail the approval if email fails
      console.error("[admin/applications/approve] Email error:", emailErr);
    }

    return NextResponse.json({ success: true, handle });
  } catch (err) {
    console.error("[admin/applications/approve] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
