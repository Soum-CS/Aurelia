import { NextResponse } from "next/server";
import { amadeusHealth } from "@/lib/hotel-provider/amadeus";

export const dynamic = "force-dynamic";

/**
 * GET /api/hotels/health — provider health check (spec §18).
 * Reports configuration + authentication state. Never returns or logs the
 * API key/secret or OAuth token.
 */
export async function GET() {
  const health = await amadeusHealth();
  return NextResponse.json(health, { status: health.status === "ready" ? 200 : 503 });
}
