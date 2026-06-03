import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  NEW:                "bg-gray-100 text-gray-700",
  NEEDS_REVIEW:       "bg-yellow-100 text-yellow-800",
  DUPLICATE:          "bg-orange-100 text-orange-700",
  APPROVED_FOR_DRAFT: "bg-blue-100 text-blue-800",
  REJECTED:           "bg-red-100 text-red-600",
  STORY_GENERATED:    "bg-green-100 text-green-800",
};

const STATUS_OPTIONS = [
  "NEW", "NEEDS_REVIEW", "DUPLICATE", "APPROVED_FOR_DRAFT", "REJECTED", "STORY_GENERATED",
] as const;

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: { status?: string; suppressed?: string };
}) {
  const filterStatus   = STATUS_OPTIONS.find((s) => s === searchParams.status);
  const showSuppressed = searchParams.suppressed === "true";

  const records = await prisma.parsedRecord.findMany({
    where: {
      ...(filterStatus ? { record_status: filterStatus } : {}),
      ...(!showSuppressed ? { is_suppressed: false } : {}),
    },
    orderBy: { created_at: "desc" },
    take: 100,
    include: {
      source:       { select: { name: true } },
      source_fetch: { select: { fetch_method: true } },
      _count: { select: { dedupe_flags: true } },
    },
  });

  const counts = await prisma.parsedRecord.groupBy({
    by: ["record_status"],
    _count: true,
    where: { is_suppressed: false },
  });
  const countMap = Object.fromEntries(counts.map((c) => [c.record_status, c._count]));
  const suppressedCount = await prisma.parsedRecord.count({ where: { is_suppressed: true } });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-headline font-bold">Imported Records</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review parsed arrest records before generating story drafts.
          </p>
        </div>
        <Link
          href="/admin/manual-source"
          className="bg-brand-red text-white text-sm font-bold px-4 py-2 rounded hover:bg-red-700"
        >
          + Manual Import
        </Link>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Link
          href="/admin/records"
          className={`text-xs px-3 py-1 rounded-full border font-medium ${
            !filterStatus ? "bg-brand-dark text-white border-brand-dark" : "border-gray-300 text-gray-600 hover:bg-gray-100"
          }`}
        >
          All
        </Link>
        {STATUS_OPTIONS.map((s) => (
          <Link
            key={s}
            href={`/admin/records?status=${s}`}
            className={`text-xs px-3 py-1 rounded-full border font-medium ${
              filterStatus === s ? "bg-brand-dark text-white border-brand-dark" : "border-gray-300 text-gray-600 hover:bg-gray-100"
            }`}
          >
            {s.replace(/_/g, " ")} {countMap[s] ? `(${countMap[s]})` : ""}
          </Link>
        ))}
        <Link
          href={`/admin/records?suppressed=true`}
          className="text-xs px-3 py-1 rounded-full border border-orange-300 text-orange-700 hover:bg-orange-50 font-medium"
        >
          Suppressed ({suppressedCount})
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 border-b">Person</th>
                <th className="text-left px-4 py-3 border-b">Date</th>
                <th className="text-left px-4 py-3 border-b">Agency / City</th>
                <th className="text-left px-4 py-3 border-b">Charges</th>
                <th className="text-center px-4 py-3 border-b">Conf.</th>
                <th className="text-center px-4 py-3 border-b">Status</th>
                <th className="text-left px-4 py-3 border-b">Source</th>
                <th className="text-center px-4 py-3 border-b">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((r) => (
                <tr key={r.id} className={`hover:bg-gray-50 ${r.is_suppressed ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium text-gray-800">
                      {r.person_name ?? <span className="text-gray-400 italic">Unknown</span>}
                    </p>
                    {r.booking_number && (
                      <p className="text-xs text-gray-400">#{r.booking_number}</p>
                    )}
                    {r.is_suppressed && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                        Suppressed
                      </span>
                    )}
                    {r._count.dedupe_flags > 0 && (
                      <span className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded ml-1">
                        Near-dup
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-gray-600">
                    {r.booking_date
                      ? new Date(r.booking_date).toLocaleDateString()
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="text-xs text-gray-700">{r.arresting_agency ?? "—"}</p>
                    <p className="text-xs text-gray-400">{r.city ?? r.county ?? "Broward"}</p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {(r.charges as string[]).slice(0, 2).map((c, i) => (
                      <p key={i} className="text-xs text-gray-700 truncate max-w-[200px]">{c}</p>
                    ))}
                    {(r.charges as string[]).length > 2 && (
                      <p className="text-xs text-gray-400">+{(r.charges as string[]).length - 2} more</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center align-top">
                    <span className={`text-xs font-bold ${
                      r.parser_confidence_score >= 0.8 ? "text-green-700"
                      : r.parser_confidence_score >= 0.6 ? "text-yellow-700"
                      : "text-red-600"
                    }`}>
                      {Math.round(r.parser_confidence_score * 100)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center align-top">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[r.record_status] ?? ""}`}>
                      {r.record_status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="text-xs text-gray-600">{r.source.name}</p>
                    <span className={`text-xs ${r.source_fetch.fetch_method === "LIVE" ? "text-purple-600" : r.source_fetch.fetch_method === "MOCK" ? "text-gray-400" : "text-orange-600"}`}>
                      {r.source_fetch.fetch_method}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center align-top">
                    <Link
                      href={`/admin/records/${r.id}`}
                      className="text-xs bg-gray-100 text-gray-700 border border-gray-200 px-2 py-1 rounded hover:bg-gray-200"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {records.length === 0 && (
          <p className="px-5 py-6 text-sm text-gray-400 italic">
            No records found. Import data using a source fetch or the Manual Import form.
          </p>
        )}
      </div>
    </div>
  );
}
