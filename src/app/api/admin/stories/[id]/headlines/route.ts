/**
 * GET  /api/admin/stories/[id]/headlines  — list all headline options for a story
 * POST /api/admin/stories/[id]/headlines  — generate a new batch
 *
 * POST body: { safeOnly?: boolean }
 * The editorial_tone_setting stored on the Story drives which types are generated.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateHeadlines, detectSensitiveCategory } from "@/lib/headline-generator";
import { notifyBatchReady } from "@/lib/notify";
import type { EditorialTone } from "@/lib/types";

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const headlines = await prisma.storyHeadline.findMany({
    where: { story_id: params.id },
    orderBy: [{ generation_batch: "desc" }, { headline_type: "asc" }],
  });

  return NextResponse.json(headlines);
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const story = await prisma.story.findUnique({ where: { id: params.id } });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const safeOnly: boolean = body.safeOnly === true;

  // Next batch number
  const lastBatch = await prisma.storyHeadline.aggregate({
    where: { story_id: params.id },
    _max: { generation_batch: true },
  });
  const nextBatch = (lastBatch._max.generation_batch ?? 0) + 1;

  // Detect and persist sensitive category
  const detectedCategory = detectSensitiveCategory(story.charges);
  if (detectedCategory && story.sensitive_category !== detectedCategory) {
    await prisma.story.update({
      where: { id: params.id },
      data: { sensitive_category: detectedCategory },
    });
  }

  const storyData = {
    municipality:      story.municipality,
    charges:           story.charges,
    subject_name:      story.subject_name,
    subject_descriptor: story.subject_descriptor,
    source_name:       story.source_name,
    arrest_date:       story.arrest_date,
    booking_number:    story.booking_number,
    geography_focus:   story.geography_focus,
    // bond and release_status not on Story model — enriched from ParsedRecord when available
  };

  const tone = (story.editorial_tone_setting ?? "SENSATIONAL_CAUTIOUS") as EditorialTone;
  const generated = generateHeadlines(storyData, nextBatch, safeOnly, tone);

  // Uniqueness pass: check if any headline_text already exists on a *different* story
  const existingTexts = await prisma.storyHeadline.findMany({
    where: {
      headline_text: { in: generated.map((h) => h.headline_text) },
      story_id:      { not: params.id },
    },
    select: { headline_text: true },
  });
  const duplicateTexts = new Set(existingTexts.map((e) => e.headline_text));

  const created = await prisma.storyHeadline.createMany({
    data: generated.map((h) => ({
      story_id:             params.id,
      headline_text:        h.headline_text,
      deck:                 h.deck,
      headline_type:        h.headline_type,
      factual_safety_score: h.factual_safety_score,
      catchiness_score:     h.catchiness_score,
      uniqueness_score:     duplicateTexts.has(h.headline_text)
                              ? Math.max(1, h.uniqueness_score - 4)  // penalise exact duplicate
                              : h.uniqueness_score,
      sensationalism_score: h.sensationalism_score,
      risk_level:           h.risk_level,
      reason_for_score:     h.reason_for_score,
      source_fields_used:   h.source_fields_used,
      generation_batch:     nextBatch,
    })),
  });

  const newHeadlines = await prisma.storyHeadline.findMany({
    where:   { story_id: params.id, generation_batch: nextBatch },
    orderBy: { headline_type: "asc" },
  });

  notifyBatchReady({
    storyId:       params.id,
    storySlug:     story.slug,
    storyHeadline: story.headline_standard,
    municipality:  story.municipality,
    batchNumber:   nextBatch,
    headlineCount: created.count,
  }).catch((err) => console.warn("[notify] non-fatal:", err));

  return NextResponse.json(
    { batch: nextBatch, count: created.count, headlines: newHeadlines },
    { status: 201 }
  );
}
