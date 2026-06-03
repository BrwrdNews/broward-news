/**
 * /admin/headlines — Headline Options Review Queue
 *
 * Lists every story that has at least one PENDING headline option,
 * grouped by urgency (stories nearest to publish first).
 */

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import HeadlineQueueClient from "@/components/HeadlineQueueClient";

export const dynamic = "force-dynamic";

const RISK_STYLES: Record<string, string> = {
  LOW:    "bg-green-100 text-green-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH:   "bg-red-100 text-red-700",
};

const APPROVAL_STYLES: Record<string, string> = {
  PENDING:  "bg-gray-100 text-gray-600",
  APPROVED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-600",
};

export default async function HeadlinesQueuePage() {
  // Stories with at least one PENDING headline, ordered by status urgency
  const stories = await prisma.story.findMany({
    where: {
      headlines: { some: { approval_status: "PENDING" } },
    },
    orderBy: [{ status: "asc" }, { updated_at: "desc" }],
    select: {
      id: true,
      slug: true,
      headline_standard: true,
      status: true,
      municipality: true,
      updated_at: true,
      headlines: {
        orderBy: [{ generation_batch: "desc" }, { catchiness_score: "desc" }],
        select: {
          id: true,
          headline_text: true,
          headline_type: true,
          factual_safety_score: true,
          catchiness_score: true,
          risk_level: true,
          approval_status: true,
          is_selected: true,
          is_blocked: true,
          generation_batch: true,
          reason_for_score: true,
        },
      },
    },
  });

  // Summary counts
  const totalPending = stories.reduce(
    (acc, s) => acc + s.headlines.filter((h) => h.approval_status === "PENDING").length,
    0
  );

  const statusColor: Record<string, string> = {
    DRAFT:          "bg-gray-200 text-gray-700",
    PENDING_REVIEW: "bg-yellow-100 text-yellow-800",
    APPROVED:       "bg-blue-100 text-blue-800",
    PUBLISHED:      "bg-green-100 text-green-800",
    REJECTED:       "bg-red-100 text-red-700",
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-headline font-bold">Headline Review Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            {stories.length === 0
              ? "All headline options have been reviewed."
              : `${stories.length} ${stories.length === 1 ? "story" : "stories"} with ${totalPending} pending headline option${totalPending !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          &larr; Dashboard
        </Link>
      </div>

      {stories.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          <p className="text-lg font-medium">No headlines pending review</p>
          <p className="mt-2 text-sm">
            Generate headline batches from individual story pages to see them here.
          </p>
          <Link
            href="/admin/stories"
            className="inline-block mt-4 bg-brand-red text-white text-sm font-bold px-4 py-2 rounded hover:bg-red-700 transition-colors"
          >
            Go to Stories
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {stories.map((story) => {
            const pendingHeadlines  = story.headlines.filter((h) => h.approval_status === "PENDING");
            const approvedHeadlines = story.headlines.filter((h) => h.approval_status === "APPROVED");
            const selectedHeadline  = story.headlines.find((h) => h.is_selected);

            return (
              <div key={story.id} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Story header */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[story.status]}`}>
                        {story.status.replace("_", " ")}
                      </span>
                      <span className="text-xs text-gray-400">
                        {story.municipality ?? "Broward County"} &middot; updated{" "}
                        {new Date(story.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-800 mt-1 leading-snug">
                      {story.headline_standard}
                    </p>
                    {selectedHeadline && (
                      <p className="text-xs text-blue-600 mt-1">
                        ✓ Selected: &ldquo;{selectedHeadline.headline_text}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {pendingHeadlines.length} pending · {approvedHeadlines.length} approved
                    </span>
                    <Link
                      href={`/admin/stories/${story.id}`}
                      className="text-xs bg-gray-100 text-gray-700 border border-gray-200 px-2 py-1 rounded hover:bg-gray-200 whitespace-nowrap"
                    >
                      Edit story &rarr;
                    </Link>
                  </div>
                </div>

                {/* Headline options table (interactive) */}
                <HeadlineQueueClient
                  storyId={story.id}
                  initialHeadlines={story.headlines.map((h) => ({
                    ...h,
                    story_id: story.id,
                    source_fields_used: [],
                    approved_by: null,
                    approved_at: null,
                    rejection_reason: null,
                    created_at: new Date().toISOString(),
                  }))}
                  riskStyles={RISK_STYLES}
                  approvalStyles={APPROVAL_STYLES}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
