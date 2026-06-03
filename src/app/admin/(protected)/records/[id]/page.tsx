import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import RecordActions from "@/components/RecordActions";

export const dynamic = "force-dynamic";

export default async function RecordDetailPage({ params }: { params: { id: string } }) {
  const record = await prisma.parsedRecord.findUnique({
    where: { id: params.id },
    include: {
      source: true,
      source_fetch: true,
      dedupe_flags: {
        include: {
          duplicate_record: {
            select: { id: true, person_name: true, booking_date: true, record_status: true, booking_number: true },
          },
        },
      },
    },
  });
  if (!record) notFound();

  const charges = record.charges as string[];

  const STATUS_STYLES: Record<string, string> = {
    NEW:                "bg-gray-100 text-gray-700",
    NEEDS_REVIEW:       "bg-yellow-100 text-yellow-800",
    DUPLICATE:          "bg-orange-100 text-orange-700",
    APPROVED_FOR_DRAFT: "bg-blue-100 text-blue-800",
    REJECTED:           "bg-red-100 text-red-600",
    STORY_GENERATED:    "bg-green-100 text-green-800",
  };

  const retrievedAge = Math.round(
    (Date.now() - new Date(record.retrieved_at).getTime()) / 3_600_000
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin/records" className="text-sm text-gray-400 hover:text-gray-700">
            ← Records
          </Link>
          <h1 className="text-2xl font-headline font-bold mt-1">
            {record.person_name ?? "Unknown Subject"}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[record.record_status] ?? ""}`}>
              {record.record_status.replace(/_/g, " ")}
            </span>
            {record.is_suppressed && (
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                Suppressed — {record.suppression_reason}
              </span>
            )}
            {retrievedAge > 24 && (
              <span className="text-xs text-orange-600">⚠ Source data is {retrievedAge}h old</span>
            )}
          </div>
        </div>
        {record.story_id && (
          <Link
            href={`/admin/stories/${record.story_id}`}
            className="text-sm bg-green-600 text-white font-bold px-3 py-1.5 rounded hover:bg-green-700"
          >
            View Story Draft →
          </Link>
        )}
      </div>

      {/* Parsed fields */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4 mb-4">
        <h2 className="font-semibold text-gray-700 border-b pb-2">Parsed Fields</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {[
            { label: "Person Name",      value: record.person_name },
            { label: "Booking Date",     value: record.booking_date ? new Date(record.booking_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null },
            { label: "Booking Number",   value: record.booking_number },
            { label: "Arresting Agency", value: record.arresting_agency },
            { label: "City",             value: record.city },
            { label: "County",           value: record.county },
            { label: "Bond",             value: record.bond },
            { label: "Release Status",   value: record.release_status },
            { label: "Court Case #",     value: record.court_case_number },
            { label: "Parser",           value: record.parser_name },
            { label: "Confidence",       value: `${Math.round(record.parser_confidence_score * 100)}%` },
          ].map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-gray-500 font-medium">{label}</dt>
              <dd className="text-gray-800 mt-0.5">{value ?? <span className="text-gray-400">—</span>}</dd>
            </div>
          ))}
        </dl>

        {/* Charges */}
        <div>
          <p className="text-xs text-gray-500 font-medium mb-1">Charges</p>
          {charges.length > 0 ? (
            <ul className="list-disc list-inside space-y-1">
              {charges.map((c, i) => <li key={i} className="text-sm text-gray-800">{c}</li>)}
            </ul>
          ) : <p className="text-sm text-gray-400">None listed</p>}
        </div>

        {/* Court case link */}
        {record.court_case_url && (
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">Court Record URL</p>
            <a href={record.court_case_url} target="_blank" rel="noopener noreferrer"
               className="text-sm text-blue-600 hover:underline break-all">
              {record.court_case_url}
            </a>
          </div>
        )}
      </div>

      {/* Source provenance */}
      <div className="bg-white rounded-lg shadow p-6 mb-4">
        <h2 className="font-semibold text-gray-700 border-b pb-2 mb-3">Source Provenance</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <p className="text-xs text-gray-500 font-medium">Source</p>
            <p className="text-gray-800">{record.source.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Fetch Method</p>
            <p className="text-gray-800">{record.source_fetch.fetch_method}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Retrieved</p>
            <p className="text-gray-800">
              {new Date(record.retrieved_at).toLocaleString()}
              {retrievedAge > 24 && <span className="text-orange-600 ml-1 text-xs">({retrievedAge}h ago)</span>}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Source URL</p>
            {record.source_url ? (
              <a href={record.source_url} target="_blank" rel="noopener noreferrer"
                 className="text-xs text-blue-600 hover:underline break-all">
                {record.source_url}
              </a>
            ) : <p className="text-gray-400">—</p>}
          </div>
        </div>
      </div>

      {/* Duplicate flags */}
      {record.dedupe_flags.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
          <h2 className="font-semibold text-orange-800 mb-2">Near-Duplicate Flags</h2>
          {record.dedupe_flags.map((d) => (
            <div key={d.id} className="text-sm text-orange-800 flex items-center justify-between">
              <div>
                <span className="font-medium">{d.duplicate_record.person_name ?? "Unknown"}</span>
                {d.duplicate_record.booking_date && (
                  <span className="text-xs ml-2 text-orange-600">
                    {new Date(d.duplicate_record.booking_date).toLocaleDateString()}
                  </span>
                )}
                <span className="text-xs ml-2 bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                  {Math.round(d.similarity_score * 100)}% match on: {d.match_fields.join(", ")}
                </span>
              </div>
              <Link
                href={`/admin/records/${d.duplicate_record.id}`}
                className="text-xs text-blue-600 hover:underline ml-4"
              >
                View
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <RecordActions
        recordId={record.id}
        currentStatus={record.record_status}
        isSuppressed={record.is_suppressed}
        hasStory={!!record.story_id}
      />

      {/* Raw text */}
      {record.raw_text && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
            Show raw source text
          </summary>
          <pre className="mt-2 bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-600 overflow-x-auto max-h-64 whitespace-pre-wrap">
            {record.raw_text}
          </pre>
        </details>
      )}
    </div>
  );
}
