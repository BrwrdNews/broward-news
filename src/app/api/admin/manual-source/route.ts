/**
 * POST /api/admin/manual-source
 *
 * Parses admin-pasted source text and saves a SourceFetch + ParsedRecords.
 * Body: { source_id, raw_text, source_url? }
 *
 * If source_id is omitted, uses the MANUAL_ADMIN_SUBMISSION source (created by seed).
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runSourceFetch } from "@/lib/ingestion/runSourceFetch";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.raw_text?.trim()) {
    return NextResponse.json({ error: "raw_text is required" }, { status: 400 });
  }

  // Find or default to the manual submission source
  let sourceId: string = body.source_id;
  if (!sourceId) {
    const manualSource = await prisma.source.findFirst({
      where: { source_type: "MANUAL_ADMIN_SUBMISSION" },
    });
    if (!manualSource) {
      return NextResponse.json(
        { error: "No MANUAL_ADMIN_SUBMISSION source configured. Run db:seed first." },
        { status: 404 }
      );
    }
    sourceId = manualSource.id;
  }

  try {
    const result = await runSourceFetch(sourceId, { rawInput: body.raw_text });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
