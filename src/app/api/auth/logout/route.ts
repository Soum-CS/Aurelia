import { NextResponse } from "next/server";
import { createClearSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Logged out successfully.",
  });

  response.headers.set("Set-Cookie", createClearSessionCookie());
  return response;
}
