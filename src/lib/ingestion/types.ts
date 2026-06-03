/**
 * Shared types for the source ingestion pipeline.
 *
 * Flow:
 *   Source (catalog) → SourceFetch (run log) → ParsedRecord (staged data)
 *     → Story (draft, after admin approval)
 */

export type SourceType =
  | "BSO_BOOKING_REGISTER"
  | "BSO_BOOKING_BLOTTER"
  | "FLPD_NEWS_RELEASES"
  | "BROWARD_CLERK_MANUAL"
  | "MANUAL_ADMIN_SUBMISSION";

export type FetchMethod = "LIVE" | "MANUAL" | "MOCK";
export type FetchStatus = "PENDING" | "IN_PROGRESS" | "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";
export type RecordStatus =
  | "NEW"
  | "NEEDS_REVIEW"
  | "DUPLICATE"
  | "APPROVED_FOR_DRAFT"
  | "REJECTED"
  | "STORY_GENERATED";

// ---------------------------------------------------------------------------
// Raw result returned by each adapter's fetch()
// ---------------------------------------------------------------------------

export interface RawFetchResult {
  source_type: SourceType;
  source_url: string;
  fetched_at: Date;
  method: FetchMethod;
  raw_text: string;
  content_type?: string;
  http_status?: number;
}

// ---------------------------------------------------------------------------
// Structured record produced by each adapter's parse()
// ---------------------------------------------------------------------------

export interface ParsedRecordInput {
  source_type: SourceType;
  source_url?: string;
  retrieved_at: Date;
  raw_text?: string;
  parser_name: string;
  parser_confidence_score: number; // 0.0 – 1.0

  person_name?: string;
  booking_date?: Date;
  booking_number?: string;
  arresting_agency?: string;
  city?: string;
  county?: string;
  jurisdiction?: string;
  charges: string[];
  bond?: string;
  release_status?: string;
  court_case_number?: string;
  court_case_url?: string;
}

// ---------------------------------------------------------------------------
// Adapter contract — every source adapter implements this
// ---------------------------------------------------------------------------

export interface FetchOptions {
  /** Use bundled mock fixture instead of hitting the network */
  useMock?: boolean;
  /** Admin-pasted raw text (HTML, plain text, CSV rows) */
  rawInput?: string;
}

export interface SourceAdapter {
  sourceType: SourceType;
  displayName: string;
  baseUrl: string;
  requiresManual: boolean;
  fetch(options?: FetchOptions): Promise<RawFetchResult>;
  parse(raw: RawFetchResult): ParsedRecordInput[];
}

// ---------------------------------------------------------------------------
// Orchestrator result
// ---------------------------------------------------------------------------

export interface FetchRunResult {
  sourceFetchId: string;
  status: FetchStatus;
  recordsFound: number;
  recordsImported: number;
  recordsSkipped: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Ingestion-specific error
// ---------------------------------------------------------------------------

export class IngestionError extends Error {
  constructor(
    public readonly errorType: string,
    message: string
  ) {
    super(message);
    this.name = "IngestionError";
  }
}
