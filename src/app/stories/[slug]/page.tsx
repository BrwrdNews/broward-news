import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 300;

export async function generateStaticParams() {
  const stories = await prisma.story.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true },
  });
  return stories.map((s) => ({ slug: s.slug }));
}

export default async function StoryPage({
  params,
}: {
  params: { slug: string };
}) {
  const story = await prisma.story.findFirst({
    where: { slug: params.slug, status: "PUBLISHED" },
  });

  if (!story) notFound();

  const headline = story.headline_chosen ?? story.headline_standard;

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-brand-dark text-white py-4 px-6 border-b-4 border-brand-red">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-headline font-bold tracking-tight">
            BROWARD NEWS
          </Link>
          <span className="text-sm text-gray-400">
            Fort Lauderdale &amp; Broward County, FL
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <nav className="text-sm text-gray-400 mb-6">
          <Link href="/" className="hover:text-brand-red">Home</Link> &rsaquo; Public Safety
        </nav>

        <span className="inline-block bg-brand-red text-white text-xs font-bold uppercase tracking-wider px-2 py-1 mb-4">
          Arrest Report
        </span>

        <h1 className="text-3xl font-headline font-bold leading-tight mb-4">
          {headline}
        </h1>

        <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-6 border-b border-gray-200 pb-4">
          {story.municipality && (
            <span>
              <strong>Location:</strong> {story.municipality}
            </span>
          )}
          {story.arrest_date && (
            <span>
              <strong>Arrest date:</strong>{" "}
              {new Date(story.arrest_date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
          <span>
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
          </span>
        </div>

        {story.charges.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-2">
              Listed Charges
            </h2>
            <ul className="list-disc list-inside text-sm space-y-1">
              {story.charges.map((charge, i) => (
                <li key={i}>{charge}</li>
              ))}
            </ul>
            {story.booking_number && (
              <p className="text-xs text-gray-400 mt-3">
                Booking #: {story.booking_number}
              </p>
            )}
          </div>
        )}

        <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap">
          {story.body}
        </div>

        <div className="mt-10 bg-yellow-50 border-l-4 border-yellow-400 p-4 text-sm text-yellow-900">
          <strong>Legal Notice:</strong> An arrest or criminal charge is not a conviction.
          The individual is presumed innocent unless proven guilty in court.
        </div>

        <div className="mt-6 text-xs text-gray-400">
          <p>
            To request a correction or removal of this story, please{" "}
            <a href="mailto:corrections@browardnews.local" className="underline">
              contact us
            </a>
            .
          </p>
        </div>
      </main>

      <footer className="border-t border-gray-200 mt-12 py-6 px-6 text-center text-xs text-gray-400">
        <p>
          All arrest records are public information. An arrest is not a conviction.
          All individuals are presumed innocent unless proven guilty in a court of law.
        </p>
      </footer>
    </div>
  );
}
