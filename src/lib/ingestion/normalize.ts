/**
 * Normalizes raw ParsedRecordInput fields into consistent formats:
 *   - Person names: "LAST, FIRST" → "First Last" (title case)
 *   - City/agency names: standardize abbreviations
 *   - Charges: trim, deduplicate, detect sensitive categories
 *   - Juvenile/minor suppression check
 */

import type { ParsedRecordInput } from "./types";
import type { SensitiveCategory } from "@/lib/types";

// ---------------------------------------------------------------------------
// Name normalization
// ---------------------------------------------------------------------------

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Converts "LAST, FIRST MIDDLE" → "First Middle Last"
 * Leaves "First Last" style names unchanged.
 */
export function normalizeName(raw: string | undefined | null): string | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim();
  if (s.includes(",")) {
    const [last, rest] = s.split(",", 2);
    return toTitleCase(`${rest.trim()} ${last.trim()}`);
  }
  return toTitleCase(s);
}

// ---------------------------------------------------------------------------
// City / agency normalization
// ---------------------------------------------------------------------------

const CITY_ALIASES: Record<string, string> = {
  "FT. LAUDERDALE":    "Fort Lauderdale",
  "FT LAUDERDALE":     "Fort Lauderdale",
  "FORT LAUDERDALE":   "Fort Lauderdale",
  "LAUDERDALE":        "Fort Lauderdale",
  "POMPANO":           "Pompano Beach",
  "DEERFIELD":         "Deerfield Beach",
  "HALLANDALE":        "Hallandale Beach",
  "PEMBROKE PINES":    "Pembroke Pines",
  "COCONUT CREEK":     "Coconut Creek",
  "CORAL SPRINGS":     "Coral Springs",
  "MARGATE":           "Margate",
  "TAMARAC":           "Tamarac",
  "SUNRISE":           "Sunrise",
  "PLANTATION":        "Plantation",
  "DAVIE":             "Davie",
  "WESTON":            "Weston",
  "MIRAMAR":           "Miramar",
  "HOLLYWOOD":         "Hollywood",
  "DANIA BEACH":       "Dania Beach",
  "LAUDERHILL":        "Lauderhill",
  "NORTH LAUDERDALE":  "North Lauderdale",
  "LAUDERDALE LAKES":  "Lauderdale Lakes",
};

export function normalizeCity(raw: string | undefined | null): string | undefined {
  if (!raw?.trim()) return undefined;
  const upper = raw.trim().toUpperCase();
  return CITY_ALIASES[upper] ?? toTitleCase(raw.trim());
}

// ---------------------------------------------------------------------------
// Charge normalization
// ---------------------------------------------------------------------------

export function normalizeCharges(charges: string[]): string[] {
  return Array.from(
    new Set(
      charges
        .map((c) => c.trim().replace(/\s+/g, " "))
        .filter(Boolean)
    )
  );
}

// ---------------------------------------------------------------------------
// Sensitive category detection
// ---------------------------------------------------------------------------

const SENSITIVE_PATTERNS: Array<[SensitiveCategory, RegExp]> = [
  ["SEX_CRIME",         /sexual|rape|lewd|lascivious|indecent exposure|solicitation|prostitut|sex offend|voyeur/i],
  ["DOMESTIC_VIOLENCE", /domestic|intimate partner|family violence|dating violence/i],
  ["MINOR_INVOLVED",    /\bminor\b|child abuse|child neglect|contributing.*delinquency/i],
  ["DEATH",             /murder|homicide|manslaughter|\bdeath\b/i],
  ["SERIOUS_INJURY",    /aggravated battery|aggravated assault|great bodily|maim/i],
  ["HUMAN_TRAFFICKING", /human trafficking|smuggling.*person/i],
  ["HATE_CRIME",        /hate crime|bias.?motivated/i],
  ["MENTAL_HEALTH",     /baker act|involuntary commitment|mental health crisis/i],
];

export function detectSensitiveCategory(charges: string[]): SensitiveCategory | null {
  const text = charges.join(" ");
  for (const [cat, re] of SENSITIVE_PATTERNS) {
    if (re.test(text)) return cat;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Juvenile/minor suppression check
// ---------------------------------------------------------------------------

const JUVENILE_INDICATORS = [
  /\bjuvenile\b/i,
  /\bminor\b/i,
  /\bchild\b/i,
  /\bteen\b/i,
  /\byouth\b/i,
  /\b\d{1,2}\s*year[- ]old\b/i,
  /contributing.*delinquency/i,
  /school zone/i,
];

export function checkJuvenileSuppression(record: ParsedRecordInput): {
  suppress: boolean;
  reason: string | null;
} {
  const text = [...record.charges, record.raw_text ?? "", record.person_name ?? ""].join(" ");
  for (const re of JUVENILE_INDICATORS) {
    if (re.test(text)) {
      return {
        suppress: true,
        reason: `Record may involve a minor (matched: /${re.source}/). Suppressed pending admin review.`,
      };
    }
  }
  return { suppress: false, reason: null };
}

// ---------------------------------------------------------------------------
// Stale-source warning threshold
// ---------------------------------------------------------------------------

export function isSourceStale(retrievedAt: Date, thresholdHours = 24): boolean {
  const ageMs = Date.now() - retrievedAt.getTime();
  return ageMs > thresholdHours * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Full normalize pass
// ---------------------------------------------------------------------------

export interface NormalizedRecord extends ParsedRecordInput {
  person_name: string | undefined;
  city: string | undefined;
  charges: string[];
  is_suppressed: boolean;
  suppression_reason: string | null;
}

export function normalizeRecord(raw: ParsedRecordInput): NormalizedRecord {
  const charges = normalizeCharges(raw.charges);
  const { suppress, reason } = checkJuvenileSuppression({ ...raw, charges });

  return {
    ...raw,
    person_name: normalizeName(raw.person_name),
    city: normalizeCity(raw.city),
    charges,
    is_suppressed: suppress,
    suppression_reason: reason,
  };
}
