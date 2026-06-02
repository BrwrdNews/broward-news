import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function AdminDashboard() {
  const [drafts, pending, approved, published, rejected] = await Promise.all([
    prisma.story.count({ where: { status: "DRAFT" } }),
    prisma.story.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.story.count({ where: { status: "APPROVED" } }),
    prisma.story.count({ where: { status: "PUBLISHED" } }),
    prisma.story.count({ where: { status: "REJECTED" } }),
  ]);

  const recent = await prisma.story.findMany({
    orderBy: { updated_at: "desc" },
    take: 10,
    select: {
      id: true,
      slug: true,
      headline_standard: true,
      status: true,
      municipality: true,
      updated_at: true,
    },
  });

  const statusColor: Record<string, string> = {
    DRAFT: "bg-gray-200 text-gray-700",
    PENDING_REVIEW: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-blue-100 text-blue-800",
    PUBLISHED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-700",
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-headline font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Drafts", count: drafts, status: "DRAFT" },
          { label: "Pending Review", count: pending, status: "PENDING_REVIEW" },
          { label: "Approved", count: approved, status: "APPROVED" },
          { label: "Published", count: published, status: "PUBLISHED" },
          { label: "Rejected", count: rejected, status: "REJECTED" },
        ].map((s) => (
          <Link
            key={s.status}
            href={`/admin/stories?status=${s.status}`}
            className="bg-white rounded-lg shadow p-4 text-center hover:shadow-md transition-shadow"
          >
            <p className="text-3xl font-bold text-brand-dark">{s.count}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">Recent Stories</h2>
          <Link
            href="/admin/stories/new"
            className="text-sm bg-brand-red text-white px-3 py-1 rounded hover:bg-red-700 transition-colors"
          >
            + New Story
          </Link>
        </div>
        <ul className="divide-y divide-gray-100">
          {recent.map((story) => (
            <li key={story.id}>
              <Link
                href={`/admin/stories/${story.id}`}
                className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800 line-clamp-1">
                    {story.headline_standard}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {story.municipality ?? "Broward County"} &middot;{" "}
                    {new Date(story.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ml-4 whitespace-nowrap ${statusColor[story.status]}`}
                >
                  {story.status.replace("_", " ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
