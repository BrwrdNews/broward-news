/**
 * BSO Daily Booking Blotter adapter
 *
 * Live source: https://www.sheriff.org (Corrections division)
 * The blotter is typically published as a PDF and linked from the BSO website.
 * PDF parsing requires the operator to copy-paste text or use the manual-source form.
 *
 * This adapter handles:
 *   - Mock fixture (structured JSON)
 *   - Manual text paste (JSON, CSV, or plain table from PDF copy)
 *   - Live fetch attempt for any directly-accessible HTML blotter pages
 */

import type { SourceAdapter, RawFetchResult, ParsedRecordInput, FetchOptions } from "../types";
import { IngestionError } from "../types";
import mockData from "../fixtures/bsoBookingBlotter.mock.json";

const BASE_URL = "https://www.sheriff.org/Divisions/Pages/Corrections.aspx";
const PARSER_NAME = "BSO_BOOKING_BLOTTER_v1";

function parseJsonBlotter(data: typeof mockData, fetchedAt: Date, sourceUrl: string): ParsedRecordInput[] {
  return data.entries.map((e) => {
    const bookingDate = e.booking_date ? new Date(e.booking_date) : undefined;
    return {
      source_type: "BSO_BOOKING_BLOTTER",
      source_url: sourceUrl,
      retrieved_at: fetchedAt,
      raw_text: JSON.stringify(e),
      parser_name: PARSER_NAME,
      parser_confidence_score: 0.92,
      person_name: e.name || undefined,
      booking_date: bookingDate && !isNaN(bookingDate.getTime()) ? bookingDate : undefined,
      booking_number: e.booking_number || undefined,
      arresting_agency: e.arresting_agency || data.agency || "Broward County Sheriff's Office",
      city: e.city || undefined,
      county: e.county || "Broward",
      charges: e.charges || [],
      bond: e.bond || undefined,
      release_status: e.release_status || undefined,
    } satisfies ParsedRecordInput;
  });
}

function parsePlainTextBlotter(text: string, fetchedAt: Date, sourceUrl: string): ParsedRecordInput[] {
  // Attempt to parse line-by-line: "NAME | DATE | BOOKING# | CHARGE | BOND"
  // or multiline blocks starting with a name in ALL CAPS
  const records: ParsedRecordInput[] = [];
  const nameLineRe = /^([A-Z][A-Z ,'-]+?),\s+([A-Z][A-Z ]+)/m;
  const blocks = text.split(/\n{2,}/);

  for (const block of blocks) {
    const nameMatch = nameLineRe.exec(block);
    if (!nameMatch) continue;

    const name = `${nameMatch[1]}, ${nameMatch[2]}`.trim();
    const dateMatch = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/.exec(block);
    const bookingNumMatch = /(?:booking|#|no\.?)\s*:?\s*([A-Z0-9-]+)/i.exec(block);
    const bondMatch = /bond[:\s]+\$?([\d,]+)/i.exec(block);
    const chargeLines = block
      .split("\n")
      .filter((l) =>
        /charge|count|violation|statute|F\d|M\d/.test(l) &&
        !nameLineRe.test(l)
      )
      .map((l) => l.replace(/^[\s\-*•]+/, "").trim())
      .filter(Boolean);

    records.push({
      source_type: "BSO_BOOKING_BLOTTER",
      source_url: sourceUrl,
      retrieved_at: fetchedAt,
      raw_text: block,
      parser_name: PARSER_NAME + "_TEXT",
      parser_confidence_score: 0.55,
      person_name: name,
      booking_date: dateMatch ? new Date(dateMatch[1]) : undefined,
      booking_number: bookingNumMatch?.[1] ?? undefined,
      arresting_agency: "Broward County Sheriff's Office",
      county: "Broward",
      charges: chargeLines.length > 0 ? chargeLines : [],
      bond: bondMatch ? `$${bondMatch[1]}` : undefined,
    });
  }

  return records.filter((r) => r.person_name);
}

export const bsoBookingBlotterAdapter: SourceAdapter = {
  sourceType: "BSO_BOOKING_BLOTTER",
  displayName: "BSO Daily Booking Blotter",
  baseUrl: BASE_URL,
  requiresManual: true,

  async fetch(options: FetchOptions = {}): Promise<RawFetchResult> {
    const now = new Date();

    if (options.rawInput?.trim()) {
      return {
        source_type: "BSO_BOOKING_BLOTTER",
        source_url: BASE_URL,
        fetched_at: now,
        method: "MANUAL",
        raw_text: options.rawInput,
      };
    }

    if (options.useMock) {
      return {
        source_type: "BSO_BOOKING_BLOTTER",
        source_url: BASE_URL,
        fetched_at: now,
        method: "MOCK",
        raw_text: JSON.stringify(mockData),
      };
    }

    // Live blotter is typically a PDF link — not directly parseable without pdf-parse
    throw new IngestionError(
      "PDF_REQUIRED",
      "BSO Booking Blotter is published as a PDF. " +
        "To import: open the PDF, copy the text, and paste it into Manual Source. " +
        "Use Mock mode to test the ingestion pipeline locally."
    );
  },

  parse(raw: RawFetchResult): ParsedRecordInput[] {
    try {
      const data = JSON.parse(raw.raw_text);
      if (data.entries && Array.isArray(data.entries)) {
        return parseJsonBlotter(data as typeof mockData, raw.fetched_at, raw.source_url);
      }
    } catch { /* not JSON */ }

    return parsePlainTextBlotter(raw.raw_text, raw.fetched_at, raw.source_url);
  },
};
