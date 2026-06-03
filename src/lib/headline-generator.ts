/**
 * Tabloid-style headline generator — "Sensational but cautious" mode.
 *
 * Every headline follows the formula:
 *   [Local person descriptor] + [booking/arrest/charge event]
 *   + [specific source-supported detail] + [legal qualifier]
 *
 * Example output:
 *   "Fort Lauderdale man is booked on drug possession charge after
 *    Broward records list additional listed count"
 *
 * Seven types:
 *   DAILY_MAIL_HOOK  · DRAMATIC_LOCAL · CHARGE_FOCUSED
 *   RECORDS_REVEAL   · POLICE_SAY     · SHORT_MOBILE   · SAFER_FALLBACK
 *
 * All claims trace directly to a source field. No invented facts.
 * No guilt-implying language. Presumption of innocence is preserved.
 */

import type { HeadlineType, RiskLevel, SensitiveCategory, EditorialTone } from "./types";

// ===========================================================================
// Public interfaces
// ===========================================================================

export interface HeadlineStoryData {
  municipality?: string | null;
  charges: string[];
  subject_name?: string | null;
  subject_descriptor?: string | null;
  source_name: string;
  arrest_date?: Date | null;
  booking_number?: string | null;
  geography_focus: string;
  // Optional enrichment fields from ParsedRecord
  bond?: string | null;
  release_status?: string | null;
  arresting_agency?: string | null;
}

export interface GeneratedHeadline {
  headline_text: string;
  deck: string;
  headline_type: HeadlineType;
  factual_safety_score: number;   // 1–10
  catchiness_score: number;       // 1–10
  uniqueness_score: number;       // 1–10 (story-specificity)
  sensationalism_score: number;   // 1–10 (drama level)
  risk_level: RiskLevel;
  reason_for_score: string;
  source_fields_used: string[];
}

// ===========================================================================
// Sensitive-category detection
// ===========================================================================

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

export function detectSensitiveCategory(charges: string[]): SensitiveCategory | null {
  const text = charges.join(" ");
  for (const [cat, re] of SENSITIVE_PATTERNS) {
    if (re.test(text)) return cat;
  }
  return null;
}

// ===========================================================================
// Charge simplification
// ===========================================================================

export function simplifyCharge(charge: string): string {
  const c = charge.toLowerCase();
  if (/cocaine|heroin|fentanyl|methamphetamine|\bmeth\b|marijuana|cannabis|mdma|ecstasy|oxycodone|hydrocodone/.test(c)) {
    if (/intent|trafficking|deliver|distribut|manufacture/.test(c)) return "drug trafficking charge";
    if (/paraphernalia/.test(c)) return "drug paraphernalia charge";
    return "drug possession charge";
  }
  if (/dui|dwi|driving under the influence|driving while impaired/.test(c)) return "DUI charge";
  if (/firearm|weapon|gun|pistol|rifle|ammunition|explosive/.test(c)) {
    if (/conceal/.test(c)) return "concealed weapon charge";
    if (/possess.*felon|felon.*possess/.test(c)) return "felon in possession of a firearm charge";
    return "weapons charge";
  }
  if (/murder|homicide/.test(c)) return "homicide charge";
  if (/manslaughter/.test(c)) return "manslaughter charge";
  if (/aggravated battery/.test(c)) return "aggravated battery charge";
  if (/aggravated assault/.test(c)) return "aggravated assault charge";
  if (/battery/.test(c)) return "battery charge";
  if (/assault/.test(c)) return "assault charge";
  if (/kidnap/.test(c)) return "kidnapping charge";
  if (/stalk/.test(c)) return "stalking charge";
  if (/robbery/.test(c)) return "robbery charge";
  if (/burglary/.test(c)) return "burglary charge";
  if (/theft|larceny|shoplifting/.test(c)) return "theft charge";
  if (/arson/.test(c)) return "arson charge";
  if (/criminal mischief|vandalism/.test(c)) return "vandalism charge";
  if (/trespass/.test(c)) return "trespass charge";
  if (/identity theft/.test(c)) return "identity theft charge";
  if (/fraud|forgery|counterfeit/.test(c)) return "fraud charge";
  if (/fleeing|eluding/.test(c)) return "fleeing police charge";
  if (/reckless driving/.test(c)) return "reckless driving charge";
  if (/resist/.test(c)) return "resisting arrest charge";
  if (/obstruct/.test(c)) return "obstruction charge";
  if (/disorderly/.test(c)) return "disorderly conduct charge";
  const clean = charge.replace(/^\d+[\.\)]\s*/, "").trim();
  return clean.length > 55 ? clean.slice(0, 52).trimEnd() + "…" : clean;
}

// ===========================================================================
// Context
// ===========================================================================

interface HeadlineContext {
  muni:          string;   // "Fort Lauderdale"
  descriptor:    string;   // "man" | "woman" | "resident"
  chargeSimple:  string;   // "drug possession charge"
  chargeCount:   number;
  sourceName:    string;
  agencyShort:   string;   // "Fort Lauderdale police" | "Broward deputies"
  bond:          string | null;
  releaseStatus: string | null;
  isSensitive:   boolean;
}

function shortAgency(name: string): string {
  if (/broward.*sheriff|bso/i.test(name))        return "Broward deputies";
  if (/fort lauderdale.*police|flpd/i.test(name)) return "Fort Lauderdale police";
  if (/pompano.*beach.*police/i.test(name))        return "Pompano Beach police";
  if (/deerfield.*beach.*police/i.test(name))      return "Deerfield Beach police";
  if (/hallandale.*beach.*police/i.test(name))     return "Hallandale Beach police";
  if (/pembroke.*pines.*police/i.test(name))       return "Pembroke Pines police";
  if (/coral.*springs.*police/i.test(name))        return "Coral Springs police";
  if (/miramar.*police/i.test(name))               return "Miramar police";
  if (/sunrise.*police/i.test(name))               return "Sunrise police";
  if (/plantation.*police/i.test(name))            return "Plantation police";
  if (/hollywood.*police/i.test(name))             return "Hollywood police";
  return "local police";
}

function buildContext(story: HeadlineStoryData): HeadlineContext {
  const muni        = story.municipality?.trim() || "Broward County";
  const descriptor  = (story.subject_descriptor?.trim() || "resident").toLowerCase();
  const primaryCharge = story.charges[0] ?? "";
  const chargeSimple  = simplifyCharge(primaryCharge);
  const agency = story.arresting_agency ?? story.source_name;

  return {
    muni,
    descriptor,
    chargeSimple,
    chargeCount: story.charges.length,
    sourceName:  story.source_name,
    agencyShort: shortAgency(agency),
    bond:          story.bond?.trim() || null,
    releaseStatus: story.release_status?.trim() || null,
    isSensitive: false,
  };
}

// ===========================================================================
// Story-specific detail — the key to unique, non-generic headlines
// ===========================================================================

/**
 * Picks the most distinctive available detail from the record.
 * Used in the [specific detail] slot of the headline formula.
 * Per requirements: never say "1 more charge" — say "additional listed count".
 */
function extraDetail(ctx: HeadlineContext, variant: 0 | 1 | 2 | 3 = 0): string {
  // Multiple charges → this is the most common differentiator
  if (ctx.chargeCount === 2) {
    const variants = [
      "additional listed count",
      "second listed charge",
      "additional listed charge",
      "second listed count",
    ];
    return variants[variant % variants.length];
  }
  if (ctx.chargeCount === 3) return "two additional listed charges";
  if (ctx.chargeCount > 3)   return `${ctx.chargeCount - 1} additional listed charges`;

  // Bond
  if (ctx.bond) {
    const variants = [
      `bond set at ${ctx.bond}`,
      `${ctx.bond} bond listed`,
      `bond listed at ${ctx.bond}`,
      `${ctx.bond} bond in records`,
    ];
    return variants[variant % variants.length];
  }

  // Release status
  if (ctx.releaseStatus) {
    const s = ctx.releaseStatus.toLowerCase();
    if (s.includes("release")) return "release on bond listed in records";
    if (s.includes("held"))    return "held status listed in records";
    return `${ctx.releaseStatus.toLowerCase()} status shown in records`;
  }

  // Default — factual and still readable
  const defaults = [
    "arrest confirmed by officials",
    "records filed by officials",
    "arrest logged by officials",
    "booking filed in records",
  ];
  return defaults[variant % defaults.length];
}

// ===========================================================================
// Deck builder — factual subheadline
// ===========================================================================

function buildDeck(ctx: HeadlineContext, story: HeadlineStoryData): string {
  const source = ctx.sourceName;
  const loc    = ctx.muni;
  const desc   = ctx.descriptor;
  const charge = ctx.chargeSimple;

  let base = `${source} booking records list a ${loc} ${desc} on a ${charge}`;

  if (ctx.chargeCount === 2) {
    base += " and an additional listed charge";
  } else if (ctx.chargeCount === 3) {
    base += " and two additional listed charges";
  } else if (ctx.chargeCount > 3) {
    base += ` and ${ctx.chargeCount - 1} additional listed charges`;
  }

  if (ctx.bond) {
    base += `, with bond set at ${ctx.bond}`;
  } else if (ctx.releaseStatus) {
    base += `; ${desc} is listed as ${ctx.releaseStatus.toLowerCase()} in records`;
  }

  base += ".";
  return base;
}

// ===========================================================================
// Template banks — 4 variants per type, cycled by batchNumber
//
// Formula for all non-SAFER_FALLBACK types:
//   [Muni descriptor] + [booking/charge event] + [specific detail] + [legal qualifier]
//
// Allowed qualifiers (per requirements):
//   records reveal · records show · booking records list · appears in booking records
//   was booked on · police say · officials say · according to records
//   jail records list · booking log shows · faces listed charge
//   second count listed · additional charge listed
// ===========================================================================

type TemplateFn = (ctx: HeadlineContext, variant: 0|1|2|3) => string;

const TEMPLATES: Record<HeadlineType, TemplateFn[]> = {

  // ── DAILY_MAIL_HOOK ─────────────────────────────────────────────────────────
  // Long, dramatic, full formula. This is the flagship type.
  DAILY_MAIL_HOOK: [
    (c, v) => `${c.muni} ${c.descriptor} is booked on ${c.chargeSimple} after Broward records list ${extraDetail(c, v)}`,
    (c, v) => `${c.muni} ${c.descriptor} lands in Broward booking log on ${c.chargeSimple} as records reveal ${extraDetail(c, v)}`,
    (c, v) => `${c.muni} ${c.descriptor} appears in Broward jail records on ${c.chargeSimple} — ${extraDetail(c, v)} confirmed`,
    (c, v) => `${c.muni} ${c.descriptor}'s Broward booking shows ${c.chargeSimple} as officials confirm ${extraDetail(c, v)}`,
  ],

  // ── DRAMATIC_LOCAL ──────────────────────────────────────────────────────────
  // Punchy, place-forward. The location is the emotional anchor.
  DRAMATIC_LOCAL: [
    (c, v) => `Broward booking records show ${c.muni} ${c.descriptor} facing ${c.chargeSimple} — ${extraDetail(c, v)}`,
    (c, v) => `${c.muni} ${c.descriptor} turns up in Broward jail records on ${c.chargeSimple}, ${c.agencyShort} say`,
    (c, v) => `${c.muni} ${c.descriptor} named in Broward booking records on ${c.chargeSimple} following ${c.agencyShort} arrest`,
    (c, v) => `From ${c.muni} to Broward booking: ${c.descriptor} listed on ${c.chargeSimple} as records confirm ${extraDetail(c, v)}`,
  ],

  // ── CHARGE_FOCUSED ──────────────────────────────────────────────────────────
  // The charge itself drives the hook.
  CHARGE_FOCUSED: [
    (c, v) => `${c.muni} ${c.descriptor} added to Broward booking records on ${c.chargeSimple} — ${extraDetail(c, v)}`,
    (c, v) => `Broward records list ${c.muni} ${c.descriptor} on ${c.chargeSimple} with ${extraDetail(c, v)} in official filing`,
    (c, v) => `${c.chargeSimple} charge listed against ${c.muni} ${c.descriptor} in Broward booking records`,
    (c, v) => `${c.muni} ${c.descriptor} named in Broward ${c.chargeSimple} filing — officials note ${extraDetail(c, v)}`,
  ],

  // ── RECORDS_REVEAL ──────────────────────────────────────────────────────────
  // The records themselves are the narrator; strong curiosity hook.
  RECORDS_REVEAL: [
    (c, v) => `Broward records reveal ${c.muni} ${c.descriptor} was booked on ${c.chargeSimple} and ${extraDetail(c, v)}`,
    (c, _) => `Records show ${c.muni} ${c.descriptor} was booked in Broward County on ${c.chargeSimple}`,
    (c, _) => `Broward County booking records reveal ${c.muni} ${c.descriptor} listed on ${c.chargeSimple}`,
    (c, v) => `Jail records reveal ${c.muni} ${c.descriptor} booked on ${c.chargeSimple} after ${c.agencyShort} arrest — ${extraDetail(c, v)}`,
  ],

  // ── POLICE_SAY ──────────────────────────────────────────────────────────────
  // Authority attribution is up front — strongest legal cover.
  POLICE_SAY: [
    (c, _) => `Police say ${c.muni} ${c.descriptor} was booked on ${c.chargeSimple} in latest Broward arrest`,
    (c, v) => `${c.agencyShort} say ${c.muni} ${c.descriptor} was arrested on ${c.chargeSimple} — ${extraDetail(c, v)}, records confirm`,
    (c, _) => `Officials say ${c.muni} ${c.descriptor} was booked on ${c.chargeSimple} in Broward County, records show`,
    (c, _) => `${c.muni} ${c.descriptor} was booked on ${c.chargeSimple}, ${c.agencyShort} records show`,
  ],

  // ── SHORT_MOBILE ────────────────────────────────────────────────────────────
  // 40–65 chars. Works in push notifications and social previews.
  SHORT_MOBILE: [
    (c, _) => `${c.muni} ${c.descriptor} booked on ${c.chargeSimple}, Broward records say`,
    (c, _) => `Broward: ${c.muni} ${c.descriptor} faces ${c.chargeSimple}, records show`,
    (c, _) => `${c.muni} ${c.descriptor} in Broward booking on ${c.chargeSimple}`,
    (c, _) => `${c.muni} ${c.descriptor} booked on ${c.chargeSimple} — officials`,
  ],

  // ── SAFER_FALLBACK ──────────────────────────────────────────────────────────
  // Plain factual — used for sensitive stories and as the neutral option.
  SAFER_FALLBACK: [
    (c, _) => `${c.muni} ${c.descriptor} booked in Broward County on ${c.chargeSimple}, records show`,
    (c, _) => `Broward County booking records list ${c.muni} ${c.descriptor} on ${c.chargeSimple}`,
    (c, _) => `${c.muni} ${c.descriptor} arrested on ${c.chargeSimple}, according to ${c.sourceName}`,
    (c, _) => `Arrest records show ${c.muni} ${c.descriptor} booked on ${c.chargeSimple} in Broward`,
  ],
};

// Neutral-only templates for sensitive stories
const NEUTRAL_TEMPLATES: TemplateFn[] = [
  (c, _) => `${c.muni} ${c.descriptor} booked in Broward County, records show`,
  (c, _) => `Broward County booking record lists ${c.muni} arrest`,
  (c, _) => `${c.muni} ${c.descriptor} listed in Broward booking records, according to ${c.sourceName}`,
];

// ===========================================================================
// Scoring
// ===========================================================================

const GUILT_PHRASES = [
  /\bdealer\b/i, /\bthug\b/i, /\bcrook\b/i, /\bmonster\b/i, /\bpredator\b/i,
  /\bfiend\b/i, /career criminal/i, /\bcriminal\b(?! charge| case| record)/i,
  /caught red.?handed/i, /\bperp\b/i, /\bguilty\b/i, /committed the/i,
  /\bkiller\b/i, /\bassailant\b/i, /\boffender\b/i,
];

const UNSUPPORTED_ADJECTIVES = [
  /\bshocking\b/i, /\bwild\b/i, /\bterrifying\b/i, /\bbrazen\b/i,
  /\bviolent\b/i,  /\bdisturbing\b/i, /\bhorrible\b/i, /\bbrutal\b/i,
  /\bvicious\b/i,  /\bbizarre\b/i, /\bheinous\b/i, /\bsickening\b/i,
  /crime spree/i,  /\btaken down\b/i, /\bexposed\b/i, /\bbusted\b/i,
];

interface BaseScores { factual: number; catchy: number; sensationalism: number }
const BASE: Record<HeadlineType, BaseScores> = {
  DAILY_MAIL_HOOK: { factual: 8, catchy: 9, sensationalism: 8 },
  DRAMATIC_LOCAL:  { factual: 8, catchy: 8, sensationalism: 7 },
  CHARGE_FOCUSED:  { factual: 8, catchy: 7, sensationalism: 6 },
  RECORDS_REVEAL:  { factual: 9, catchy: 7, sensationalism: 5 },
  POLICE_SAY:      { factual: 9, catchy: 7, sensationalism: 6 },
  SHORT_MOBILE:    { factual: 9, catchy: 6, sensationalism: 4 },
  SAFER_FALLBACK:  { factual: 9, catchy: 5, sensationalism: 3 },
};

function scoreHeadline(
  text: string,
  type: HeadlineType,
  ctx: HeadlineContext
): { factual: number; catchy: number; sensationalism: number; reasons: string[] } {
  let { factual, catchy, sensationalism } = { ...BASE[type] };
  const reasons: string[] = [];

  for (const re of GUILT_PHRASES) {
    if (re.test(text)) { factual -= 5; reasons.push(`Guilt-implying language: "${re.source}"`); }
  }
  for (const re of UNSUPPORTED_ADJECTIVES) {
    if (re.test(text)) { factual -= 3; catchy -= 1; reasons.push(`Unsupported adjective: "${re.source}"`); }
  }

  const len = text.length;
  if (len >= 50 && len <= 110) catchy += 1;
  else if (len < 25 || len > 140) { catchy -= 2; reasons.push(`Length ${len} outside optimal range`); }

  if (ctx.isSensitive) {
    catchy        = Math.min(catchy, 5);
    sensationalism = Math.min(sensationalism, 3);
    if (type !== "SAFER_FALLBACK" && type !== "SHORT_MOBILE") {
      factual -= 2;
      reasons.push("Non-neutral type on sensitive story");
    }
  }

  factual        = Math.max(1, Math.min(10, factual));
  catchy         = Math.max(1, Math.min(10, catchy));
  sensationalism = Math.max(1, Math.min(10, sensationalism));

  if (reasons.length === 0) reasons.push("Factually grounded template — no prohibited language detected");
  return { factual, catchy, sensationalism, reasons };
}

function riskFromScore(factual: number): RiskLevel {
  if (factual >= 8) return "LOW";
  if (factual >= 5) return "MEDIUM";
  return "HIGH";
}

/** Measures how story-specific the headline is (higher = more unique to this record). */
function computeUniquenessScore(text: string, ctx: HeadlineContext): number {
  let score = 2;
  // Contains the specific charge category (not just "a charge")
  const chargeBase = ctx.chargeSimple.replace(/ charge$/, "");
  if (new RegExp(chargeBase.replace(/[()]/g, "\\$&"), "i").test(text)) score += 3;
  // Contains the municipality
  if (new RegExp(ctx.muni, "i").test(text)) score += 2;
  // Contains a specific detail (bond, count, agency)
  if (/additional|second listed|bond set|bond listed|\$\d|held status|released on bond/.test(text)) score += 2;
  // Contains agency name
  if (new RegExp(ctx.agencyShort.split(" ")[0], "i").test(text)) score += 1;
  return Math.min(score, 10);
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ===========================================================================
// Which types to generate based on editorial tone
// ===========================================================================

function typesForTone(tone: EditorialTone): HeadlineType[] {
  if (tone === "NEUTRAL") return ["SAFER_FALLBACK", "SHORT_MOBILE"];
  if (tone === "CATCHY")  return ["DAILY_MAIL_HOOK", "DRAMATIC_LOCAL", "RECORDS_REVEAL", "POLICE_SAY", "SHORT_MOBILE", "SAFER_FALLBACK"];
  // SENSATIONAL_CAUTIOUS (default) — all 7
  return ["DAILY_MAIL_HOOK", "DRAMATIC_LOCAL", "CHARGE_FOCUSED", "RECORDS_REVEAL", "POLICE_SAY", "SHORT_MOBILE", "SAFER_FALLBACK"];
}

// ===========================================================================
// Main export
// ===========================================================================

/**
 * Generate a batch of tabloid-formula headlines for the given story data.
 *
 * @param story        Structured story/record fields
 * @param batchNumber  1-based batch counter — determines which template variant is used
 * @param safeOnly     Generate only SAFER_FALLBACK (for "Safer rewrite" button)
 * @param tone         Editorial tone (default: SENSATIONAL_CAUTIOUS)
 */
export function generateHeadlines(
  story: HeadlineStoryData,
  batchNumber = 1,
  safeOnly = false,
  tone: EditorialTone = "SENSATIONAL_CAUTIOUS"
): GeneratedHeadline[] {
  const sensitiveCategory = detectSensitiveCategory(story.charges);
  const isSensitive       = sensitiveCategory !== null;
  const ctx               = buildContext(story);
  ctx.isSensitive         = isSensitive;

  const variant = ((batchNumber - 1) % 4) as 0|1|2|3;

  // Sensitive stories → only neutral SAFER_FALLBACK headlines
  if (isSensitive) {
    return NEUTRAL_TEMPLATES.map((fn, i) => {
      const text = cap(fn(ctx, ((i + batchNumber - 1) % 4) as 0|1|2|3));
      const deck = buildDeck(ctx, story);
      const { factual, catchy, sensationalism, reasons } = scoreHeadline(text, "SAFER_FALLBACK", ctx);
      return {
        headline_text:        text,
        deck,
        headline_type:        "SAFER_FALLBACK" as HeadlineType,
        factual_safety_score: factual,
        catchiness_score:     catchy,
        uniqueness_score:     computeUniquenessScore(text, ctx),
        sensationalism_score: sensationalism,
        risk_level:           riskFromScore(factual),
        reason_for_score:     reasons.join(". "),
        source_fields_used:   buildSourceFields(story),
      };
    });
  }

  // Determine which types to generate
  const typesToGenerate: HeadlineType[] = safeOnly
    ? ["SAFER_FALLBACK"]
    : typesForTone(tone);

  return typesToGenerate.map((type) => {
    const templates = TEMPLATES[type];
    const tIdx = (batchNumber - 1) % templates.length;
    const rawText = templates[tIdx](ctx, variant);
    const text    = cap(rawText);
    const deck    = buildDeck(ctx, story);

    const { factual, catchy, sensationalism, reasons } = scoreHeadline(text, type, ctx);

    return {
      headline_text:        text,
      deck,
      headline_type:        type,
      factual_safety_score: factual,
      catchiness_score:     catchy,
      uniqueness_score:     computeUniquenessScore(text, ctx),
      sensationalism_score: sensationalism,
      risk_level:           riskFromScore(factual),
      reason_for_score:     reasons.join(". "),
      source_fields_used:   buildSourceFields(story),
    };
  });
}

function buildSourceFields(story: HeadlineStoryData): string[] {
  const fields: string[] = [];
  if (story.municipality)               fields.push("municipality");
  if (story.charges.length > 0)         fields.push("charges[0]");
  if (story.charges.length > 1)         fields.push(`charges[1..${story.charges.length - 1}]`);
  if (story.source_name)                fields.push("source_name");
  if (story.arrest_date)                fields.push("arrest_date");
  if (story.bond)                       fields.push("bond");
  if (story.release_status)             fields.push("release_status");
  if (story.arresting_agency)           fields.push("arresting_agency");
  if (story.subject_descriptor)         fields.push("subject_descriptor");
  return fields;
}
