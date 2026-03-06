import { NextResponse } from "next/server";
import {
  validateInviteCode,
  InviteCodeValidationError,
} from "@/lib/auth/invite-codes";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { valid: false, error: "Code is required" },
      { status: 400 },
    );
  }

  try {
    await validateInviteCode(code);
    return NextResponse.json({ valid: true });
  } catch (err) {
    if (err instanceof InviteCodeValidationError) {
      return NextResponse.json({
        valid: false,
        error: err.message,
        code: err.errorCode,
      });
    }
    return NextResponse.json(
      { valid: false, error: "Validation failed" },
      { status: 500 },
    );
  }
}
