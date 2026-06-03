/**
 * PATCH /api/admin/stories/[id]/headlines/[hid]
 *
 * Supported actions (body.action):
 *   "approve"  — mark headline APPROVED (eligible for selection)
 *   "reject"   — mark headline REJECTED (body.reason optional)
 *   "select"   — mark as selected (must be APPROVED + LOW risk, or confirm for MEDIUM)
 *   "confirm"  — admin confirmation for MEDIUM-risk headline
 *   "block"    — hard-block headline
 *   "unblock"  — remove block
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateHeadline } from "@/lib/headline-validator";
import type { HeadlineType } from "@/lib/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; hid: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const headline = await prisma.storyHeadline.findUnique({
    where: { id: params.hid },
    include: { story: true },
  });

  if (!headline || headline.story_id !== params.id) {
    return NextResponse.json({ error: "Headline not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const action: string = body.action ?? "approve";
  const adminId = (session.user as { id?: string }).id ?? null;

  // ── Approve ───────────────────────────────────────────────────────────────
  if (action === "approve") {
    const updated = await prisma.storyHeadline.update({
      where: { id: params.hid },
      data: {
        approval_status: "APPROVED",
        approved_by: adminId,
        approved_at: new Date(),
        rejection_reason: null,
      },
    });
    return NextResponse.json(updated);
  }

  // ── Reject ────────────────────────────────────────────────────────────────
  if (action === "reject") {
    const updated = await prisma.storyHeadline.update({
      where: { id: params.hid },
      data: {
        approval_status: "REJECTED",
        rejection_reason: body.reason ?? null,
        is_selected: false,
      },
    });
    return NextResponse.json(updated);
  }

  // ── Block / unblock ───────────────────────────────────────────────────────
  if (action === "block") {
    const updated = await prisma.storyHeadline.update({
      where: { id: params.hid },
      data: { is_blocked: true, is_selected: false },
    });
    return NextResponse.json(updated);
  }

  if (action === "unblock") {
    const updated = await prisma.storyHeadline.update({
      where: { id: params.hid },
      data: { is_blocked: false },
    });
    return NextResponse.json(updated);
  }

  // ── Select / confirm ──────────────────────────────────────────────────────
  if (action === "select" || action === "confirm") {
    // Must be APPROVED before it can be selected
    if (headline.approval_status !== "APPROVED") {
      return NextResponse.json(
        {
          error:
            `Headline must be APPROVED before it can be selected. ` +
            `Current status: ${headline.approval_status}. ` +
            `Use the "Approve" button first.`,
        },
        { status: 422 }
      );
    }

    // HIGH risk → always blocked
    if (headline.risk_level === "HIGH") {
      return NextResponse.json(
        {
          error:
            "This headline has a HIGH risk rating and cannot be selected. " +
            "Use 'Generate safer rewrite' to get a LOW-risk alternative.",
        },
        { status: 422 }
      );
    }

    // MEDIUM risk → require explicit confirm action
    if (headline.risk_level === "MEDIUM" && action !== "confirm") {
      return NextResponse.json(
        {
          requiresConfirmation: true,
          message:
            "This headline has a MEDIUM risk rating. Click 'Confirm selection' to proceed, " +
            "or use 'Generate safer rewrite' for a LOW-risk alternative.",
          risk_level: "MEDIUM",
          reason: headline.reason_for_score,
        },
        { status: 202 }
      );
    }

    // Run validation
    const validation = validateHeadline({
      headline_text: headline.headline_text,
      headline_type: headline.headline_type as HeadlineType,
      story: {
        charges: headline.story.charges,
        municipality: headline.story.municipality,
        subject_name: headline.story.subject_name,
        source_name: headline.story.source_name,
      },
    });

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Headline failed validation.",
          validation_errors: validation.errors,
          validation_warnings: validation.warnings,
        },
        { status: 422 }
      );
    }

    // Deselect all others → select this one
    await prisma.storyHeadline.updateMany({
      where: { story_id: params.id, is_selected: true },
      data: { is_selected: false },
    });

    const updated = await prisma.storyHeadline.update({
      where: { id: params.hid },
      data: { is_selected: true },
    });

    // Persist chosen headline text back to the story
    await prisma.story.update({
      where: { id: params.id },
      data: { headline_chosen: updated.headline_text },
    });

    return NextResponse.json({ ...updated, validation_warnings: validation.warnings });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
