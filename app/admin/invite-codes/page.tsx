import { getDb } from "@/lib/db";
import { inviteCodes } from "@/lib/db/schema/invite-codes";
import { profiles } from "@/lib/db/schema/profiles";
import { desc, eq } from "drizzle-orm";
import InviteCodeForm from "./InviteCodeForm";

type InviteCodeRow = {
  id: string;
  code: string;
  role: string;
  createdAt: Date;
  expiresAt: Date | null;
  usedAt: Date | null;
  createdByName: string | null;
  usedByName: string | null;
};

export default async function InviteCodesPage() {
  const db = getDb();

  // Alias for the "used by" join
  const createdByProfile = db
    .select({
      id: profiles.id,
      displayName: profiles.displayName,
    })
    .from(profiles)
    .as("created_by_profile");

  const usedByProfile = db
    .select({
      id: profiles.id,
      displayName: profiles.displayName,
    })
    .from(profiles)
    .as("used_by_profile");

  const rows = await db
    .select({
      id: inviteCodes.id,
      code: inviteCodes.code,
      role: inviteCodes.role,
      createdAt: inviteCodes.createdAt,
      expiresAt: inviteCodes.expiresAt,
      usedAt: inviteCodes.usedAt,
      createdByName: createdByProfile.displayName,
      usedByName: usedByProfile.displayName,
    })
    .from(inviteCodes)
    .leftJoin(createdByProfile, eq(inviteCodes.createdBy, createdByProfile.id))
    .leftJoin(usedByProfile, eq(inviteCodes.usedBy, usedByProfile.id))
    .orderBy(desc(inviteCodes.createdAt));

  const codes: InviteCodeRow[] = rows.map((r) => ({
    id: r.id,
    code: r.code,
    role: r.role,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    usedAt: r.usedAt,
    createdByName: r.createdByName,
    usedByName: r.usedByName,
  }));

  const formatDate = (d: Date | null) => {
    if (!d) return "\u2014";
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isExpired = (expiresAt: Date | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="mb-8 text-xl font-bold tracking-tight">
          Invite Codes
        </h1>

        {/* Generate new code form */}
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-400">
            Generate New Code
          </h2>
          <InviteCodeForm />
        </section>

        {/* Invite codes table */}
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-400">
            All Codes ({codes.length})
          </h2>

          {codes.length === 0 ? (
            <p className="text-sm text-gray-500">
              No invite codes yet. Generate one above.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 bg-[#222] text-left text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Created At</th>
                    <th className="px-4 py-3">Expires At</th>
                    <th className="px-4 py-3">Used By</th>
                    <th className="px-4 py-3">Used At</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((code) => {
                    const used = !!code.usedAt;
                    const expired = isExpired(code.expiresAt);

                    return (
                      <tr
                        key={code.id}
                        className="border-b border-gray-800 hover:bg-[#2a2a2a]"
                      >
                        <td className="px-4 py-3">
                          <code className="rounded bg-[#333] px-2 py-0.5 font-mono text-xs text-gray-200">
                            {code.code}
                          </code>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                              code.role === "creator"
                                ? "bg-purple-900/50 text-purple-300"
                                : "bg-blue-900/50 text-blue-300"
                            }`}
                          >
                            {code.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {formatDate(code.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              expired
                                ? "text-red-400"
                                : "text-gray-400"
                            }
                          >
                            {formatDate(code.expiresAt)}
                            {expired && (
                              <span className="ml-1 text-xs text-red-500">
                                (expired)
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {used
                            ? code.usedByName || "Unknown user"
                            : "\u2014"}
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {used ? (
                            formatDate(code.usedAt)
                          ) : (
                            <span className="text-green-400 text-xs">
                              Available
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
