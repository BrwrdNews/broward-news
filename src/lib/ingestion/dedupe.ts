/**
 * Duplicate detection for ingested records.
 *
 * Rules (in order of confidence):
 *   1. Exact booking number match → CONFIRMED_DUPLICATE (1.0)
 *   2. Same person_name + booking_date + agency → HIGH similarity (0.9)
 *   3. Same person_name + booking_date (different agency) → MEDIUM (0.75)
 *   4. Similar name + same booking_date + overlapping charges → MEDIUM (0.65)
 *
 * Never auto-deletes. Flags near-duplicates for admin review.
 */

import { prisma } from "@/lib/prisma";
import type { ParsedRecordInput } from "./types";

// ---------------------------------------------------------------------------
// Simple string similarity (0.0 – 1.0) via bigram overlap
// ---------------------------------------------------------------------------

function bigrams(s: string): Set<string> {
  const clean = s.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  const set = new Set<string>();
  for (let i = 0; i < clean.length - 1; i++) {
    set.add(clean.slice(i, i + 2));
  }
  return set;
}

function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const bA = bigrams(a);
  const bB = bigrams(b);
  if (bA.size === 0 && bB.size === 0) return 1;
  if (bA.size === 0 || bB.size === 0) return 0;
  let intersection = 0;
  for (const bg of bA) if (bB.has(bg)) intersection++;
  return (2 * intersection) / (bA.size + bB.size);
}

function sameDay(a: Date | undefined | null, b: Date | undefined | null): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function chargeOverlap(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a.map((c) => c.toLowerCase()));
  const setB = new Set(b.map((c) => c.toLowerCase()));
  let overlap = 0;
  for (const c of setA) if (setB.has(c)) overlap++;
  return overlap / Math.max(setA.size, setB.size);
}

// ---------------------------------------------------------------------------
// Check a new record against existing ParsedRecords in the DB
// ---------------------------------------------------------------------------

export interface DupeCheckResult {
  isDuplicate: boolean;
  existingRecordId: string | null;
  similarityScore: number;
  matchFields: string[];
}

export async function checkForDuplicates(
  record: ParsedRecordInput,
  newRecordId: string
): Promise<DupeCheckResult> {
  // 1. Exact booking number match
  if (record.booking_number) {
    const exactMatch = await prisma.parsedRecord.findFirst({
      where: {
        booking_number: record.booking_number,
        id: { not: newRecordId },
      },
      select: { id: true },
    });
    if (exactMatch) {
      return {
        isDuplicate: true,
        existingRecordId: exactMatch.id,
        similarityScore: 1.0,
        matchFields: ["booking_number"],
      };
    }
  }

  // 2. Fuzzy match by name + date window
  if (!record.person_name) return { isDuplicate: false, existingRecordId: null, similarityScore: 0, matchFields: [] };

  // Search records within ±2 days of booking date
  const dateFrom = record.booking_date ? new Date(record.booking_date) : null;
  const dateTo   = record.booking_date ? new Date(record.booking_date) : null;
  if (dateFrom) dateFrom.setDate(dateFrom.getDate() - 2);
  if (dateTo)   dateTo.setDate(dateTo.getDate() + 2);

  const candidates = await prisma.parsedRecord.findMany({
    where: {
      id: { not: newRecordId },
      ...(dateFrom && dateTo ? { booking_date: { gte: dateFrom, lte: dateTo } } : {}),
    },
    select: {
      id: true,
      person_name: true,
      booking_date: true,
      arresting_agency: true,
      charges: true,
      booking_number: true,
    },
    take: 50,
  });

  let bestScore = 0;
  let bestId: string | null = null;
  let bestFields: string[] = [];

  for (const c of candidates) {
    const matchFields: string[] = [];
    let score = 0;

    const nameSim = stringSimilarity(record.person_name, c.person_name ?? "");
    if (nameSim >= 0.85) { score += 0.5; matchFields.push("person_name"); }

    const sameDateVal = sameDay(record.booking_date, c.booking_date);
    if (sameDateVal) { score += 0.25; matchFields.push("booking_date"); }

    const agencySim = stringSimilarity(
      record.arresting_agency ?? "",
      c.arresting_agency ?? ""
    );
    if (agencySim >= 0.8) { score += 0.1; matchFields.push("arresting_agency"); }

    const chargeOv = chargeOverlap(record.charges, c.charges as string[]);
    if (chargeOv >= 0.5) { score += 0.15; matchFields.push("charges"); }

    if (score > bestScore) {
      bestScore = score;
      bestId = c.id;
      bestFields = matchFields;
    }
  }

  if (bestScore >= 0.7) {
    return {
      isDuplicate: bestScore >= 0.9,
      existingRecordId: bestId,
      similarityScore: Math.min(bestScore, 1.0),
      matchFields: bestFields,
    };
  }

  return { isDuplicate: false, existingRecordId: null, similarityScore: bestScore, matchFields: [] };
}

// ---------------------------------------------------------------------------
// Persist a dedupe candidate pair
// ---------------------------------------------------------------------------

export async function saveDupeCandidate(
  newRecordId: string,
  existingRecordId: string,
  similarityScore: number,
  matchFields: string[]
): Promise<void> {
  // Avoid creating duplicate DedupeCandidate rows
  const existing = await prisma.dedupeCandidate.findFirst({
    where: {
      OR: [
        { record_id: newRecordId,    duplicate_record_id: existingRecordId },
        { record_id: existingRecordId, duplicate_record_id: newRecordId },
      ],
    },
  });
  if (existing) return;

  await prisma.dedupeCandidate.create({
    data: {
      record_id: newRecordId,
      duplicate_record_id: existingRecordId,
      similarity_score: similarityScore,
      match_fields: matchFields,
    },
  });
}
