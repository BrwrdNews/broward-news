import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  SUCCESS:     "bg-green-100 text-green-800",
  PARTIAL:     "bg-yellow-100 text-yellow-800",
  FAILED:      "bg-red-100 text-red-700",
  SKIPPED:     "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
};

const METHOD_STYLES: Record<string, string> = {
  LIVE:   "bg-purple-100 text-purple-700",
  MANUAL: "bg-orange-100 text-orange-700",
  MOCK:   "bg-gray-100 text-gray-600",
};

function durationMs(start: Date, end: Date | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default async function SourceFetchesPage({
  searchParams,
}: {
  searchParams: { sourceId?: string };
}) {
  const fetches = await prisma.sourceFetch.findMany({
    where: searchParams.sourceId ? { source_id: searchParams.sourceId } : undefined,
    orderBy: { started_at: "desc" },
    take: 100,
    include: {
      source:  { select: { name: true, source_type: true } },
      _count:  { select: { errors: true, records: true } },
    },
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-headline font-bold">Fetch History</h1>
          {searchParams.sourceId && (
            <Link href="/admin/source-fetches" className="text-sm text-brand-red hover:underline mt-1 block">
              ← Show all sources
            </Link>
          )}
        </div>
        <Link href="/admin/sources" className="text-sm text-gray-500 hover:text-gray-800">
          ← Sources
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 border-b">Source</th>
                <th className="text-center px-4 py-3 border-b">Method</th>
                <th className="text-center px-4 py-3 border-b">Status</th>
                <th className="text-right px-4 py-3 border-b">Found</th>
                <th className="text-right px-4 py-3 border-b">Imported</th>
                <th className="text-right px-4 py-3 border-b">Skipped</th>
                <th className="text-right px-4 py-3 border-b">Errors</th>
                <th className="text-left px-4 py-3 border-b">Started</th>
                <th className="text-right px-4 py-3 border-b">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fetches.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium text-gray-800">{f.source.name}</p>
                    {f.error_message && (
                      <p className="text-xs text-red-500 mt-0.5 max-w-xs truncate" title={f.error_message}>
                        {f.error_message}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center align-top">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${METHOD_STYLES[f.fetch_method] ?? ""}`}>
                      {f.fetch_method}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center align-top">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[f.status] ?? ""}`}>
                      {f.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right align-top text-gray-600">{f.records_found}</td>
                  <td className="px-4 py-3 text-right align-top font-medium text-green-700">{f.records_imported}</td>
                  <td className="px-4 py-3 text-right align-top text-gray-500">{f.records_skipped}</td>
                  <td className="px-4 py-3 text-right align-top">
                    {f._count.errors > 0 ? (
                      <span className="text-red-600 font-semibold">{f._count.errors}</span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-gray-500">
                    {new Date(f.started_at).toLocaleDateString()}{" "}
                    {new Date(f.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-3 text-right align-top text-xs text-gray-500">
                    {durationMs(f.started_at, f.completed_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {fetches.length === 0 && (
          <p className="px-5 py-6 text-sm text-gray-400 italic">No fetch runs yet.</p>
        )}
      </div>
    </div>
  );
}
