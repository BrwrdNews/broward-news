import Link from "next/link";
import { getChargeCategory, CATEGORY_COLORS } from "@/lib/charge-categories";

export type StoryCardData = {
  id: string;
  slug: string;
  headline_chosen: string | null;
  headline_standard: string;
  deck: string | null;
  municipality: string | null;
  published_at: string | null;
  updated_at: string;
  charges: string[];
  source_name: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeSince(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Less than an hour ago";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

type Size = "hero" | "default" | "compact";

interface Props {
  story: StoryCardData;
  size?: Size;
  showUpdated?: boolean;
}

export default function StoryCard({ story, size = "default", showUpdated = false }: Props) {
  const headline = story.headline_chosen ?? story.headline_standard;
  const category = getChargeCategory(story.charges);
  const categoryColor = CATEGORY_COLORS[category];
  const location = story.municipality ?? "Broward County";
  const timestamp = showUpdated ? story.updated_at : story.published_at;

  if (size === "compact") {
    return (
      <Link href={`/stories/${story.slug}`} className="group flex gap-3 py-3 border-b border-gray-100 last:border-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 group-hover:text-brand-red transition-colors leading-snug line-clamp-2">
            {headline}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {location} &middot; {timeSince(timestamp)}
          </p>
        </div>
      </Link>
    );
  }

  if (size === "hero") {
    return (
      <article className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
        {/* Hero color band */}
        <div className="h-2 bg-brand-red" />
        <div className="p-6">
          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider bg-brand-red text-white px-2 py-0.5 rounded">
              Featured
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${categoryColor}`}>
              {category}
            </span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              {location}
            </span>
          </div>

          <Link href={`/stories/${story.slug}`} className="group block">
            <h2 className="text-2xl md:text-3xl font-headline font-bold text-brand-dark group-hover:text-brand-red transition-colors leading-tight mb-2">
              {headline}
            </h2>
            {story.deck && (
              <p className="text-base text-gray-600 leading-relaxed mb-4">
                {story.deck}
              </p>
            )}
          </Link>

          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 border-t border-gray-100 pt-3 mt-3">
            <span>Source: <strong className="text-gray-600">{story.source_name}</strong></span>
            {story.published_at && (
              <span>{formatDate(story.published_at)}</span>
            )}
            {story.charges.length > 0 && (
              <span>
                Charges:{" "}
                <span className="text-gray-600">
                  {story.charges.slice(0, 2).join(" · ")}
                  {story.charges.length > 2 ? ` +${story.charges.length - 2} more` : ""}
                </span>
              </span>
            )}
            <Link
              href={`/stories/${story.slug}`}
              className="ml-auto font-semibold text-brand-red hover:underline text-xs uppercase tracking-wide"
            >
              Read Report →
            </Link>
          </div>
        </div>
      </article>
    );
  }

  // default size
  return (
    <article className="border border-gray-200 rounded-lg overflow-hidden bg-white hover:shadow-sm transition-shadow">
      <div className="p-4">
        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${categoryColor}`}>
            {category}
          </span>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
            {location}
          </span>
        </div>

        <Link href={`/stories/${story.slug}`} className="group block">
          <h3 className="font-headline font-bold text-gray-900 group-hover:text-brand-red transition-colors leading-snug text-base mb-1">
            {headline}
          </h3>
          {story.deck && (
            <p className="text-sm text-gray-500 leading-snug line-clamp-2 mb-2">
              {story.deck}
            </p>
          )}
        </Link>

        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
          <span className="text-gray-500">{story.source_name}</span>
          <span>&middot;</span>
          <span>{showUpdated ? "Updated " : ""}{timeSince(timestamp)}</span>
          {story.charges.length > 0 && (
            <>
              <span>&middot;</span>
              <span className="text-gray-600 truncate max-w-[180px]">
                {story.charges[0]}
                {story.charges.length > 1 ? ` +${story.charges.length - 1}` : ""}
              </span>
            </>
          )}
          <Link
            href={`/stories/${story.slug}`}
            className="ml-auto font-semibold text-brand-red hover:underline"
          >
            Read →
          </Link>
        </div>
      </div>
    </article>
  );
}
