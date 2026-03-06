import { getDb } from "@/lib/db";
import { creatorApplications, profiles } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import ApplicationActions from "./ApplicationActions";

type ApplicationRow = {
  id: string;
  userId: string;
  name: string;
  bio: string;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  portfolioUrl: string | null;
  status: string;
  adminNote: string | null;
  createdAt: Date;
  applicantDisplayName: string | null;
};

export default async function ApplicationsPage() {
  const db = getDb();

  const rows = await db
    .select({
      id: creatorApplications.id,
      userId: creatorApplications.userId,
      name: creatorApplications.name,
      bio: creatorApplications.bio,
      instagramUrl: creatorApplications.instagramUrl,
      tiktokUrl: creatorApplications.tiktokUrl,
      portfolioUrl: creatorApplications.portfolioUrl,
      status: creatorApplications.status,
      adminNote: creatorApplications.adminNote,
      createdAt: creatorApplications.createdAt,
      applicantDisplayName: profiles.displayName,
    })
    .from(creatorApplications)
    .leftJoin(profiles, eq(creatorApplications.userId, profiles.id))
    .orderBy(desc(creatorApplications.createdAt));

  const applications: ApplicationRow[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    name: r.name,
    bio: r.bio,
    instagramUrl: r.instagramUrl,
    tiktokUrl: r.tiktokUrl,
    portfolioUrl: r.portfolioUrl,
    status: r.status,
    adminNote: r.adminNote,
    createdAt: r.createdAt,
    applicantDisplayName: r.applicantDisplayName,
  }));

  // Group: pending first, then approved/rejected
  const pending = applications.filter((a) => a.status === "pending");
  const reviewed = applications.filter((a) => a.status !== "pending");

  const formatDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const truncate = (text: string, max: number) =>
    text.length > max ? text.slice(0, max) + "..." : text;

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-900/50 text-yellow-300";
      case "approved":
        return "bg-green-900/50 text-green-300";
      case "rejected":
        return "bg-red-900/50 text-red-300";
      default:
        return "bg-gray-700 text-gray-300";
    }
  };

  function renderTable(apps: ApplicationRow[], showActions: boolean) {
    if (apps.length === 0) {
      return (
        <p className="text-sm text-gray-500">No applications in this group.</p>
      );
    }

    return (
      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-[#222] text-left text-xs uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Bio</th>
              <th className="px-4 py-3">Social</th>
              <th className="px-4 py-3">Portfolio</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted</th>
              {showActions && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => (
              <tr
                key={app.id}
                className="border-b border-gray-800 hover:bg-[#2a2a2a]"
              >
                <td className="px-4 py-3 font-medium text-gray-200">
                  {app.name}
                  {app.applicantDisplayName &&
                    app.applicantDisplayName !== app.name && (
                      <span className="ml-1 text-xs text-gray-500">
                        ({app.applicantDisplayName})
                      </span>
                    )}
                </td>
                <td className="max-w-xs px-4 py-3 text-gray-400">
                  {truncate(app.bio, 100)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {app.instagramUrl && (
                      <a
                        href={app.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-pink-400 hover:text-pink-300"
                        title="Instagram"
                      >
                        IG
                      </a>
                    )}
                    {app.tiktokUrl && (
                      <a
                        href={app.tiktokUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cyan-400 hover:text-cyan-300"
                        title="TikTok"
                      >
                        TT
                      </a>
                    )}
                    {!app.instagramUrl && !app.tiktokUrl && (
                      <span className="text-xs text-gray-600">&mdash;</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {app.portfolioUrl ? (
                    <a
                      href={app.portfolioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      View
                    </a>
                  ) : (
                    <span className="text-xs text-gray-600">&mdash;</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs ${statusBadge(app.status)}`}
                  >
                    {app.status}
                  </span>
                  {app.adminNote && (
                    <p className="mt-1 text-xs text-gray-500" title={app.adminNote}>
                      Note: {truncate(app.adminNote, 50)}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {formatDate(app.createdAt)}
                </td>
                {showActions && (
                  <td className="px-4 py-3">
                    <ApplicationActions applicationId={app.id} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-8 text-xl font-bold tracking-tight">
          Creator Applications
        </h1>

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-400">
            Pending Review ({pending.length})
          </h2>
          {renderTable(pending, true)}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-400">
            Reviewed ({reviewed.length})
          </h2>
          {renderTable(reviewed, false)}
        </section>
      </div>
    </div>
  );
}
