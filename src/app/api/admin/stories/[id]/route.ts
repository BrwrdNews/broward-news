import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const existing = await prisma.story.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updatedData: Record<string, unknown> = {
    headline_standard: body.headline_standard ?? existing.headline_standard,
    headline_catchy: body.headline_catchy ?? existing.headline_catchy,
    headline_chosen: body.headline_chosen || null,
    editorial_tone: body.editorial_tone ?? existing.editorial_tone,
    geography_focus: body.geography_focus ?? existing.geography_focus,
    source_confidence_score:
      body.source_confidence_score != null
        ? parseFloat(body.source_confidence_score)
        : existing.source_confidence_score,
    body: body.body ?? existing.body,
    source_name: body.source_name ?? existing.source_name,
    source_url: body.source_url || null,
    incident_date: body.incident_date ? new Date(body.incident_date) : null,
    arrest_date: body.arrest_date ? new Date(body.arrest_date) : null,
    subject_name: body.subject_name || null,
    charges: body.charges ?? existing.charges,
    booking_number: body.booking_number || null,
    municipality: body.municipality || null,
    admin_notes: body.admin_notes || null,
  };

  if (body.status) {
    updatedData.status = body.status;
    if (body.status === "PUBLISHED" && !existing.published_at) {
      updatedData.published_at = new Date();
    }
    updatedData.reviewed_by = (session.user as { id?: string }).id ?? null;
    updatedData.reviewed_at = new Date();
  }

  const story = await prisma.story.update({
    where: { id: params.id },
    data: updatedData,
  });

  return NextResponse.json(story);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.story.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
