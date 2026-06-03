/** GET /api/admin/records — list parsed records */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status        = searchParams.get("status") ?? undefined;
  const showSuppressed = searchParams.get("suppressed") === "true";
  const sourceId      = searchParams.get("sourceId") ?? undefined;
  const take          = parseInt(searchParams.get("take") ?? "50");

  const records = await prisma.parsedRecord.findMany({
    where: {
      ...(status   ? { record_status: status as never } : {}),
      ...(sourceId ? { source_id: sourceId }            : {}),
      ...(!showSuppressed ? { is_suppressed: false }    : {}),
    },
    orderBy: { created_at: "desc" },
    take,
    include: {
      source:       { select: { name: true } },
      source_fetch: { select: { fetch_method: true, started_at: true } },
      _count: { select: { dedupe_flags: true } },
    },
  });

  return NextResponse.json(records);
}
