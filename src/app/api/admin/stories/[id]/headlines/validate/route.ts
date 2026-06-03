/**
 * POST /api/admin/stories/[id]/headlines/validate
 *
 * Body: { headline_text: string; headline_type: HeadlineType }
 *
 * Runs the full validation suite against the stored story data and returns
 * { valid, errors, warnings }.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateHeadline } from "@/lib/headline-validator";
import type { HeadlineType } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const story = await prisma.story.findUnique({ where: { id: params.id } });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  const body = await req.json();
  const { headline_text, headline_type } = body as {
    headline_text: string;
    headline_type: HeadlineType;
  };

  if (!headline_text || !headline_type) {
    return NextResponse.json(
      { error: "headline_text and headline_type are required" },
      { status: 400 }
    );
  }

  const result = validateHeadline({
    headline_text,
    headline_type,
    story: {
      charges: story.charges,
      municipality: story.municipality,
      subject_name: story.subject_name,
      source_name: story.source_name,
    },
  });

  return NextResponse.json(result);
}
