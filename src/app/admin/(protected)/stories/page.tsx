import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { StoryStatus } from "@/lib/types";

const STATUS_OPTIONS: StoryStatus[] = [
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "PUBLISHED",
  "REJECTED",
];

const statusColor: Record<string, string> = {
  DRAFT: "bg-gray-200 text-gray-700",
  PENDING_REVIEW: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-blue-100 text-blue-800",
  PUBLISHED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-700",
};

export default async function StoriesListPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const filterStatus = STATUS_OPTIONS.includes(
    searchParams.status as StoryStatus
  )
    ? (searchParams.status as StoryStatus)
    : undefined;

  const stories = await prisma.story.findMany({
    where: filterStatus ? { status: filterStatus } : undefined,
    orderBy: { updated_at: "desc" },
    select: {
      id: true,
      headline_standard: true,
      headline_catchy: true,
      status: true,
      municipality: true,
      source_confidence_score: true,
      updated_at: true,
      subject_name: true,
    },
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-headline font-bold">Stories</h1>
        <Link
          href="/admin/stories/new"
          className="bg-brand-red text-white text-sm font-bold px-4 py-2 rounded hover:bg-red-700 transition-colors"
        >
          + New Story
        </Link>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <Link
          href="/admin/stories"
          className={`text-xs px-3 py-1 rounded-full border font-medium ${!filterStatus ? "bg-brand-dark text-white border-brand-dark" : "border-gray-300 text-gray-600 hover:bg-gray-100"}`}
        >
          All
        </Link>
        {STATUS_OPTIONS.map((s) => (
          <Link
            key={s}
            href={`/admin/stories?status=${s}`}
            className={`text-xs px-3 py-1 rounded-full border font-medium ${filterStatus === s ? "bg-brand-dark text-white border-brand-dark" : "border-gray-300 text-gray-600 hover:bg-gray-100"}`}
          >
            {s.replace("_", " ")}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {stories.length === 0 ? (
          <p className="p-6 text-gray-400 italic">No stories found.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {stories.map((story) => (
              <li key={story.id}>
                <Link
                  href={`/admin/stories/${story.id}`}
                  className="flex items-start justify-between px-6 py-4 hover:bg-gray-50 transition-colors gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {story.headline_standard}
                    </p>
                    <p className="text-xs text-brand-red italic truncate mt-0.5">
                      {story.headline_catchy}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {story.subject_name ?? "—"} &middot;{" "}
                      {story.municipality ?? "Broward County"} &middot; Confidence:{" "}
                      {Math.round(story.source_confidence_score * 100)}%
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[story.status]}`}
                    >
                      {story.status.replace("_", " ")}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(story.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
