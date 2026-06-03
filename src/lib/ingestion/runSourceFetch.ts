/**
 * Fetch orchestrator — runs the full ingestion pipeline for a single source:
 *   fetch → parse → normalize → dedupe → persist → update source status
 */

import { prisma } from "@/lib/prisma";
import { getAdapter } from "./adapters/index";
import { normalizeRecord } from "./normalize";
import { checkForDuplicates, saveDupeCandidate } from "./dedupe";
import { IngestionError } from "./types";
import type { FetchOptions, FetchRunResult } from "./types";

export async function runSourceFetch(
  sourceId: string,
  options: FetchOptions = {}
): Promise<FetchRunResult> {
  const source = await prisma.source.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error(`Source not found: ${sourceId}`);
  if (!source.is_enabled) throw new Error(`Source "${source.name}" is disabled.`);

  const adapter = getAdapter(source.source_type as Parameters<typeof getAdapter>[0]);

  // Create SourceFetch record
  const sourceFetch = await prisma.sourceFetch.create({
    data: {
      source_id: sourceId,
      status: "IN_PROGRESS",
      fetch_method: options.rawInput
        ? "MANUAL"
        : options.useMock
        ? "MOCK"
        : "LIVE",
    },
  });

  const errors: string[] = [];
  let recordsFound = 0;
  let recordsImported = 0;
  let recordsSkipped = 0;
  let finalStatus: FetchRunResult["status"] = "SUCCESS";

  try {
    // ── 1. Fetch ─────────────────────────────────────────────────────────────
    let raw;
    try {
      raw = await adapter.fetch(options);
    } catch (err) {
      const msg = err instanceof IngestionError ? err.message : String(err);
      const errType = err instanceof IngestionError ? err.errorType : "FETCH_FAILED";

      await prisma.ingestionError.create({
        data: { source_fetch_id: sourceFetch.id, error_type: errType, message: msg },
      });
      await prisma.sourceFetch.update({
        where: { id: sourceFetch.id },
        data: { status: "FAILED", completed_at: new Date(), error_message: msg },
      });
      await prisma.source.update({
        where: { id: sourceId },
        data: { last_fetched_at: new Date(), last_fetch_status: "FAILED" },
      });
      return { sourceFetchId: sourceFetch.id, status: "FAILED", recordsFound: 0, recordsImported: 0, recordsSkipped: 0, errors: [msg] };
    }

    await prisma.sourceFetch.update({
      where: { id: sourceFetch.id },
      data: { source_url_fetched: raw.source_url },
    });

    // ── 2. Parse ──────────────────────────────────────────────────────────────
    let parsed;
    try {
      parsed = adapter.parse(raw);
    } catch (err) {
      const msg = `Parse error: ${err instanceof Error ? err.message : String(err)}`;
      await prisma.ingestionError.create({
        data: { source_fetch_id: sourceFetch.id, error_type: "PARSE_ERROR", message: msg },
      });
      errors.push(msg);
      finalStatus = "FAILED";
      parsed = [];
    }

    recordsFound = parsed.length;

    // ── 3. Normalize, dedupe, persist ─────────────────────────────────────────
    for (const rawRecord of parsed) {
      try {
        const norm = normalizeRecord(rawRecord);

        // Persist the ParsedRecord
        const saved = await prisma.parsedRecord.create({
          data: {
            source_id:                sourceId,
            source_fetch_id:          sourceFetch.id,
            source_url:               norm.source_url ?? source.base_url,
            source_type:              norm.source_type,
            retrieved_at:             norm.retrieved_at,
            raw_text:                 norm.raw_text?.slice(0, 10_000) ?? null,
            parser_name:              norm.parser_name,
            parser_confidence_score:  norm.parser_confidence_score,
            person_name:              norm.person_name ?? null,
            booking_date:             norm.booking_date ?? null,
            booking_number:           norm.booking_number ?? null,
            arresting_agency:         norm.arresting_agency ?? null,
            city:                     norm.city ?? null,
            county:                   norm.county ?? "Broward",
            jurisdiction:             norm.jurisdiction ?? null,
            charges:                  norm.charges,
            bond:                     norm.bond ?? null,
            release_status:           norm.release_status ?? null,
            court_case_number:        norm.court_case_number ?? null,
            court_case_url:           norm.court_case_url ?? null,
            record_status:            norm.is_suppressed ? "NEEDS_REVIEW" : "NEW",
            is_suppressed:            norm.is_suppressed,
            suppression_reason:       norm.suppression_reason ?? null,
          },
        });

        // Dedupe check
        const dupeResult = await checkForDuplicates(norm, saved.id);

        if (dupeResult.isDuplicate && dupeResult.existingRecordId) {
          await prisma.parsedRecord.update({
            where: { id: saved.id },
            data: { record_status: "DUPLICATE" },
          });
          await saveDupeCandidate(
            saved.id,
            dupeResult.existingRecordId,
            dupeResult.similarityScore,
            dupeResult.matchFields
          );
          recordsSkipped++;
        } else if (
          dupeResult.similarityScore >= 0.6 &&
          dupeResult.existingRecordId
        ) {
          // Near-duplicate — flag for review
          await prisma.parsedRecord.update({
            where: { id: saved.id },
            data: { record_status: "NEEDS_REVIEW" },
          });
          await saveDupeCandidate(
            saved.id,
            dupeResult.existingRecordId,
            dupeResult.similarityScore,
            dupeResult.matchFields
          );
          recordsImported++;
        } else {
          recordsImported++;
        }
      } catch (err) {
        const msg = `Record save error: ${err instanceof Error ? err.message : String(err)}`;
        await prisma.ingestionError.create({
          data: {
            source_fetch_id: sourceFetch.id,
            error_type:      "VALIDATION_ERROR",
            message:         msg,
            raw_input:       JSON.stringify(rawRecord).slice(0, 2000),
          },
        });
        errors.push(msg);
        recordsSkipped++;
        finalStatus = errors.length >= recordsFound ? "FAILED" : "PARTIAL";
      }
    }

    // Partial success if some records failed
    if (errors.length > 0 && recordsImported > 0) finalStatus = "PARTIAL";
    if (errors.length > 0 && recordsImported === 0) finalStatus = "FAILED";

  } finally {
    // ── 4. Finalize ───────────────────────────────────────────────────────────
    await prisma.sourceFetch.update({
      where: { id: sourceFetch.id },
      data: {
        status:           finalStatus,
        completed_at:     new Date(),
        records_found:    recordsFound,
        records_imported: recordsImported,
        records_skipped:  recordsSkipped,
        error_message:    errors.length > 0 ? errors.slice(0, 3).join(" | ") : null,
      },
    });

    await prisma.source.update({
      where: { id: sourceId },
      data: {
        last_fetched_at:        new Date(),
        last_fetch_status:      finalStatus,
        total_records_imported: { increment: recordsImported },
      },
    });
  }

  return {
    sourceFetchId:   sourceFetch.id,
    status:          finalStatus,
    recordsFound,
    recordsImported,
    recordsSkipped,
    errors,
  };
}
