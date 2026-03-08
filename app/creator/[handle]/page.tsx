import { db } from "@/lib/db";
import { profiles, creatorApplications, products } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Initials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full bg-[#2a2a2a] text-4xl font-bold text-gray-500">
      {initials || "?"}
    </div>
  );
}

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  // Find the creator profile by handle
  const [profile] = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.handle, handle), eq(profiles.role, "creator")))
    .limit(1);

  if (!profile) {
    notFound();
  }

  // Get their approved creator application for bio and social links
  const [application] = await db
    .select()
    .from(creatorApplications)
    .where(
      and(
        eq(creatorApplications.userId, profile.id),
        eq(creatorApplications.status, "approved"),
      ),
    )
    .limit(1);

  // Get their shared designs (publicly visible on creator profile)
  const designs = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.userId, profile.id),
        eq(products.shared, true),
      ),
    );

  return (
    <div className="min-h-screen bg-[#111] px-4 py-12">
      <div className="mx-auto max-w-2xl">
        {/* Profile Header */}
        <div className="flex flex-col items-center text-center">
          <div className="overflow-hidden rounded-full border-2 border-gray-700">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt={profile.displayName ?? handle}
                className="h-[120px] w-[120px] object-cover"
              />
            ) : (
              <Initials name={profile.displayName ?? handle} />
            )}
          </div>

          <h1 className="mt-4 text-2xl font-bold text-white">
            {profile.displayName ?? handle}
          </h1>

          {application?.bio && (
            <p className="mt-3 max-w-lg text-gray-400">{application.bio}</p>
          )}

          {/* Social Links */}
          {application && (
            <div className="mt-4 flex items-center gap-4">
              {application.instagramUrl && (
                <a
                  href={application.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-gray-600 px-3 py-1 text-xs text-gray-400 transition-colors hover:border-gray-400 hover:text-white"
                >
                  Instagram
                </a>
              )}
              {application.tiktokUrl && (
                <a
                  href={application.tiktokUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-gray-600 px-3 py-1 text-xs text-gray-400 transition-colors hover:border-gray-400 hover:text-white"
                >
                  TikTok
                </a>
              )}
              {application.portfolioUrl && (
                <a
                  href={application.portfolioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-gray-600 px-3 py-1 text-xs text-gray-400 transition-colors hover:border-gray-400 hover:text-white"
                >
                  Portfolio
                </a>
              )}
            </div>
          )}
        </div>

        {/* Designs Grid */}
        <div className="mt-12">
          <h2 className="mb-6 text-lg font-semibold text-white">Designs</h2>

          {designs.length === 0 ? (
            <div className="rounded-lg border border-gray-800 bg-[#1a1a1a] p-8 text-center">
              <p className="text-gray-400">No published designs yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {designs.map((design) => (
                <div
                  key={design.id}
                  className="rounded-lg border border-gray-800 bg-[#1a1a1a] p-4 transition-colors hover:border-gray-700"
                >
                  <div className="mb-3 flex h-32 items-center justify-center rounded bg-[#2a2a2a] text-xs text-gray-600">
                    Preview
                  </div>
                  <h3 className="truncate text-sm font-medium text-white">
                    {design.name}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatDate(design.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
