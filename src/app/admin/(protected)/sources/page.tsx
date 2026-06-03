import { prisma } from "@/lib/prisma";
import Link from "next/link";
import SourceFetchButton from "@/components/SourceFetchButton";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  BSO_BOOKING_REGISTER:   "BSO Booking Register",
  BSO_BOOKING_BLOTTER:    "BSO Booking Blotter",
  FLPD_NEWS_RELEASES:     "FLPD News Releases",
  BROWARD_CLERK_MANUAL:   "Broward Clerk (Manual)",
  MANUAL_ADMIN_SUBMISSION:"Manual Submission",
};

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: "text-green-700",
  PARTIAL: "text-yellow-700",
  FAILED:  "text-red-600",
  SKIPPED: "text-gray-500",
  IN_PROGRESS: "text-blue-600",
};

function StaleWarning({ lastFetched }: { lastFetched: Date | null }) {
  if (!lastFetched) return null;
  const ageH = (Date.now() - lastFetched.getTime()) / 3_600_000;
  if (ageH < 24) return null;
  return (
    <span className="text-xs text-orange-600 font-medium ml-1">
      ⚠ {Math.floor(ageH)}h old
    </span>
  );
}

export default async function SourcesPage() {
  const sources = await prisma.source.findMany({
    orderBy: { created_at: "asc" },
    include: { _count: { select: { fetches: true, records: true } } },
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-headline font-bold">Sources</h1>
          <p className="text-sm text-gray-500 mt-1">
            Approved public record sources for Broward County ingestion.
          </p>
        </div>
        <Link
          href="/admin/manual-source"
          className="bg-brand-red text-white text-sm font-bold px-4 py-2 rounded hover:bg-red-700 transition-colors"
        >
          + Manual Import
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="text-left px-5 py-3 border-b">Source</th>
              <th className="text-left px-4 py-3 border-b">Type</th>
              <th className="text-center px-4 py-3 border-b">Enabled</th>
              <th className="text-left px-4 py-3 border-b">Last Fetch</th>
              <th className="text-center px-4 py-3 border-b">Records</th>
              <th className="text-center px-4 py-3 border-b">Fetches</th>
              <th className="text-center px-4 py-3 border-b">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sources.map((s) => (
              <tr key={s.id} className={s.is_enabled ? "" : "opacity-50"}>
                <td className="px-5 py-3 align-top">
                  <p className="font-medium text-gray-800">{s.name}</p>
                  {s.description && (
                    <p className="text-xs text-gray-400 mt-0.5">{s.description}</p>
                  )}
                  {s.requires_manual && (
                    <span className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 px-1.5 py-0.5 rounded mt-1 inline-block">
                      Manual only
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  <span className="text-xs text-gray-600">
                    {TYPE_LABELS[s.source_type] ?? s.source_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-center align-top">
                  <span className={`text-xs font-semibold ${s.is_enabled ? "text-green-700" : "text-gray-400"}`}>
                    {s.is_enabled ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-4 py-3 align-top">
                  {s.last_fetched_at ? (
                    <div className="flex items-center flex-wrap gap-1">
                      <span className={`text-xs ${STATUS_STYLES[s.last_fetch_status ?? ""] ?? "text-gray-500"}`}>
                        {s.last_fetch_status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(s.last_fetched_at).toLocaleDateString()}
                      </span>
                      <StaleWarning lastFetched={new Date(s.last_fetched_at)} />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Never</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center align-top">
                  <span className="text-sm font-medium text-gray-700">
                    {s.total_records_imported}
                  </span>
                </td>
                <td className="px-4 py-3 text-center align-top text-xs text-gray-500">
                  {s._count.fetches}
                </td>
                <td className="px-4 py-3 text-center align-top">
                  <div className="flex flex-col gap-1.5 items-center">
                    <SourceFetchButton sourceId={s.id} disabled={!s.is_enabled} />
                    <Link
                      href={`/admin/source-fetches?sourceId=${s.id}`}
                      className="text-xs text-gray-500 hover:text-gray-800 underline"
                    >
                      History
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sources.length === 0 && (
          <p className="px-5 py-6 text-sm text-gray-400 italic">
            No sources configured. Run <code>npm run db:seed</code> to add the default sources.
          </p>
        )}
      </div>

      {/* Source policy notice */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-800">
        <p className="font-semibold mb-1">Source Policy</p>
        <p>
          All data is sourced from official Broward County and City of Fort Lauderdale public records.
          This includes arrest booking registers, police department news releases, and court filings
          that are available under Florida public records law (§ 119.07, F.S.).
          Data may be updated or corrected at any time.
          Individuals listed are presumed innocent unless convicted.
          To request a correction or removal, contact us.
        </p>
      </div>
    </div>
  );
}
