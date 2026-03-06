import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDb } from "@/lib/db";
import { profiles } from "@/lib/db/schema/profiles";
import {
  validateInviteCode,
  markInviteCodeUsed,
  InviteCodeValidationError,
} from "@/lib/auth/invite-codes";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service role credentials");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: Request) {
  let body: { email?: string; password?: string; inviteCode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { email, password, inviteCode } = body;

  if (!email || !password || !inviteCode) {
    return NextResponse.json(
      { error: "Email, password, and invite code are required" },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  // 1. Validate the invite code
  let invite;
  try {
    invite = await validateInviteCode(inviteCode);
  } catch (err) {
    if (err instanceof InviteCodeValidationError) {
      return NextResponse.json(
        { error: err.message, code: err.errorCode },
        { status: 400 },
      );
    }
    throw err;
  }

  // 2. Create the Supabase auth user via service role
  const supabase = getServiceClient();
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (authError) {
    if (authError.message.includes("already been registered")) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 },
    );
  }

  const userId = authData.user.id;

  // 3. Insert profile row with role from invite code
  try {
    const db = getDb();
    await db.insert(profiles).values({
      id: userId,
      role: invite.role,
    });
  } catch (profileError) {
    // Clean up: delete the auth user if profile insert fails
    await supabase.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: "Failed to create user profile" },
      { status: 500 },
    );
  }

  // 4. Mark the invite code as used
  await markInviteCodeUsed(invite.id, userId);

  return NextResponse.json({ success: true }, { status: 201 });
}
