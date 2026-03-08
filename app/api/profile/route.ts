import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guards";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: profile.id,
    displayName: profile.displayName,
    handle: profile.handle,
    avatarUrl: profile.avatarUrl,
    role: profile.role,
    createdAt: profile.createdAt,
  });
}

export async function PUT(request: Request) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const displayName = formData.get("displayName") as string | null;
    const avatar = formData.get("avatar") as File | null;

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (displayName !== null) {
      updates.displayName = displayName;
    }

    if (avatar && avatar.size > 0) {
      const ext = avatar.name.split(".").pop() ?? "jpg";
      const filePath = `${user.id}/avatar.${ext}`;
      const buffer = Buffer.from(await avatar.arrayBuffer());

      const supabase = getServiceClient();
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, buffer, {
          contentType: avatar.type || "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: `Avatar upload failed: ${uploadError.message}` },
          { status: 500 },
        );
      }

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);
      updates.avatarUrl = urlData.publicUrl;
    }

    const [updated] = await db
      .update(profiles)
      .set(updates)
      .where(eq(profiles.id, user.id))
      .returning();

    return NextResponse.json({
      id: updated.id,
      displayName: updated.displayName,
      handle: updated.handle,
      avatarUrl: updated.avatarUrl,
      role: updated.role,
      createdAt: updated.createdAt,
    });
  }

  // JSON request — update displayName only
  const body = await request.json();
  const { displayName } = body as { displayName: string };

  const [updated] = await db
    .update(profiles)
    .set({ displayName, updatedAt: new Date() })
    .where(eq(profiles.id, user.id))
    .returning();

  return NextResponse.json({
    id: updated.id,
    displayName: updated.displayName,
    handle: updated.handle,
    avatarUrl: updated.avatarUrl,
    role: updated.role,
    createdAt: updated.createdAt,
  });
}
