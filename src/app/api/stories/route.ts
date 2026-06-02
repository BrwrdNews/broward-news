import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const stories = await prisma.story.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { published_at: "desc" },
    take: 50,
    select: {
      slug: true,
      headline_chosen: true,
      headline_standard: true,
      municipality: true,
      published_at: true,
      subject_name: true,
      charges: true,
    },
  });
  return NextResponse.json(stories);
}
