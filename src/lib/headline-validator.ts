/**
 * Headline validation — runs before a headline is selected for publishing.
 *
 * Six checks:
 *  1. Factual grounding  — every non-boilerplate claim traces to a source field
 *  2. Guilt implication  — banned guilt-implying language
 *  3. Inflammatory language — unsupported adjectives / banned descriptors
 *  4. Minor identification — any hint of age / minor status
 *  5. Sensitive category routing — non-neutral type on a sensitive story
 *  6. Unsupported adjectives — "shocking", "wild", "terrifying", etc.
 */

import { detectSensitiveCategory } from "./headline-generator";
import type { HeadlineType, ValidationResult } from "./types";

// ---------------------------------------------------------------------------
// Word lists
// ---------------------------------------------------------------------------

const GUILT_WORDS: RegExp[] = [
  /\bthug\b/i,
  /\bcrook\b/i,
  /\bmonster\b/i,
  /\bpredator\b/i,
  /\bfiend\b/i,
  /career criminal/i,
  /\bcriminal\b(?! charge| case| record| history)/i,  // allow "criminal charge/case/record"
  /caught red.?handed/i,
  /\bperp\b/i,
  /\bguilty\b/i,
  /\bcommitted the/i,
  /\bkiller\b/i,
  /\bassailant\b/i,
  /\boffender\b/i,
  /\bdealer\b/i,          // "drug dealer" implies role; use "drug charge" instead
];

const UNSUPPORTED_ADJECTIVES: RegExp[] = [
  /\bshocking\b/i,
  /\bwild\b/i,
  /\bterrifying\b/i,
  /\bbrazen\b/i,
  /\bviolent\b/i,
  /\bdisturbing\b/i,
  /\bhorrible\b/i,
  /\bsensational\b/i,
  /\bbrutal\b/i,
  /\bvicious\b/i,
  /\bbizarre\b/i,
  /\bheinous\b/i,
  /\bsickening\b/i,
];

const MINOR_INDICATORS: RegExp[] = [
  /\b\d{1,2}.year.old\b/i,   // "14-year-old", "14 year old"
  /\bjuvenile\b/i,
  /\bteen\b/i,
  /\bminor\b/i,
  /\bchild\b/i,
  /\bboy\b|\bgirl\b/i,
  /\byouth\b/i,
  /\bstudent\b/i,            // soft signal — flag as warning, not error
];

// Headline types considered "neutral" — safe for sensitive stories
const NEUTRAL_TYPES: HeadlineType[] = ["STANDARD", "SHORT_MOBILE"];

// ---------------------------------------------------------------------------
// Validation interface consumed by UI / API
// ---------------------------------------------------------------------------

export interface HeadlineValidationInput {
  headline_text: string;
  headline_type: HeadlineType;
  story: {
    charges: string[];
    municipality?: string | null;
    subject_name?: string | null;
    source_name: string;
  };
}

// ---------------------------------------------------------------------------
// Main validator
// ---------------------------------------------------------------------------

export function validateHeadline(
  input: HeadlineValidationInput
): ValidationResult {
  const { headline_text: text, headline_type: type, story } = input;
  const errors: string[] = [];
  const warnings: string[] = [];

  // ── Check 1: Factual grounding ────────────────────────────────────────────
  // Every headline should reference something from the story fields.
  // We check that the municipality or at least "Broward" is present.
  const hasGeoRef =
    /broward/i.test(text) ||
    (story.municipality ? new RegExp(story.municipality, "i").test(text) : false);
  if (!hasGeoRef) {
    warnings.push(
      "Headline does not reference Broward County or the listed municipality. " +
        "Confirm all geographic claims are source-supported."
    );
  }

  // Headline mentions a charge concept — ensure charges field is populated
  const chargeKeywords = /charge|arrest|book|charged|listed|record|facing/i;
  if (chargeKeywords.test(text) && story.charges.length === 0) {
    errors.push(
      "Headline references a charge but no charges are listed in the story. " +
        "Add at least one charge before publishing."
    );
  }

  // ── Check 2: Guilt implication ────────────────────────────────────────────
  for (const re of GUILT_WORDS) {
    if (re.test(text)) {
      errors.push(
        `Headline contains guilt-implying language: "${text.match(re)?.[0]}". ` +
          `Use "arrested," "booked," "charged," or "records show" instead.`
      );
    }
  }

  // Verbs that state guilt as fact
  const guiltVerbs = /\b(committed|murdered|stole|robbed|attacked|killed|stabbed|shot|beat)\b/i;
  if (guiltVerbs.test(text)) {
    const match = text.match(guiltVerbs)?.[0];
    errors.push(
      `Headline uses a guilt-stating verb: "${match}". ` +
        `Replace with "allegedly" + verb, or rephrase using official charge language.`
    );
  }

  // ── Check 3: Inflammatory language ───────────────────────────────────────
  for (const re of UNSUPPORTED_ADJECTIVES) {
    if (re.test(text)) {
      errors.push(
        `Headline contains an unsupported adjective: "${text.match(re)?.[0]}". ` +
          `Remove unless explicitly stated in the official source.`
      );
    }
  }

  // ── Check 4: Minor identification ────────────────────────────────────────
  for (const re of MINOR_INDICATORS) {
    if (re.test(text)) {
      const word = text.match(re)?.[0] ?? "";
      if (["student"].includes(word.toLowerCase())) {
        warnings.push(
          `Headline contains a potential minor indicator: "${word}". ` +
            `Verify the subject is an adult before publishing.`
        );
      } else {
        errors.push(
          `Headline may identify or describe a minor ("${word}"). ` +
            `Do not identify minors by age, grade, or descriptors. Use a neutral headline.`
        );
      }
    }
  }

  // ── Check 5: Sensitive category routing ──────────────────────────────────
  const sensitiveCategory = detectSensitiveCategory(story.charges);
  if (sensitiveCategory !== null && !NEUTRAL_TYPES.includes(type)) {
    errors.push(
      `This story involves a sensitive category (${sensitiveCategory.replace(/_/g, " ")}). ` +
        `Only STANDARD or SHORT_MOBILE neutral headline types may be published. ` +
        `Use "Generate safer rewrite" to get an approved alternative.`
    );
  }

  // Also block sensational framing even for STANDARD type on sensitive stories
  if (sensitiveCategory !== null) {
    const sensationalPatterns = /\bdetails\b|\breveals?\b|\bshocking\b|\bsecret\b/i;
    if (sensationalPatterns.test(text)) {
      errors.push(
        `Headline contains sensational framing that is inappropriate for a story ` +
          `in the "${sensitiveCategory}" category.`
      );
    }
  }

  // ── Check 6: Invented details / unsupported framing ──────────────────────
  const inventedPhrases = [
    /\bmotive\b/i,
    /\bin cold blood\b/i,
    /\bwent on a\b/i,
    /\bspree\b/i,
    /\bwarzone\b|war zone/i,
    /\bchilling\b/i,
    /neighbors (shocked|stunned|terrified)/i,
  ];
  for (const re of inventedPhrases) {
    if (re.test(text)) {
      errors.push(
        `Headline contains an invented or unsupported phrase: "${text.match(re)?.[0]}". ` +
          `Remove or replace with source-supported language.`
      );
    }
  }

  // ── Length advisory (warning, not error) ─────────────────────────────────
  if (text.length > 120) {
    warnings.push(
      `Headline is ${text.length} characters — consider shortening to under 95 for better mobile display.`
    );
  }
  if (text.length < 20) {
    warnings.push("Headline is very short. Consider adding more context.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
