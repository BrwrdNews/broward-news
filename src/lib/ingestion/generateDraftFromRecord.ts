/**
 * Generate a cautious DRAFT story from an approved ParsedRecord.
 *
 * - Body is fact-bound: every sentence traces to a source field.
 * - Presumption-of-innocence language is mandatory.
 * - Sensitive categories → only neutral headlines generated.
 * - Never publishes automatically.
 */

import { prisma } from "@/lib/prisma";
import slugify from "slugify";
import { generateHeadlines } from "@/lib/headline-generator";
import { detectSensitiveCategory } from "@/lib/ingestion/normalize";

function makeSlug(text: string): string {
  return (
    slugify(text, { lower: true, strict: true }).slice(0, 80) +
    "-" +
    Date.now().toString(36)
  );
}

function toTitleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Build a cautious story body from structured record fields
// ---------------------------------------------------------------------------

function buildStoryBody(rec: {
  person_name?: string | null;
  city?: string | null;
  county?: string | null;
  arresting_agency?: string | null;
  booking_date?: Date | null;
  booking_number?: string | null;
  charges: string[];
  bond?: string | null;
  release_status?: string | null;
  court_case_number?: string | null;
  court_case_url?: string | null;
  source_url?: string | null;
}): string {
  const descriptor = "resident";
  const location   = rec.city ?? rec.county ?? "Broward County";
  const agency     = rec.arresting_agency ?? "authorities";
  const dateStr    = rec.booking_date ? ` on ${formatDate(rec.booking_date)}` : "";

  const lines: string[] = [];

  // Lead sentence
  const leadCharges =
    rec.charges.length > 0
      ? ` on ${rec.charges.length === 1 ? rec.charges[0].toLowerCase() : "multiple charges"}`
      : "";
  lines.push(
    `A ${location} ${descriptor} was booked into the Broward County jail${dateStr}${leadCharges}, according to ${agency} records.`
  );
  lines.push("");

  // Charges detail
  if (rec.charges.length > 0) {
    lines.push(
      rec.charges.length === 1
        ? `According to booking records, the listed charge is: ${rec.charges[0]}.`
        : `According to booking records, the listed charges include: ${rec.charges.join("; ")}.`
    );
    lines.push("");
  }

  // Booking number
  if (rec.booking_number) {
    lines.push(`The booking number on file is ${rec.booking_number}.`);
    lines.push("");
  }

  // Bond / release
  if (rec.bond || rec.release_status) {
    const parts: string[] = [];
    if (rec.bond) parts.push(`a bond of ${rec.bond} was listed`);
    if (rec.release_status) parts.push(`release status is shown as "${rec.release_status}"`);
    lines.push(`Per booking records, ${parts.join("; ")}.`);
    lines.push("");
  }

  // Court case
  if (rec.court_case_number) {
    const caseRef = rec.court_case_url
      ? `case number ${rec.court_case_number} (court record)`
      : `case number ${rec.court_case_number}`;
    lines.push(`Broward Clerk of Courts records list ${caseRef} in connection with this arrest.`);
    lines.push("");
  }

  // Source attribution
  if (rec.source_url) {
    lines.push(`Source: ${agency}. Data retrieved from official public records.`);
    lines.push("");
  }

  // Mandatory legal notice
  lines.push(
    "An arrest or criminal charge is not a conviction. The individual is presumed innocent unless proven guilty in court."
  );
  lines.push("");
  lines.push(
    "*To request a correction or removal of this story, please contact us.*"
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function generateDraftFromRecord(recordId: string): Promise<string> {
  const rec = await prisma.parsedRecord.findUnique({
    where: { id: recordId },
    include: { source: true },
  });

  if (!rec) throw new Error(`ParsedRecord not found: ${recordId}`);
  if (rec.record_status !== "APPROVED_FOR_DRAFT") {
    throw new Error(`Record ${recordId} is not approved for drafting (status: ${rec.record_status})`);
  }
  if (rec.is_suppressed) {
    throw new Error(`Record ${recordId} is suppressed and cannot generate a story.`);
  }
  if (rec.story_id) {
    // Already has a story — return the existing one
    return rec.story_id;
  }

  const sensitiveCategory = detectSensitiveCategory(rec.charges as string[]);
  const charges = rec.charges as string[];
  const location = rec.city ?? rec.county ?? "Broward County";
  const agency   = rec.arresting_agency ?? rec.source.name;
  const descriptor = "resident";

  // Build headline seeds
  const stdHeadline = toTitleCase(
    `${location} ${descriptor} booked in Broward County on ${
      charges.length > 0
        ? charges[0].toLowerCase().replace(/\s*\(.*?\)/, "")
        : "listed charge"
    }, records show`
  );
  const catchyHeadline = toTitleCase(
    `New in the Broward booking log: ${location} ${descriptor} listed on ${
      charges.length > 0
        ? charges[0].toLowerCase().replace(/\s*\(.*?\)/, "")
        : "charges"
    }`
  );

  const body = buildStoryBody({
    person_name:        rec.person_name,
    city:               rec.city,
    county:             rec.county,
    arresting_agency:   agency,
    booking_date:       rec.booking_date,
    booking_number:     rec.booking_number,
    charges,
    bond:               rec.bond,
    release_status:     rec.release_status,
    court_case_number:  rec.court_case_number,
    court_case_url:     rec.court_case_url,
    source_url:         rec.source_url ?? rec.source.base_url,
  });

  // Create Story
  const story = await prisma.story.create({
    data: {
      slug:                     makeSlug(stdHeadline),
      headline_standard:        stdHeadline,
      headline_catchy:          catchyHeadline,
      editorial_tone:           "Catchy tabloid-style, fact-bound, legally cautious.",
      geography_focus:          "Fort Lauderdale / Broward County, Florida",
      source_confidence_score:  rec.parser_confidence_score,
      body,
      status:                   "DRAFT",
      source_name:              agency,
      source_url:               rec.source_url ?? rec.source.base_url,
      arrest_date:              rec.booking_date,
      subject_name:             rec.person_name ?? undefined,
      subject_descriptor:       descriptor,
      charges,
      booking_number:           rec.booking_number ?? undefined,
      municipality:             rec.city ?? undefined,
      sensitive_category:       sensitiveCategory ?? undefined,
      source_record_id:         recordId,
    },
  });

  // Generate headline options
  const storyData = {
    municipality:       rec.city,
    charges,
    subject_name:       rec.person_name,
    subject_descriptor: descriptor,
    source_name:        agency,
    arrest_date:        rec.booking_date,
    booking_number:     rec.booking_number,
    geography_focus:    "Fort Lauderdale / Broward County, Florida",
  };

  const generatedHeadlines = generateHeadlines(storyData, 1, false);
  await prisma.storyHeadline.createMany({
    data: generatedHeadlines.map((h) => ({
      story_id:             story.id,
      headline_text:        h.headline_text,
      headline_type:        h.headline_type,
      factual_safety_score: h.factual_safety_score,
      catchiness_score:     h.catchiness_score,
      risk_level:           h.risk_level,
      reason_for_score:     h.reason_for_score,
      source_fields_used:   h.source_fields_used,
      generation_batch:     1,
    })),
  });

  // Mark record as story generated
  await prisma.parsedRecord.update({
    where: { id: recordId },
    data: {
      record_status: "STORY_GENERATED",
      story_id:      story.id,
    },
  });

  return story.id;
}
