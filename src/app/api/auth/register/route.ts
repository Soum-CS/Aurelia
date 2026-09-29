import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword, createSessionCookie } from "@/lib/auth";
import { getUserToken, findUserByToken } from "@/lib/user";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser && existingUser.passwordHash) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in." },
        { status: 409 }
      );
    }

    const passwordHash = hashPassword(password);
    const resolvedName = displayName || email.split("@")[0];

    // Check if the current guest session can be upgraded
    const guestToken = await getUserToken();
    const guestUser = await findUserByToken(guestToken);

    let activeUser;
    let sessionToken: string;

    if (guestUser && !guestUser.email && !guestUser.passwordHash) {
      // Upgrade existing guest user so bookings/preferences are preserved
      sessionToken = guestUser.token;
      activeUser = await db.user.update({
        where: { id: guestUser.id },
        data: {
          email,
          passwordHash,
          displayName: resolvedName,
        },
      });
    } else if (existingUser) {
      sessionToken = existingUser.token;
      activeUser = await db.user.update({
        where: { id: existingUser.id },
        data: {
          passwordHash,
          displayName: resolvedName,
        },
      });
    } else {
      sessionToken = randomBytes(18).toString("base64url");
      activeUser = await db.user.create({
        data: {
          token: sessionToken,
          email,
          passwordHash,
          displayName: resolvedName,
        },
      });
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: activeUser.id,
        email: activeUser.email,
        displayName: activeUser.displayName,
      },
    });

    response.headers.set("Set-Cookie", createSessionCookie(sessionToken));
    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during account creation." },
      { status: 500 }
    );
  }
}
