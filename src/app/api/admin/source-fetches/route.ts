/** GET /api/admin/source-fetches — fetch history list */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sourceId = searchParams.get("sourceId") ?? undefined;
  const take = parseInt(searchParams.get("take") ?? "50");

  const fetches = await prisma.sourceFetch.findMany({
    where: sourceId ? { source_id: sourceId } : undefined,
    orderBy: { started_at: "desc" },
    take,
    include: {
      source: { select: { name: true, source_type: true } },
      _count: { select: { errors: true } },
    },
  });

  return NextResponse.json(fetches);
}
