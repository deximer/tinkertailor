import { eq, and, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { inviteCodes, type InviteCode } from "@/lib/db/schema/invite-codes";

export type InviteCodeError =
  | { code: "NOT_FOUND"; message: string }
  | { code: "ALREADY_USED"; message: string }
  | { code: "EXPIRED"; message: string };

export class InviteCodeValidationError extends Error {
  readonly errorCode: InviteCodeError["code"];

  constructor(error: InviteCodeError) {
    super(error.message);
    this.name = "InviteCodeValidationError";
    this.errorCode = error.code;
  }
}

/**
 * Validate an invite code string. Returns the code row (including role)
 * if valid, or throws an InviteCodeValidationError.
 */
export async function validateInviteCode(code: string): Promise<InviteCode> {
  const db = getDb();

  const rows = await db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.code, code))
    .limit(1);

  if (rows.length === 0) {
    throw new InviteCodeValidationError({
      code: "NOT_FOUND",
      message: "Invalid invite code",
    });
  }

  const invite = rows[0];

  if (invite.usedBy !== null) {
    throw new InviteCodeValidationError({
      code: "ALREADY_USED",
      message: "This invite code has already been used",
    });
  }

  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw new InviteCodeValidationError({
      code: "EXPIRED",
      message: "This invite code has expired",
    });
  }

  return invite;
}

/**
 * Mark an invite code as used by a specific user.
 */
export async function markInviteCodeUsed(
  codeId: string,
  userId: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(inviteCodes)
    .set({ usedBy: userId, usedAt: new Date() })
    .where(eq(inviteCodes.id, codeId));
}
