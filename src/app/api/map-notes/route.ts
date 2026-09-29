import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/stay-api";
import { rateLimit } from "@/lib/rate-limit";
import { verifyMapNote } from "@/lib/map-notes";

export const dynamic = "force-dynamic";

/**
 * GET /api/map-notes — public, sanitized view of imported third-party notes.
 * Unverified notes are explicitly labeled; nothing is presented as fact.
 * Admin-only filters/actions live under the token-gated surface below.
 */
export async function GET(request: NextRequest) {
  void request;
  const notes = await db.mapNote.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    notes: notes.map((n) => ({
      noteId: n.noteId,
      source: n.source,
      authorName: n.authorName,
      description: n.description,
      latitude: n.latitude,
      longitude: n.longitude,
      verificationStatus: n.verificationStatus,
      reverseGeocodedAddress: n.reverseGeocodedAddress,
      country: n.country,
      state: n.state,
      district: n.district,
      city: n.city,
      resolutionReason: n.resolutionReason,
    })),
  });
}

/**
 * POST /api/map-notes — moderator actions (ADMIN_TOKEN gated).
 * Body: { action, noteId, correctedLatitude?, correctedLongitude?, reason? }
 * Actions: reverify · correct · resolve · keep_unresolved · reject
 */
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json(
      {
        error: process.env.ADMIN_TOKEN ? "Unauthorized" : "ADMIN_NOT_CONFIGURED",
        message: process.env.ADMIN_TOKEN
          ? "Moderator actions require the admin token."
          : "Set ADMIN_TOKEN in .env.local to review and resolve map notes.",
      },
      { status: process.env.ADMIN_TOKEN ? 401 : 503 },
    );
  }
  if (!rateLimit(request, "map-notes-admin", 60).ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const noteId = String(body.noteId ?? "");
  const action = String(body.action ?? "");
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : null;

  const note = await db.mapNote.findUnique({ where: { noteId } });
  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

  switch (action) {
    case "reverify": {
      // Independent re-check: fresh reverse geocode + comparison. The original
      // coordinates are never altered by verification.
      const result = await verifyMapNote(noteId);
      await db.mapNote.update({
        where: { noteId },
        data: {
          verificationStatus: result.status,
          resolutionReason: result.reason,
          verifiedAt: result.status === "NEEDS_VERIFICATION" ? null : new Date(),
          verifiedBy: result.status === "NEEDS_VERIFICATION" ? null : "system",
        },
      });
      return NextResponse.json({ success: true, ...result });
    }

    case "correct": {
      // Explicit human correction — audited with who + why.
      const lat = Number(body.correctedLatitude);
      const lng = Number(body.correctedLongitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return NextResponse.json({ error: "Valid correctedLatitude/correctedLongitude required." }, { status: 400 });
      }
      const updated = await db.mapNote.update({
        where: { noteId },
        data: {
          latitude: lat,
          longitude: lng,
          verificationStatus: "VERIFIED",
          verifiedAt: new Date(),
          verifiedBy: "admin",
          resolutionReason: `Coordinates corrected by moderator${reason ? `: ${reason}` : ""}. Original claim kept in description.`,
        },
      });
      return NextResponse.json({ success: true, note: updated });
    }

    case "resolve": {
      const updated = await db.mapNote.update({
        where: { noteId },
        data: {
          verificationStatus: "RESOLVED",
          verifiedAt: new Date(),
          verifiedBy: "admin",
          resolutionReason: reason ?? "Reviewed and resolved by moderator.",
        },
      });
      return NextResponse.json({ success: true, note: updated });
    }

    case "keep_unresolved": {
      const updated = await db.mapNote.update({
        where: { noteId },
        data: {
          verificationStatus: "NEEDS_VERIFICATION",
          verifiedAt: null,
          verifiedBy: null,
          resolutionReason: reason ?? "Kept unresolved pending better evidence.",
        },
      });
      return NextResponse.json({ success: true, note: updated });
    }

    case "reject": {
      const updated = await db.mapNote.update({
        where: { noteId },
        data: {
          verificationStatus: "REJECTED",
          verifiedAt: new Date(),
          verifiedBy: "admin",
          resolutionReason: reason ?? "Rejected as invalid by moderator.",
        },
      });
      return NextResponse.json({ success: true, note: updated });
    }

    default:
      return NextResponse.json(
        { error: `Unknown action "${action}". Valid: ${["reverify", "correct", "resolve", "keep_unresolved", "reject"].join(", ")}` },
        { status: 400 },
      );
  }
}
