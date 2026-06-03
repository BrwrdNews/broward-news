/**
 * GET  /api/admin/notifications          — badge count + recent unread items
 * POST /api/admin/notifications/dismiss  — dismiss a notification by id
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Undismissed notifications (most recent 20)
  const items = await prisma.headlineNotification.findMany({
    where: { dismissed_at: null },
    orderBy: { sent_at: "desc" },
    take: 20,
    include: {
      story: {
        select: {
          id: true,
          slug: true,
          headline_standard: true,
          municipality: true,
        },
      },
    },
  });

  // Count stories with at least one PENDING headline (for badge)
  const pendingGroups = await prisma.storyHeadline.groupBy({
    by: ["story_id"],
    where: { approval_status: "PENDING" },
  });

  return NextResponse.json({
    badge_count: pendingGroups.length,
    items,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  if (body.dismissAll) {
    await prisma.headlineNotification.updateMany({
      where: { dismissed_at: null },
      data: { dismissed_at: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    await prisma.headlineNotification.update({
      where: { id: body.id },
      data: { dismissed_at: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Provide id or dismissAll:true" }, { status: 400 });
}
