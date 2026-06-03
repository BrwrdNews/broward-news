/**
 * Catchy tabloid-inspired headline generator.
 *
 * Generates factually-grounded, legally cautious headline options from
 * structured arrest-record data. All claims in every generated headline
 * must trace directly back to a source field on the story.
 *
 * Headline types: STANDARD · CATCHY · ALLITERATIVE · RHYME · IDIOM · SHORT_MOBILE
 */

import type { HeadlineType, RiskLevel, SensitiveCategory } from "./types";

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface HeadlineStoryData {
  municipality?: string | null;
  charges: string[];
  subject_name?: string | null;
  subject_descriptor?: string | null;
  source_name: string;
  arrest_date?: Date | null;
  booking_number?: string | null;
  geography_focus: string;
}

export interface GeneratedHeadline {
  headline_text: string;
  headline_type: HeadlineType;
  factual_safety_score: number;
  catchiness_score: number;
  risk_level: RiskLevel;
  reason_for_score: string;
  source_fields_used: string[];
}

// ---------------------------------------------------------------------------
// Sensitive-category detection
// ---------------------------------------------------------------------------

const SENSITIVE_PATTERNS: Array<[SensitiveCategory, RegExp]> = [
  ["SEX_CRIME",         /sexual|rape|lewd|lascivious|indecent exposure|solicitation|prostitut|sex offend|voyeur/i],
  ["DOMESTIC_VIOLENCE", /domestic|intimate partner|family violence|dating violence|spouse/i],
  ["MINOR_INVOLVED",    /\bminor\b|child abuse|child neglect|\bjuvenile\b|contributing.*delinquency/i],
  ["DEATH",             /murder|homicide|manslaughter|\bdeath\b/i],
  ["SERIOUS_INJURY",    /aggravated battery|aggravated assault|great bodily|maim|disfigur/i],
  ["HUMAN_TRAFFICKING", /human trafficking|smuggling.*person/i],
  ["HATE_CRIME",        /hate crime|bias.?motivated/i],
  ["MENTAL_HEALTH",     /baker act|involuntary commitment|mental health crisis/i],
];

export function detectSensitiveCategory(
  charges: string[]
): SensitiveCategory | null {
  const text = charges.join(" ");
  for (const [cat, re] of SENSITIVE_PATTERNS) {
    if (re.test(text)) return cat;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Charge simplification
// ---------------------------------------------------------------------------

export function simplifyCharge(charge: string): string {
  const c = charge.toLowerCase();

  // Drug
  if (/cocaine|heroin|fentanyl|methamphetamine|\bmeth\b|marijuana|cannabis|mdma|ecstasy|oxycodone|hydrocodone/.test(c)) {
    if (/intent|trafficking|deliver|distribut|manufacture/.test(c)) return "drug trafficking charge";
    if (/paraphernalia/.test(c)) return "drug paraphernalia charge";
    return "drug possession charge";
  }
  // DUI
  if (/dui|dwi|driving under the influence|driving while impaired/.test(c)) return "DUI charge";

  // Weapons
  if (/firearm|weapon|gun|pistol|rifle|ammunition|explosive/.test(c)) {
    if (/conceal/.test(c)) return "concealed weapon charge";
    if (/possess.*felon|felon.*possess/.test(c)) return "felon in possession of a firearm charge";
    return "weapons charge";
  }

  // Violence / injury
  if (/murder|homicide/.test(c)) return "homicide charge";
  if (/manslaughter/.test(c)) return "manslaughter charge";
  if (/aggravated battery/.test(c)) return "aggravated battery charge";
  if (/aggravated assault/.test(c)) return "aggravated assault charge";
  if (/battery/.test(c)) return "battery charge";
  if (/assault/.test(c)) return "assault charge";
  if (/kidnap/.test(c)) return "kidnapping charge";
  if (/stalk/.test(c)) return "stalking charge";

  // Property
  if (/robbery/.test(c)) return "robbery charge";
  if (/burglary/.test(c)) return "burglary charge";
  if (/theft|larceny|shoplifting/.test(c)) return "theft charge";
  if (/arson/.test(c)) return "arson charge";
  if (/criminal mischief|vandalism/.test(c)) return "vandalism charge";
  if (/trespass/.test(c)) return "trespass charge";

  // Financial / fraud
  if (/identity theft/.test(c)) return "identity theft charge";
  if (/fraud|forgery|counterfeit/.test(c)) return "fraud charge";

  // Traffic / police
  if (/fleeing|eluding/.test(c)) return "fleeing police charge";
  if (/reckless driving/.test(c)) return "reckless driving charge";
  if (/resist/.test(c)) return "resisting arrest charge";
  if (/obstruct/.test(c)) return "obstruction charge";
  if (/disorderly/.test(c)) return "disorderly conduct charge";

  // Fallback — strip leading charge numbers, truncate
  const clean = charge.replace(/^\d+[\.\)]\s*/, "").trim();
  return clean.length > 55 ? clean.slice(0, 52).trimEnd() + "…" : clean;
}

// ---------------------------------------------------------------------------
// Headline template context
// ---------------------------------------------------------------------------

interface HeadlineContext {
  muni:          string;   // "Fort Lauderdale" or "Broward County"
  descriptor:    string;   // "man" | "woman" | "resident" | "suspect"
  chargeSimple:  string;   // "drug possession charge"
  chargeCount:   number;   // total number of listed charges
  sourceName:    string;
  hasName:       boolean;
  isFortLauderdale: boolean;
  isSensitive:   boolean;
}

function buildContext(story: HeadlineStoryData): HeadlineContext {
  const muni = story.municipality?.trim() || "Broward County";
  const descriptor = (story.subject_descriptor?.trim() || "resident").toLowerCase();
  const primaryCharge = story.charges[0] ?? "unknown charge";
  const chargeSimple = simplifyCharge(primaryCharge);
  const isFortLauderdale = /fort lauderdale/i.test(muni);

  return {
    muni,
    descriptor,
    chargeSimple,
    chargeCount: story.charges.length,
    sourceName: story.source_name,
    hasName: !!(story.subject_name?.trim()),
    isFortLauderdale,
    isSensitive: false, // overridden by caller when needed
  };
}

// Append "+ N more charges" note when applicable
function chargesNote(ctx: HeadlineContext): string {
  return ctx.chargeCount > 1
    ? ` and ${ctx.chargeCount - 1} more charge${ctx.chargeCount - 1 > 1 ? "s" : ""}`
    : "";
}

// ---------------------------------------------------------------------------
// Template banks  (4 templates per type → cycle by batchNumber)
// ---------------------------------------------------------------------------

type TemplateFn = (ctx: HeadlineContext) => string;

const TEMPLATES: Record<HeadlineType, TemplateFn[]> = {
  // ── STANDARD ──────────────────────────────────────────────────────────────
  STANDARD: [
    (c) => `${c.muni} ${c.descriptor} booked in Broward County on ${c.chargeSimple}, records show`,
    (c) => `Broward County booking records list ${c.muni} arrest on ${c.chargeSimple}`,
    (c) => `${c.muni} ${c.descriptor} arrested on ${c.chargeSimple}, according to ${c.sourceName}`,
    (c) => `Arrest records show ${c.muni} ${c.descriptor} booked on ${c.chargeSimple} in Broward`,
  ],

  // ── CATCHY ────────────────────────────────────────────────────────────────
  CATCHY: [
    (c) => `New in the Broward booking log: ${c.muni} ${c.descriptor} listed on ${c.chargeSimple}`,
    (c) => `Behind the booking: ${c.muni} ${c.descriptor} faces ${c.chargeSimple} per records`,
    (c) => `Just filed: ${c.muni} ${c.descriptor}'s Broward booking shows ${c.chargeSimple}`,
    (c) => `Broward records reveal ${c.muni} arrest — listed charge: ${c.chargeSimple}`,
  ],

  // ── ALLITERATIVE ──────────────────────────────────────────────────────────
  ALLITERATIVE: [
    (c) => c.isFortLauderdale
      ? `Fort Lauderdale felony filing: Broward booking lists ${c.chargeSimple}`
      : `Broward booking: ${c.muni} ${c.descriptor} faces ${c.chargeSimple} filing`,
    (c) => `Booking by the books: Broward records log ${c.muni} ${c.descriptor} on ${c.chargeSimple}`,
    (c) => c.isFortLauderdale
      ? `Lauderdale listing: local ${c.descriptor} logged on ${c.chargeSimple}`
      : `${c.muni} meet booking: Broward records reveal ${c.chargeSimple} charge`,
    (c) => `Booked, badged, and on the books: ${c.muni} arrest lists ${c.chargeSimple}`,
  ],

  // ── RHYME ─────────────────────────────────────────────────────────────────
  RHYME: [
    (c) => `From the street to the booking sheet: ${c.muni} arrest lists ${c.chargeSimple}`,
    (c) => `Broward bound: ${c.muni} ${c.descriptor} faces ${c.chargeSimple} after booking found`,
    (c) => `On the beat, then off the street: ${c.muni} booking lists ${c.chargeSimple}`,
    (c) => `Booked in Broward: ${c.chargeSimple} listed after ${c.muni} arrest, case found in records`,
  ],

  // ── IDIOM ─────────────────────────────────────────────────────────────────
  IDIOM: [
    (c) => c.isFortLauderdale
      ? `Booked by the beach: Fort Lauderdale arrest record lists ${c.chargeSimple}`
      : `Booked and on record: ${c.muni} arrest lists ${c.chargeSimple}`,
    (c) => `Open book: Broward booking records show ${c.muni} arrest on ${c.chargeSimple}`,
    (c) => `Added to the roster: ${c.muni} ${c.descriptor} booked on ${c.chargeSimple}`,
    (c) => `End of the line: Broward records show ${c.muni} ${c.descriptor} arrested on ${c.chargeSimple}`,
  ],

  // ── SHORT_MOBILE ──────────────────────────────────────────────────────────
  SHORT_MOBILE: [
    (c) => `${c.muni} ${c.descriptor} booked on ${c.chargeSimple}`,
    (c) => `Broward arrest: ${c.muni} — ${c.chargeSimple}`,
    (c) => `${c.muni} booking lists ${c.chargeSimple}`,
    (c) => `Booked in Broward: ${c.muni} ${c.chargeSimple}`,
  ],
};

// Neutral-only templates for sensitive stories (all typed STANDARD)
const NEUTRAL_TEMPLATES: TemplateFn[] = [
  (c) => `${c.muni} ${c.descriptor} booked in Broward County, records show`,
  (c) => `Broward County booking record lists ${c.muni} arrest`,
  (c) => `${c.muni} ${c.descriptor} listed in Broward booking records, according to ${c.sourceName}`,
];

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

// Words/phrases that imply guilt or are inflammatory — lower safety score
const GUILT_PHRASES = [
  /\bthug\b/i, /\bcrook\b/i, /\bmonster\b/i, /\bpredator\b/i, /\bfiend\b/i,
  /career criminal/i, /\bcriminal\b/i, /caught red.?handed/i, /\bperp\b/i,
  /\bfelony\b(?! (charge|filing|count|case))/i, // "felony" alone is ok as noun modifier
];

const UNSUPPORTED_ADJECTIVES = [
  /\bshocking\b/i, /\bwild\b/i, /\bterrifying\b/i, /\bbrazen\b/i,
  /\bviolent\b/i, /\bdisturbing\b/i, /\bhorrible\b/i, /\bsensational\b/i,
  /\bbrutal\b/i, /\bvicious\b/i,
];

const BASE_SCORES: Record<HeadlineType, { factual: number; catchy: number }> = {
  STANDARD:     { factual: 9, catchy: 5 },
  CATCHY:       { factual: 8, catchy: 8 },
  ALLITERATIVE: { factual: 8, catchy: 7 },
  RHYME:        { factual: 8, catchy: 8 },
  IDIOM:        { factual: 8, catchy: 8 },
  SHORT_MOBILE: { factual: 9, catchy: 6 },
};

function scoreHeadline(
  text: string,
  type: HeadlineType,
  isSensitive: boolean
): { factual: number; catchy: number; reasons: string[] } {
  let { factual, catchy } = { ...BASE_SCORES[type] };
  const reasons: string[] = [];

  // Guilt-implying language
  for (const re of GUILT_PHRASES) {
    if (re.test(text)) {
      factual -= 5;
      reasons.push(`Contains guilt-implying language matching /${re.source}/`);
    }
  }

  // Unsupported adjectives
  for (const re of UNSUPPORTED_ADJECTIVES) {
    if (re.test(text)) {
      factual -= 3;
      catchy -= 1;
      reasons.push(`Contains unsupported adjective matching /${re.source}/`);
    }
  }

  // Length scoring
  const len = text.length;
  if (len >= 45 && len <= 95) {
    catchy += 1;
  } else if (len < 30 || len > 130) {
    catchy -= 2;
    reasons.push(`Headline length (${len}) is outside preferred range`);
  }

  // Sensitive story penalty — even neutral types score lower on catchiness
  if (isSensitive) {
    catchy = Math.min(catchy, 5);
    if (type !== "STANDARD" && type !== "SHORT_MOBILE") {
      factual -= 2;
      reasons.push("Non-neutral headline type used on sensitive story");
    }
  }

  // Clamp
  factual = Math.max(1, Math.min(10, factual));
  catchy  = Math.max(1, Math.min(10, catchy));

  if (reasons.length === 0) {
    reasons.push("Template is factually grounded in source fields with no prohibited language detected");
  }

  return { factual, catchy, reasons };
}

function riskFromScore(factual: number): RiskLevel {
  if (factual >= 8) return "LOW";
  if (factual >= 5) return "MEDIUM";
  return "HIGH";
}

// Title-case first letter of each sentence/headline
function toTitleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate a batch of headlines for the given story data.
 *
 * @param story       - Structured story fields
 * @param batchNumber - 1-based batch counter (determines template variant)
 * @param safeOnly    - If true, generate only STANDARD type (for "safer rewrite")
 */
export function generateHeadlines(
  story: HeadlineStoryData,
  batchNumber: number = 1,
  safeOnly: boolean = false
): GeneratedHeadline[] {
  const sensitiveCategory = detectSensitiveCategory(story.charges);
  const isSensitive = sensitiveCategory !== null;
  const ctx = buildContext(story);
  ctx.isSensitive = isSensitive;

  const results: GeneratedHeadline[] = [];

  // Sensitive stories → only neutral STANDARD headlines
  if (isSensitive) {
    for (let i = 0; i < 3; i++) {
      const fn = NEUTRAL_TEMPLATES[(batchNumber - 1 + i) % NEUTRAL_TEMPLATES.length];
      const text = toTitleCase(fn(ctx));
      const { factual, catchy, reasons } = scoreHeadline(text, "STANDARD", true);
      results.push({
        headline_text: text,
        headline_type: "STANDARD",
        factual_safety_score: factual,
        catchiness_score: catchy,
        risk_level: riskFromScore(factual),
        reason_for_score: reasons.join(". "),
        source_fields_used: buildSourceFieldsUsed("STANDARD", story),
      });
    }
    return results;
  }

  // Normal stories → all 6 types (or just STANDARD for safe rewrite)
  const typesToGenerate: HeadlineType[] = safeOnly
    ? ["STANDARD"]
    : ["STANDARD", "CATCHY", "ALLITERATIVE", "RHYME", "IDIOM", "SHORT_MOBILE"];

  for (const type of typesToGenerate) {
    const templates = TEMPLATES[type];
    const idx = (batchNumber - 1) % templates.length;
    const raw = templates[idx](ctx);
    // Append charges note to non-SHORT_MOBILE types when multiple charges exist
    const withNote =
      type !== "SHORT_MOBILE" && ctx.chargeCount > 1
        ? raw + chargesNote(ctx)
        : raw;
    const text = toTitleCase(withNote);

    const { factual, catchy, reasons } = scoreHeadline(text, type, false);

    results.push({
      headline_text: text,
      headline_type: type,
      factual_safety_score: factual,
      catchiness_score: catchy,
      risk_level: riskFromScore(factual),
      reason_for_score: reasons.join(". "),
      source_fields_used: buildSourceFieldsUsed(type, story),
    });
  }

  return results;
}

// Track which story fields contributed to the headline
function buildSourceFieldsUsed(
  type: HeadlineType,
  story: HeadlineStoryData
): string[] {
  const fields: string[] = [];
  if (story.municipality) fields.push("municipality");
  if (story.charges.length > 0) fields.push("charges[0]");
  if (story.charges.length > 1) fields.push(`charges[1..${story.charges.length - 1}]`);
  if (story.source_name) fields.push("source_name");
  if (story.arrest_date) fields.push("arrest_date");
  if (type === "CATCHY" || type === "SHORT_MOBILE") {
    fields.push("subject_descriptor");
  }
  return fields;
}
