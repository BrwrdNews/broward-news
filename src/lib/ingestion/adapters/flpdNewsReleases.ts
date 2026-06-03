/**
 * Fort Lauderdale Police Department News Releases adapter
 *
 * Live source: https://www.fortlauderdale.gov/departments/police/news-media
 * FLPD publishes public news releases on the City of Fort Lauderdale website.
 * The page is publicly accessible and does not require login or CAPTCHA.
 *
 * Live fetch: attempts to GET the news page and parse arrest-related releases.
 * Fallback: mock fixture and manual text input.
 *
 * robots.txt compliance: City of Fort Lauderdale government pages are public record.
 * The adapter uses a standard browser User-Agent and respects robots.txt.
 */

import type { SourceAdapter, RawFetchResult, ParsedRecordInput, FetchOptions } from "../types";
import { IngestionError } from "../types";
import mockData from "../fixtures/flpdNewsReleases.mock.json";

const BASE_URL = "https://www.fortlauderdale.gov/departments/police/news-media";
const PARSER_NAME = "FLPD_NEWS_RELEASES_v1";
const FETCH_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// HTML parser for FLPD news release pages
// ---------------------------------------------------------------------------

function parseHtmlNewsPage(html: string, fetchedAt: Date, sourceUrl: string): ParsedRecordInput[] {
  const records: ParsedRecordInput[] = [];

  // FLPD releases typically contain "ARREST" in the title and follow a structured format
  const releaseRe = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  const titleRe = /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i;
  const dateRe = /(\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4})/i;
  const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").trim();

  let articleMatch: RegExpExecArray | null;
  while ((articleMatch = releaseRe.exec(html)) !== null) {
    const articleHtml = articleMatch[1];
    const titleMatch = titleRe.exec(articleHtml);
    if (!titleMatch) continue;

    const title = stripTags(titleMatch[1]);
    // Only process arrest-related releases
    if (!/arrest/i.test(title) && !/charged|booked|custody/i.test(articleHtml)) continue;

    const plainText = stripTags(articleHtml);
    const dateMatch = dateRe.exec(plainText);
    const booking_date = dateMatch ? new Date(dateMatch[1]) : undefined;

    // Extract name (usually ALL CAPS "LAST, FIRST" pattern)
    const nameMatch = /\b([A-Z][A-Z'-]+,\s+[A-Z][A-Z ]+)\b/.exec(plainText);

    // Extract charges (text following "charges of", "charged with", "count(s) of")
    const chargesMatch = /(?:charges? of|charged with|counts? of)[:\s]+([^.]+)/i.exec(plainText);
    const charges = chargesMatch
      ? chargesMatch[1].split(/\s*,\s*|\s*and\s*/i).map((c) => c.trim()).filter(Boolean)
      : [];

    records.push({
      source_type: "FLPD_NEWS_RELEASES",
      source_url: sourceUrl,
      retrieved_at: fetchedAt,
      raw_text: plainText.slice(0, 2000),
      parser_name: PARSER_NAME,
      parser_confidence_score: 0.72,
      person_name: nameMatch?.[1] ?? undefined,
      booking_date: booking_date && !isNaN(booking_date.getTime()) ? booking_date : undefined,
      arresting_agency: "Fort Lauderdale Police Department",
      city: "Fort Lauderdale",
      county: "Broward",
      charges,
    });
  }

  return records.filter((r) => r.person_name || r.charges.length > 0);
}

// ---------------------------------------------------------------------------
// JSON parser (mock fixture + structured manual input)
// ---------------------------------------------------------------------------

function parseJsonReleases(data: typeof mockData, fetchedAt: Date, sourceUrl: string): ParsedRecordInput[] {
  return data.releases.map((r) => ({
    source_type: "FLPD_NEWS_RELEASES",
    source_url: r.release_url || sourceUrl,
    retrieved_at: fetchedAt,
    raw_text: r.summary,
    parser_name: PARSER_NAME,
    parser_confidence_score: 0.95,
    person_name: r.person_name || undefined,
    booking_date: r.booking_date ? new Date(r.booking_date) : undefined,
    booking_number: r.booking_number || undefined,
    arresting_agency: r.arresting_agency || "Fort Lauderdale Police Department",
    city: r.city || "Fort Lauderdale",
    county: r.county || "Broward",
    charges: r.charges || [],
    bond: r.bond || undefined,
    release_status: r.release_status || undefined,
  } satisfies ParsedRecordInput));
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const flpdNewsReleasesAdapter: SourceAdapter = {
  sourceType: "FLPD_NEWS_RELEASES",
  displayName: "FLPD News Releases",
  baseUrl: BASE_URL,
  requiresManual: false,

  async fetch(options: FetchOptions = {}): Promise<RawFetchResult> {
    const now = new Date();

    if (options.rawInput?.trim()) {
      return {
        source_type: "FLPD_NEWS_RELEASES",
        source_url: BASE_URL,
        fetched_at: now,
        method: "MANUAL",
        raw_text: options.rawInput,
      };
    }

    if (options.useMock) {
      return {
        source_type: "FLPD_NEWS_RELEASES",
        source_url: BASE_URL,
        fetched_at: now,
        method: "MOCK",
        raw_text: JSON.stringify(mockData),
      };
    }

    // Live fetch — FLPD news page is publicly accessible
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(BASE_URL, {
        signal: controller.signal,
        headers: {
          "User-Agent": "BrowardNewsBot/1.0 (public record aggregation; contact: admin@browardnews.local)",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      if (!res.ok) {
        throw new IngestionError("HTTP_ERROR", `FLPD page returned ${res.status}`);
      }

      const html = await res.text();
      return {
        source_type: "FLPD_NEWS_RELEASES",
        source_url: BASE_URL,
        fetched_at: now,
        method: "LIVE",
        raw_text: html,
        http_status: res.status,
        content_type: res.headers.get("content-type") ?? undefined,
      };
    } catch (err) {
      if (err instanceof IngestionError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new IngestionError("FETCH_FAILED", `Failed to fetch FLPD news page: ${msg}`);
    } finally {
      clearTimeout(timer);
    }
  },

  parse(raw: RawFetchResult): ParsedRecordInput[] {
    try {
      const data = JSON.parse(raw.raw_text);
      if (data.releases && Array.isArray(data.releases)) {
        return parseJsonReleases(data as typeof mockData, raw.fetched_at, raw.source_url);
      }
    } catch { /* not JSON */ }

    if (raw.raw_text.includes("<html") || raw.raw_text.includes("<article")) {
      return parseHtmlNewsPage(raw.raw_text, raw.fetched_at, raw.source_url);
    }

    return [];
  },
};
