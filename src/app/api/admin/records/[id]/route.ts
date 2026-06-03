/** GET | PATCH /api/admin/records/[id] */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const record = await prisma.parsedRecord.findUnique({
    where: { id: params.id },
    include: {
      source:       true,
      source_fetch: true,
      dedupe_flags: {
        include: { duplicate_record: { select: { id: true, person_name: true, booking_date: true, record_status: true } } },
      },
    },
  });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(record);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const adminId = (session.user as { id?: string }).id ?? null;

  const record = await prisma.parsedRecord.update({
    where: { id: params.id },
    data: {
      record_status:  body.record_status ?? undefined,
      is_suppressed:  body.is_suppressed ?? undefined,
      admin_notes:    body.admin_notes   ?? undefined,
      reviewed_by:    adminId,
      reviewed_at:    new Date(),
    },
  });
  return NextResponse.json(record);
}
