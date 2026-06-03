import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import StoryCard, { type StoryCardData } from "@/components/StoryCard";
import TrendingModule from "@/components/TrendingModule";
import AdSlot from "@/components/AdSlot";
import { getChargeCategory, CATEGORY_COLORS } from "@/lib/charge-categories";

export const revalidate = 300;

export async function generateStaticParams() {
  const stories = await prisma.story.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true },
  });
  return stories.map((s) => ({ slug: s.slug }));
}

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

function toCardData(s: {
  id: string;
  slug: string;
  headline_chosen: string | null;
  headline_standard: string;
  municipality: string | null;
  published_at: Date | null;
  updated_at: Date;
  charges: string[];
  source_name: string;
  headlines: { deck: string | null }[];
}): StoryCardData {
  return {
    id: s.id,
    slug: s.slug,
    headline_chosen: s.headline_chosen,
    headline_standard: s.headline_standard,
    deck: s.headlines[0]?.deck ?? null,
    municipality: s.municipality,
    published_at: s.published_at?.toISOString() ?? null,
    updated_at: s.updated_at.toISOString(),
    charges: s.charges,
    source_name: s.source_name,
  };
}

const CARD_SELECT = {
  id: true,
  slug: true,
  headline_chosen: true,
  headline_standard: true,
  municipality: true,
  published_at: true,
  updated_at: true,
  charges: true,
  source_name: true,
  headlines: {
    where: { is_selected: true },
    select: { deck: true },
    take: 1,
  },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function StoryPage({
  params,
}: {
  params: { slug: string };
}) {
  const story = await prisma.story.findFirst({
    where: { slug: params.slug, status: "PUBLISHED" },
    include: {
      headlines: {
        where: { is_selected: true },
        select: { deck: true },
        take: 1,
      },
    },
  });

  if (!story) notFound();

  const headline = story.headline_chosen ?? story.headline_standard;
  const deck = story.headlines[0]?.deck ?? null;
  const category = getChargeCategory(story.charges);
  const categoryColor = CATEGORY_COLORS[category];

  const publishedStr = story.published_at
    ? new Date(story.published_at).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      })
    : null;
  const updatedStr = new Date(story.updated_at).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
  const arrestStr = story.arrest_date
    ? new Date(story.arrest_date).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      })
    : null;

  // Related stories: same city OR same source OR overlapping charges
  const relatedOrConditions = [
    ...(story.municipality ? [{ municipality: story.municipality }] : []),
    { source_name: story.source_name },
    ...(story.charges.length > 0
      ? [{ charges: { hasSome: story.charges.slice(0, 2) } }]
      : []),
  ];

  const [relatedRaw, trendingRaw, latestRaw] = await Promise.all([
    prisma.story.findMany({
      where: {
        status: "PUBLISHED",
        slug: { not: params.slug },
        OR: relatedOrConditions,
      },
      orderBy: { published_at: "desc" },
      take: 4,
      select: CARD_SELECT,
    }),
    prisma.story.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { published_at: "desc" },
      take: 5,
      select: CARD_SELECT,
    }),
    prisma.story.findMany({
      where: { status: "PUBLISHED", slug: { not: params.slug } },
      orderBy: { published_at: "desc" },
      take: 5,
      select: CARD_SELECT,
    }),
  ]);

  const related = relatedRaw.map(toCardData);
  const trending = trendingRaw.map(toCardData);
  const latest = latestRaw.map(toCardData);

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Article column ──────────────────────────────────────────── */}
          <article className="lg:col-span-2">

            {/* Breadcrumb */}
            <nav className="text-sm text-gray-400 mb-4 flex items-center gap-1">
              <Link href="/" className="hover:text-brand-red">Home</Link>
              <span>&rsaquo;</span>
              {story.municipality && (
                <>
                  <span className="hover:text-brand-red cursor-default">{story.municipality}</span>
                  <span>&rsaquo;</span>
                </>
              )}
              <span className="text-gray-500">Arrest Report</span>
            </nav>

            {/* Category + record badge */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="inline-block bg-brand-red text-white text-xs font-bold uppercase tracking-wider px-2 py-1 rounded">
                Arrest Report
              </span>
              <span className={`inline-block text-xs font-semibold px-2 py-1 rounded border ${categoryColor}`}>
                {category}
              </span>
              {story.municipality && (
                <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded border border-gray-200">
                  {story.municipality}
                </span>
              )}
            </div>

            {/* H1 */}
            <h1 className="text-3xl md:text-4xl font-headline font-bold leading-tight text-brand-dark mb-3">
              {headline}
            </h1>

            {/* Deck */}
            {deck && (
              <p className="text-lg text-gray-600 leading-relaxed border-l-4 border-brand-red pl-4 mb-4">
                {deck}
              </p>
            )}

            {/* Byline + dates */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-500 border-b border-gray-200 pb-4 mb-4">
              <span>By <strong className="text-gray-700">Broward News Desk</strong></span>
              {publishedStr && <span>Published {publishedStr}</span>}
              {updatedStr !== publishedStr && <span>Updated {updatedStr}</span>}
            </div>

            {/* Below-headline ad */}
            <AdSlot variant="infeed" />

            {/* Source attribution */}
            <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-6">
              <strong>Source:</strong>{" "}
              {story.source_url ? (
                <a
                  href={story.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-red underline"
                >
                  {story.source_name}
                </a>
              ) : (
                story.source_name
              )}
              {arrestStr && (
                <> &middot; <strong>Arrest date:</strong> {arrestStr}</>
              )}
            </p>

            {/* Body */}
            <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap mb-8">
              {story.body}
            </div>

            {/* Mid-article ad */}
            <AdSlot variant="mid-article" />

            {/* Booking details box */}
            {(story.booking_number || arrestStr || story.municipality) && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-3">
                  Booking Details
                </h2>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {story.municipality && (
                    <>
                      <dt className="text-gray-500 font-medium">Location</dt>
                      <dd className="text-gray-800">{story.municipality}</dd>
                    </>
                  )}
                  {arrestStr && (
                    <>
                      <dt className="text-gray-500 font-medium">Arrest Date</dt>
                      <dd className="text-gray-800">{arrestStr}</dd>
                    </>
                  )}
                  {story.booking_number && (
                    <>
                      <dt className="text-gray-500 font-medium">Booking #</dt>
                      <dd className="text-gray-800 font-mono text-xs">{story.booking_number}</dd>
                    </>
                  )}
                  <dt className="text-gray-500 font-medium">Source</dt>
                  <dd className="text-gray-800">{story.source_name}</dd>
                </dl>
              </div>
            )}

            {/* Charges box */}
            {story.charges.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-2">
                  Listed Charges
                </h2>
                <p className="text-xs text-gray-400 mb-3">
                  Charges are listed exactly as they appear in public booking records.
                  A listed charge is not a finding of guilt.
                </p>
                <ul className="space-y-1.5">
                  {story.charges.map((charge, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                      <span className="mt-1 w-4 h-4 shrink-0 rounded-full bg-gray-200 text-gray-600 text-xs flex items-center justify-center font-bold">
                        {i + 1}
                      </span>
                      {charge}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Presumption of innocence */}
            <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-4 mb-6">
              <p className="text-sm font-bold text-yellow-900 mb-1">Presumption of Innocence</p>
              <p className="text-sm text-yellow-800 leading-relaxed">
                An arrest or booking record is not a conviction and does not imply guilt.
                All individuals named in this report are presumed innocent unless and
                until proven guilty in a court of law. Charges may be reduced, dismissed,
                or result in acquittal.
              </p>
            </div>

            {/* Correction / removal */}
            <div className="text-xs text-gray-400 border border-gray-200 rounded p-3 mb-8">
              <strong className="text-gray-600">Correction or removal request:</strong>{" "}
              If you believe this record contains an error, or if you are the subject of
              this report and wish to request removal, please{" "}
              <a href="mailto:corrections@browardnews.local" className="text-brand-red underline">
                contact our corrections desk
              </a>
              . We review all requests within 5 business days.
            </div>

            {/* Related stories */}
            {related.length > 0 && (
              <section className="mb-8">
                <div className="flex items-center border-b-2 border-brand-red pb-2 mb-4">
                  <h2 className="text-lg font-headline font-bold text-brand-dark">Related Stories</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {related.map((s) => (
                    <StoryCard key={s.id} story={s} size="default" />
                  ))}
                </div>
              </section>
            )}

          </article>

          {/* ── Right rail ──────────────────────────────────────────────── */}
          <aside className="space-y-0">
            <TrendingModule title="Trending Now" stories={trending} />
            <AdSlot variant="rail" />
            <TrendingModule title="Latest Broward Records" stories={latest} />
          </aside>

        </div>
      </main>

      {/* Mobile sticky ad */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-gray-200">
        <AdSlot variant="sticky-mobile" />
      </div>

      <SiteFooter />
    </div>
  );
}
