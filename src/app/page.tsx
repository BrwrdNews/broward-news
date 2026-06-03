import { prisma } from "@/lib/prisma";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import StoryCard, { type StoryCardData } from "@/components/StoryCard";
import TrendingModule from "@/components/TrendingModule";
import AdSlot from "@/components/AdSlot";
import { getChargeCategory } from "@/lib/charge-categories";

export const revalidate = 60;

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

async function fetchPublished(take: number): Promise<StoryCardData[]> {
  const rows = await prisma.story.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { published_at: "desc" },
    take,
    select: {
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
    },
  });

  return rows.map((s) => ({
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
  }));
}

async function fetchRecentlyUpdated(take: number): Promise<StoryCardData[]> {
  const rows = await prisma.story.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { updated_at: "desc" },
    take,
    select: {
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
    },
  });

  return rows.map((s) => ({
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
  }));
}

// ---------------------------------------------------------------------------
// Section component
// ---------------------------------------------------------------------------

function SectionGrid({
  title,
  stories,
  viewAllHref,
}: {
  title: string;
  stories: StoryCardData[];
  viewAllHref?: string;
}) {
  if (stories.length === 0) return null;
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between border-b-2 border-brand-red pb-2 mb-4">
        <h2 className="text-xl font-headline font-bold text-brand-dark">{title}</h2>
        {viewAllHref && (
          <a href={viewAllHref} className="text-xs text-brand-red font-semibold uppercase tracking-wide hover:underline">
            View all →
          </a>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stories.slice(0, 3).map((story) => (
          <StoryCard key={story.id} story={story} size="default" />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function HomePage() {
  const [allStories, recentlyUpdated] = await Promise.all([
    fetchPublished(36),
    fetchRecentlyUpdated(6),
  ]);

  const [featured, ...feedStories] = allStories;

  // Sidebar modules — placeholder logic until analytics is wired up
  // "Trending Now" = most recent 5 (newest = most likely to be trending)
  const trending = allStories.slice(0, 5);
  // "Most Viewed Today" = next 5 (stable server render, swap for analytics later)
  const mostViewed = allStories.slice(5, 10);

  // Category slices
  const byCategory = (cat: string) =>
    allStories.filter((s) => getChargeCategory(s.charges) === cat);
  const byCity = (q: string) =>
    allStories.filter((s) => s.municipality?.toLowerCase().includes(q));

  const ftlStories     = byCity("fort lauderdale");
  const browardStories = allStories.filter(
    (s) => !s.municipality?.toLowerCase().includes("fort lauderdale")
  );
  const duiStories     = byCategory("DUI");
  const drugStories    = byCategory("Drug");
  const theftStories   = byCategory("Theft");
  const batteryStories = byCategory("Battery");

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />

      {/* Top leaderboard ad */}
      <div className="bg-white border-b border-gray-200 py-2">
        <div className="max-w-7xl mx-auto px-4">
          <AdSlot variant="leaderboard" />
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* ── Hero + right rail ─────────────────────────────────────────── */}
        {allStories.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            <div className="lg:col-span-2">
              {featured && <StoryCard story={featured} size="hero" />}
            </div>
            <aside className="space-y-0">
              <TrendingModule title="Trending Now" stories={trending} />
              <AdSlot variant="rail" />
              <TrendingModule title="Most Viewed Today" stories={mostViewed} />
            </aside>
          </div>
        )}

        {/* ── Latest feed + sticky rail ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-2">
            <div className="flex items-center border-b-2 border-brand-red pb-2 mb-4">
              <h2 className="text-xl font-headline font-bold text-brand-dark">
                Latest Broward Bookings
              </h2>
            </div>

            {feedStories.length === 0 && (
              <p className="text-gray-500 italic text-sm">No additional stories published yet.</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {feedStories.map((story, i) => (
                <div key={story.id}>
                  <StoryCard story={story} size="default" />
                  {/* In-feed ad after every 6 cards */}
                  {(i + 1) % 6 === 0 && (
                    <div className="col-span-full mt-2">
                      <AdSlot variant="infeed" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <aside>
            <TrendingModule
              title="Recently Updated Records"
              stories={recentlyUpdated}
              showUpdated
            />
          </aside>
        </div>

        {/* ── Category / city sections ───────────────────────────────────── */}
        <SectionGrid title="Fort Lauderdale" stories={ftlStories} viewAllHref="/?city=fort-lauderdale" />
        <SectionGrid title="Broward County" stories={browardStories} viewAllHref="/?city=broward" />
        <SectionGrid title="DUI Charges" stories={duiStories} viewAllHref="/?section=charges&cat=dui" />
        <SectionGrid title="Drug Charges" stories={drugStories} viewAllHref="/?section=charges&cat=drug" />
        <SectionGrid title="Theft" stories={theftStories} viewAllHref="/?section=charges&cat=theft" />
        <SectionGrid title="Battery &amp; Assault" stories={batteryStories} viewAllHref="/?section=charges&cat=battery" />

        {/* ── Newsletter placeholder ─────────────────────────────────────── */}
        <section className="bg-brand-dark text-white rounded-lg p-8 text-center mb-10">
          <h2 className="text-xl font-headline font-bold mb-2">Get Broward Booking Alerts</h2>
          <p className="text-gray-400 text-sm mb-4">
            Be the first to know when new public safety records are published in your area.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center max-w-md mx-auto">
            <input
              type="email"
              placeholder="Your email address"
              className="flex-1 px-4 py-2 rounded text-gray-900 text-sm"
              disabled
            />
            <button
              type="button"
              className="bg-brand-red text-white font-bold px-6 py-2 rounded text-sm opacity-70 cursor-not-allowed"
              disabled
            >
              Subscribe — Coming Soon
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-3">Email alerts not yet active. Check back soon.</p>
        </section>

      </main>

      {/* Mobile sticky ad placeholder */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-gray-200">
        <AdSlot variant="sticky-mobile" />
      </div>

      <SiteFooter />
    </div>
  );
}
