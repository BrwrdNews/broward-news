/**
 * BSO Jail Booking Register adapter
 *
 * Live source: https://apps2.browardsheriff.org/JailSearch/
 * Status: CAPTCHA-protected automated search — live fetch not supported.
 *         Manual HTML paste and mock fixture are the primary paths.
 *
 * When BSO publishes a publicly-accessible daily booking report page
 * without CAPTCHA, update the LIVE_REPORT_URL and uncomment the live branch.
 */

import type { SourceAdapter, RawFetchResult, ParsedRecordInput, FetchOptions } from "../types";
import { IngestionError } from "../types";
import mockData from "../fixtures/bsoBookingRegister.mock.json";

const BASE_URL = "https://apps2.browardsheriff.org/JailSearch/";
const PARSER_NAME = "BSO_BOOKING_REGISTER_v1";

// ---------------------------------------------------------------------------
// HTML table parser (for manual-pasted booking table HTML)
// ---------------------------------------------------------------------------

function parseHtmlTable(html: string, fetchedAt: Date, sourceUrl: string): ParsedRecordInput[] {
  const records: ParsedRecordInput[] = [];

  // Match table rows — simple regex approach for well-formed booking tables
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

  let isHeader = true;
  const headerMap: string[] = [];

  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, "").trim());
    }

    if (isHeader) {
      headerMap.push(...cells.map((c) => c.toLowerCase()));
      isHeader = false;
      continue;
    }
    if (cells.length < 2) continue;

    const get = (key: string): string => {
      const idx = headerMap.findIndex((h) => h.includes(key));
      return idx >= 0 ? cells[idx] ?? "" : "";
    };

    const bookingDateStr = get("booking") || get("date") || get("arrested");
    const bookingDate = bookingDateStr ? new Date(bookingDateStr) : undefined;

    records.push({
      source_type: "BSO_BOOKING_REGISTER",
      source_url: sourceUrl,
      retrieved_at: fetchedAt,
      raw_text: rowMatch[0],
      parser_name: PARSER_NAME,
      parser_confidence_score: 0.7, // lower for HTML — structure may vary
      person_name: get("name") || get("inmate") || undefined,
      booking_date: bookingDate && !isNaN(bookingDate.getTime()) ? bookingDate : undefined,
      booking_number: get("booking") || get("number") || get("id") || undefined,
      arresting_agency: get("agency") || "Broward County Sheriff's Office",
      city: get("city") || "Fort Lauderdale",
      county: "Broward",
      charges: get("charge") ? [get("charge")] : [],
      bond: get("bond") || undefined,
      release_status: get("release") || get("status") || undefined,
    });
  }

  return records;
}

// ---------------------------------------------------------------------------
// JSON parser (mock fixture + structured admin input)
// ---------------------------------------------------------------------------

function parseJsonBookings(data: typeof mockData, fetchedAt: Date, sourceUrl: string): ParsedRecordInput[] {
  return data.bookings.map((b) => {
    const bookingDate = b.booking_date ? new Date(b.booking_date) : undefined;
    return {
      source_type: "BSO_BOOKING_REGISTER",
      source_url: sourceUrl,
      retrieved_at: fetchedAt,
      raw_text: JSON.stringify(b),
      parser_name: PARSER_NAME,
      parser_confidence_score: 0.95,
      person_name: b.name || undefined,
      booking_date: bookingDate && !isNaN(bookingDate.getTime()) ? bookingDate : undefined,
      booking_number: b.booking_number || undefined,
      arresting_agency: b.arresting_agency || "Broward County Sheriff's Office",
      city: b.city || undefined,
      county: b.county || "Broward",
      charges: b.charges || [],
      bond: b.bond || undefined,
      release_status: b.release_status || undefined,
    } satisfies ParsedRecordInput;
  });
}

// ---------------------------------------------------------------------------
// Adapter export
// ---------------------------------------------------------------------------

export const bsoBookingRegisterAdapter: SourceAdapter = {
  sourceType: "BSO_BOOKING_REGISTER",
  displayName: "BSO Jail Booking Register",
  baseUrl: BASE_URL,
  requiresManual: true,

  async fetch(options: FetchOptions = {}): Promise<RawFetchResult> {
    const now = new Date();

    // 1. Manual text input — highest priority
    if (options.rawInput?.trim()) {
      return {
        source_type: "BSO_BOOKING_REGISTER",
        source_url: BASE_URL,
        fetched_at: now,
        method: "MANUAL",
        raw_text: options.rawInput,
      };
    }

    // 2. Mock fixture — for local testing
    if (options.useMock) {
      return {
        source_type: "BSO_BOOKING_REGISTER",
        source_url: BASE_URL,
        fetched_at: now,
        method: "MOCK",
        raw_text: JSON.stringify(mockData),
      };
    }

    // 3. Live fetch — BSO search requires CAPTCHA; not automatable
    throw new IngestionError(
      "CAPTCHA_REQUIRED",
      "BSO Booking Register automated search requires CAPTCHA. " +
        "Use Mock mode for testing or paste booking table HTML/text into Manual Source. " +
        "Enable this source with fetch_interval_hours=0 (manual only)."
    );
  },

  parse(raw: RawFetchResult): ParsedRecordInput[] {
    // Try structured JSON first
    try {
      const data = JSON.parse(raw.raw_text);
      if (data.bookings && Array.isArray(data.bookings)) {
        return parseJsonBookings(data as typeof mockData, raw.fetched_at, raw.source_url);
      }
    } catch { /* not JSON */ }

    // Try HTML table
    if (raw.raw_text.includes("<table") || raw.raw_text.includes("<tr")) {
      return parseHtmlTable(raw.raw_text, raw.fetched_at, raw.source_url);
    }

    // Plain-text CSV fallback (Name, Booking#, Date, Charge columns)
    return parseCsvText(raw.raw_text, raw.fetched_at, raw.source_url);
  },
};

function parseCsvText(text: string, fetchedAt: Date, sourceUrl: string): ParsedRecordInput[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const get = (key: string) => {
      const idx = headers.findIndex((h) => h.includes(key));
      return idx >= 0 ? cells[idx] ?? "" : "";
    };
    return {
      source_type: "BSO_BOOKING_REGISTER",
      source_url: sourceUrl,
      retrieved_at: fetchedAt,
      raw_text: line,
      parser_name: PARSER_NAME + "_CSV",
      parser_confidence_score: 0.6,
      person_name: get("name") || undefined,
      booking_date: get("date") ? new Date(get("date")) : undefined,
      booking_number: get("number") || get("booking") || undefined,
      arresting_agency: "Broward County Sheriff's Office",
      city: get("city") || "Fort Lauderdale",
      county: "Broward",
      charges: get("charge") ? [get("charge")] : [],
    } satisfies ParsedRecordInput;
  }).filter((r) => r.person_name);
}
