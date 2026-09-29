import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/stay-api";

export const dynamic = "force-dynamic";

const SERVICE_FLOW = ["OPEN", "ACCEPTED", "IN_PROGRESS", "RESOLVED"] as const;

/**
 * PATCH /api/admin/services/[id] — staff advances a service request through
 * Requested → Accepted → In Progress → Completed. One step at a time.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = String(body.status ?? "");
  const row = await db.serviceRequest.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  const curIdx = SERVICE_FLOW.indexOf(row.status as (typeof SERVICE_FLOW)[number]);
  const nextIdx = SERVICE_FLOW.indexOf(status as (typeof SERVICE_FLOW)[number]);
  if (nextIdx === -1) {
    return NextResponse.json({ error: `Unknown status "${status}".` }, { status: 400 });
  }
  if (curIdx === -1 || nextIdx !== curIdx + 1) {
    return NextResponse.json(
      { error: `Invalid transition ${row.status} → ${status}.` },
      { status: 409 },
    );
  }

  const updated = await db.serviceRequest.update({
    where: { id },
    data: { status },
  });
  return NextResponse.json({ success: true, request: updated });
}
