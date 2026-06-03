import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import StoryForm from "@/components/StoryForm";
import Link from "next/link";

export default async function EditStoryPage({
  params,
}: {
  params: { id: string };
}) {
  const story = await prisma.story.findUnique({ where: { id: params.id } });
  if (!story) notFound();

  const formData = {
    id: story.id,
    status: story.status,
    headline_standard: story.headline_standard,
    headline_catchy: story.headline_catchy,
    headline_chosen: story.headline_chosen ?? "",
    editorial_tone: story.editorial_tone,
    geography_focus: story.geography_focus,
    source_confidence_score: story.source_confidence_score,
    body: story.body,
    source_name: story.source_name,
    source_url: story.source_url ?? "",
    incident_date: story.incident_date
      ? story.incident_date.toISOString().split("T")[0]
      : "",
    arrest_date: story.arrest_date
      ? story.arrest_date.toISOString().split("T")[0]
      : "",
    subject_name: story.subject_name ?? "",
    subject_descriptor: story.subject_descriptor ?? "resident",
    editorial_tone_setting: (story.editorial_tone_setting ?? "SENSATIONAL_CAUTIOUS") as import("@/lib/types").EditorialTone,
    charges: story.charges,
    booking_number: story.booking_number ?? "",
    municipality: story.municipality ?? "",
    admin_notes: story.admin_notes ?? "",
  };

  const statusColor: Record<string, string> = {
    DRAFT: "bg-gray-200 text-gray-700",
    PENDING_REVIEW: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-blue-100 text-blue-800",
    PUBLISHED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-700",
  };

  return (
    <div>
      <div className="max-w-3xl mx-auto flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-headline font-bold">Edit Story</h1>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[story.status]}`}
            >
              {story.status.replace("_", " ")}
            </span>
            {story.status === "PUBLISHED" && (
              <Link
                href={`/stories/${story.slug}`}
                target="_blank"
                className="text-xs text-blue-600 hover:underline"
              >
                View live &rarr;
              </Link>
            )}
          </div>
        </div>
        <Link
          href="/admin/stories"
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          &larr; Back to Stories
        </Link>
      </div>
      <StoryForm mode="edit" initialData={formData} />
    </div>
  );
}
