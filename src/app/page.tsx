import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

export default async function HomePage() {
  const stories = await prisma.story.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { published_at: "desc" },
    take: 20,
    select: {
      id: true,
      slug: true,
      headline_chosen: true,
      headline_standard: true,
      municipality: true,
      published_at: true,
      subject_name: true,
      charges: true,
    },
  });

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-brand-dark text-white py-4 px-6 border-b-4 border-brand-red">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-headline font-bold tracking-tight">
            BROWARD NEWS
          </Link>
          <span className="text-sm text-gray-400">
            Fort Lauderdale &amp; Broward County, FL
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-headline font-bold mb-6 border-b-2 border-brand-red pb-2">
          Latest Public Safety Reports
        </h1>

        {stories.length === 0 ? (
          <p className="text-gray-500 italic">No published stories yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {stories.map((story) => {
              const headline = story.headline_chosen ?? story.headline_standard;
              return (
                <li key={story.id} className="py-5">
                  <Link
                    href={`/stories/${story.slug}`}
                    className="group block"
                  >
                    <h2 className="text-lg font-headline font-semibold text-brand-dark group-hover:text-brand-red transition-colors leading-snug">
                      {headline}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {story.municipality ?? "Broward County"} &middot;{" "}
                      {story.published_at
                        ? new Date(story.published_at).toLocaleDateString(
                            "en-US",
                            { month: "long", day: "numeric", year: "numeric" }
                          )
                        : ""}
                    </p>
                    {story.charges.length > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        Charges:{" "}
                        <span className="font-medium">
                          {story.charges.slice(0, 2).join(", ")}
                          {story.charges.length > 2 ? " + more" : ""}
                        </span>
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <footer className="border-t border-gray-200 mt-12 py-6 px-6 text-center text-xs text-gray-400">
        <p>
          All arrest records are public information. An arrest is not a conviction.
          All individuals are presumed innocent unless proven guilty in a court of law.
        </p>
        <p className="mt-1">
          &copy; {new Date().getFullYear()} Broward News. For corrections or removal
          requests, contact us.
        </p>
      </footer>
    </div>
  );
}
