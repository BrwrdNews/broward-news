/**
 * POST /api/admin/records/[id]/generate-story
 *
 * Generates a DRAFT story from an APPROVED_FOR_DRAFT ParsedRecord.
 * Returns { storyId }.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateDraftFromRecord } from "@/lib/ingestion/generateDraftFromRecord";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const storyId = await generateDraftFromRecord(params.id);
    return NextResponse.json({ storyId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
