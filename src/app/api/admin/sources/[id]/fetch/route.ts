/**
 * POST /api/admin/sources/[id]/fetch
 *
 * Triggers a fetch run for the given source.
 * Body: { useMock?: boolean; rawInput?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runSourceFetch } from "@/lib/ingestion/runSourceFetch";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  try {
    const result = await runSourceFetch(params.id, {
      useMock:  body.useMock  === true,
      rawInput: body.rawInput ?? undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
