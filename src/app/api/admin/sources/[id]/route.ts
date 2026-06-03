/** GET | PATCH | DELETE /api/admin/sources/[id] */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const source = await prisma.source.findUnique({
    where: { id: params.id },
    include: {
      fetches: { orderBy: { started_at: "desc" }, take: 10 },
      _count: { select: { records: true } },
    },
  });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(source);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const source = await prisma.source.update({
    where: { id: params.id },
    data: {
      name:                 body.name,
      base_url:             body.base_url,
      description:          body.description,
      is_enabled:           body.is_enabled,
      fetch_interval_hours: body.fetch_interval_hours,
      requires_manual:      body.requires_manual,
      notes:                body.notes,
    },
  });
  return NextResponse.json(source);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.source.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
