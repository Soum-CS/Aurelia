import { NextRequest } from "next/server";

/* Lightweight in-memory rate limiter (per instance, per key). */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  request: NextRequest,
  scope: string,
  limit = 20,
  windowMs = 60_000,
): { ok: boolean; retryAfter?: number } {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local";
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true };
}
