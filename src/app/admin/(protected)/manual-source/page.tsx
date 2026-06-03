import ManualSourceForm from "@/components/ManualSourceForm";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function ManualSourcePage() {
  const sources = await prisma.source.findMany({
    where: { is_enabled: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, source_type: true },
  });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-headline font-bold">Manual Source Import</h1>
          <p className="text-sm text-gray-500 mt-1">
            Paste official source text (HTML, CSV, plain text, or JSON) to import
            structured arrest records without automated scraping.
          </p>
        </div>
        <Link href="/admin/records" className="text-sm text-gray-500 hover:text-gray-800">
          ← Records
        </Link>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
        <p className="font-semibold mb-1">Accepted formats</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li><strong>BSO Booking Register / Blotter:</strong> HTML table copied from BSO website, or CSV export, or plain-text list</li>
          <li><strong>FLPD News Releases:</strong> Copy the text of a press release</li>
          <li><strong>Broward Clerk:</strong> Paste a JSON object with case_number, defendant_name, charges, filing_date</li>
          <li><strong>CSV rows:</strong> Name, BookingDate, BookingNumber, Agency, City, Charge1, Bond</li>
          <li>PDF text: open the PDF, select all, copy, paste here</li>
        </ul>
      </div>

      <ManualSourceForm sources={sources} />

      {/* Compliance notice */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600">
        <p className="font-semibold mb-1">Compliance reminder</p>
        <p>
          Only paste content from official public records sources.
          Do not enter data from paywalled, login-protected, or CAPTCHA-guarded systems.
          All imported records remain in DRAFT status until reviewed and approved by an admin.
          Juvenile and sensitive-category records are automatically suppressed pending manual review.
        </p>
      </div>
    </div>
  );
}
