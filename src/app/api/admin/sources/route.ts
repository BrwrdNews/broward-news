/** GET /api/admin/sources — list | POST — create */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sources = await prisma.source.findMany({
    orderBy: { created_at: "asc" },
    include: {
      _count: { select: { fetches: true, records: true } },
    },
  });
  return NextResponse.json(sources);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.name || !body.source_type || !body.base_url) {
    return NextResponse.json({ error: "name, source_type, and base_url are required" }, { status: 400 });
  }

  const source = await prisma.source.create({
    data: {
      name:                 body.name,
      source_type:          body.source_type,
      base_url:             body.base_url,
      description:          body.description ?? null,
      is_enabled:           body.is_enabled ?? true,
      fetch_interval_hours: body.fetch_interval_hours ?? 24,
      requires_manual:      body.requires_manual ?? false,
      notes:                body.notes ?? null,
    },
  });
  return NextResponse.json(source, { status: 201 });
}
