import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import slugify from "slugify";

function makeSlug(headline: string): string {
  return (
    slugify(headline, { lower: true, strict: true }).slice(0, 80) +
    "-" +
    Date.now().toString(36)
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (!body.headline_standard || !body.headline_catchy || !body.source_name) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const story = await prisma.story.create({
    data: {
      slug: makeSlug(body.headline_standard),
      headline_standard: body.headline_standard,
      headline_catchy: body.headline_catchy,
      headline_chosen: body.headline_chosen || null,
      editorial_tone: body.editorial_tone,
      geography_focus: body.geography_focus,
      source_confidence_score: parseFloat(body.source_confidence_score) || 0.9,
      body: body.body ?? "",
      status: body.status ?? "DRAFT",
      source_name: body.source_name,
      source_url: body.source_url || null,
      incident_date: body.incident_date ? new Date(body.incident_date) : null,
      arrest_date: body.arrest_date ? new Date(body.arrest_date) : null,
      subject_name: body.subject_name || null,
      charges: body.charges ?? [],
      booking_number: body.booking_number || null,
      municipality: body.municipality || null,
      admin_notes: body.admin_notes || null,
    },
  });

  return NextResponse.json(story, { status: 201 });
}
