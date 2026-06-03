/**
 * Broward Clerk of Courts — Manual Verification adapter
 *
 * Source: https://www.browardclerk.org/Web2/CaseSearchExt/
 *
 * STATUS: Manual verification only.
 *
 * The Broward Clerk case search interface does not provide a public API or
 * bulk-accessible feed. Automated scraping is not appropriate here as it may
 * violate terms of service. This adapter is used only when an admin manually
 * looks up a case and pastes the court record data into the Manual Source form.
 *
 * Use this adapter to:
 *   - Record a court case number linked to an existing ParsedRecord or Story
 *   - Add verified charge details from official court filings
 *   - Store the case URL for citation
 */

import type { SourceAdapter, RawFetchResult, ParsedRecordInput, FetchOptions } from "../types";
import { IngestionError } from "../types";

const BASE_URL = "https://www.browardclerk.org/Web2/CaseSearchExt/";
const PARSER_NAME = "BROWARD_CLERK_MANUAL_v1";

// ---------------------------------------------------------------------------
// Structured JSON format for manually-entered clerk data
// {
//   "case_number": "24-001234CF10A",
//   "case_url": "https://...",
//   "defendant_name": "SMITH, JOHN",
//   "charges": ["Possession of cocaine (F3)", ...],
//   "filing_date": "2024-06-01",
//   "status": "Pending",
//   "bond": "$5,000"
// }
// ---------------------------------------------------------------------------

interface ClerkCaseInput {
  case_number?: string;
  case_url?: string;
  defendant_name?: string;
  charges?: string[];
  filing_date?: string;
  arrest_date?: string;
  status?: string;
  bond?: string;
  city?: string;
  arresting_agency?: string;
}

function parseClerkJson(data: ClerkCaseInput, fetchedAt: Date): ParsedRecordInput {
  const dateStr = data.arrest_date || data.filing_date;
  const bookingDate = dateStr ? new Date(dateStr) : undefined;
  return {
    source_type: "BROWARD_CLERK_MANUAL",
    source_url: data.case_url || BASE_URL,
    retrieved_at: fetchedAt,
    raw_text: JSON.stringify(data),
    parser_name: PARSER_NAME,
    parser_confidence_score: 0.98, // Admin-verified → highest confidence
    person_name: data.defendant_name || undefined,
    booking_date: bookingDate && !isNaN(bookingDate.getTime()) ? bookingDate : undefined,
    arresting_agency: data.arresting_agency || undefined,
    city: data.city || undefined,
    county: "Broward",
    jurisdiction: "Broward County Court",
    charges: data.charges || [],
    bond: data.bond || undefined,
    release_status: data.status || undefined,
    court_case_number: data.case_number || undefined,
    court_case_url: data.case_url || undefined,
  };
}

export const browardClerkManualAdapter: SourceAdapter = {
  sourceType: "BROWARD_CLERK_MANUAL",
  displayName: "Broward Clerk of Courts (Manual Verification)",
  baseUrl: BASE_URL,
  requiresManual: true,

  async fetch(options: FetchOptions = {}): Promise<RawFetchResult> {
    const now = new Date();

    if (options.rawInput?.trim()) {
      return {
        source_type: "BROWARD_CLERK_MANUAL",
        source_url: BASE_URL,
        fetched_at: now,
        method: "MANUAL",
        raw_text: options.rawInput,
      };
    }

    // No mock fixture for clerk — data must be manually entered
    if (options.useMock) {
      const sampleCase: ClerkCaseInput = {
        case_number: "24-001234CF10A",
        case_url: "https://www.browardclerk.org/Web2/CaseSearchExt/Results/?caseNumber=24-001234CF10A",
        defendant_name: "SAMPLE, JOHN DEMO",
        charges: ["Possession of cocaine (F3)", "Possession of drug paraphernalia (M1)"],
        filing_date: "2024-06-01",
        arresting_agency: "Fort Lauderdale Police Department",
        city: "Fort Lauderdale",
        status: "Pending — arraignment scheduled",
        bond: "$5,000",
      };
      return {
        source_type: "BROWARD_CLERK_MANUAL",
        source_url: BASE_URL,
        fetched_at: now,
        method: "MOCK",
        raw_text: JSON.stringify(sampleCase),
      };
    }

    throw new IngestionError(
      "MANUAL_ONLY",
      "Broward Clerk of Courts requires manual lookup. " +
        "Search for the case at browardclerk.org, then paste the case details " +
        "as JSON into the Manual Source form. See the adapter docs for the expected format."
    );
  },

  parse(raw: RawFetchResult): ParsedRecordInput[] {
    try {
      const data = JSON.parse(raw.raw_text) as ClerkCaseInput;
      return [parseClerkJson(data, raw.fetched_at)];
    } catch {
      // Fallback: treat raw_text as a plain case number line
      const lines = raw.raw_text.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) return [];
      return [
        {
          source_type: "BROWARD_CLERK_MANUAL",
          source_url: raw.source_url,
          retrieved_at: raw.fetched_at,
          raw_text: raw.raw_text,
          parser_name: PARSER_NAME + "_TEXT",
          parser_confidence_score: 0.4,
          court_case_number: lines[0],
          county: "Broward",
          charges: lines.slice(1),
        },
      ];
    }
  },
};
