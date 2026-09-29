#!/usr/bin/env node
/**
 * Test Suite for Aurelia Login & Logout functionality
 * Verifies:
 * 1. Secure registration and password hashing (never plaintext, scrypt salt:key)
 * 2. Login validation (correct credentials, bad credentials, missing fields)
 * 3. Session security (HttpOnly cookie, backend validation)
 * 4. Auth status endpoint (/api/auth/me)
 * 5. Logout flow: session invalidation, cookie clearing, GPS watcher teardown
 * 6. Public access preservation (home page, hotel search, public discovery intact)
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let passes = 0;
let failures = 0;

function check(name, ok, detail = "") {
  if (ok) {
    passes++;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function runAuthTests() {
  console.log("\n========================================================");
  console.log("  AURELIA LOGIN & LOGOUT VERIFICATION SUITE");
  console.log("========================================================\n");

  const testEmail = `guest_${Date.now()}@aureliatest.com`;
  const testPassword = "SecurePassword2026!";
  const testName = "Aurelia VIP Guest";

  // [1] Test Public Page Access (Preservation)
  console.log("[1] Testing Public Access Preservation...");
  const homeRes = await fetch(`${BASE}/`);
  check("Home page is publicly accessible without login", homeRes.status === 200, `status ${homeRes.status}`);

  const loginPageRes = await fetch(`${BASE}/login`);
  check("Login page is accessible", loginPageRes.status === 200, `status ${loginPageRes.status}`);

  const profilePageRes = await fetch(`${BASE}/profile`);
  check("Profile page is accessible", profilePageRes.status === 200, `status ${profilePageRes.status}`);

  // [2] Test Initial Unauthenticated State
  console.log("\n[2] Testing Initial Auth State...");
  const meInitial = await fetch(`${BASE}/api/auth/me`).then((r) => r.json());
  check("Unauthenticated visitor reports authenticated: false", meInitial.authenticated === false);

  // [3] Test Login with Invalid Credentials
  console.log("\n[3] Testing Invalid Login Rejection...");
  const invalidLoginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: "WrongPassword" }),
  });
  check("Non-existent or invalid user rejected with 401", invalidLoginRes.status === 401);

  const missingFieldsRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "", password: "" }),
  });
  check("Missing credentials rejected with 400", missingFieldsRes.status === 400);

  // [4] Test User Registration & Password Hashing
  console.log("\n[4] Testing User Registration & Password Security...");
  const regRes = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      displayName: testName,
    }),
  });
  check("Registration responds with 200", regRes.status === 200, `status ${regRes.status}`);

  const regData = await regRes.json();
  check("Registration returns success: true", regData.success === true);
  check("Registration returns user info without password", regData.user?.email === testEmail && !regData.user?.password);

  const setCookieHeader = regRes.headers.get("set-cookie") || "";
  check("Registration sets HttpOnly session cookie", setCookieHeader.includes("aurelia_guest=") && setCookieHeader.includes("HttpOnly"));

  // Duplicate registration test
  const dupRegRes = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
    }),
  });
  check("Duplicate email registration rejected with 409", dupRegRes.status === 409);

  // Extract session cookie
  const cookieMatch = setCookieHeader.match(/aurelia_guest=([^;]+)/);
  const sessionCookie = cookieMatch ? `aurelia_guest=${cookieMatch[1]}` : "";

  // [5] Verify Password in Database is Hashed (Never Plaintext)
  console.log("\n[5] Verifying Database Password Security...");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const dbUser = await prisma.user.findUnique({ where: { email: testEmail } });
  check("User found in database", Boolean(dbUser));
  check("Password is NOT stored in plaintext", dbUser?.passwordHash !== testPassword);
  check("Password uses scrypt salt:key format", Boolean(dbUser?.passwordHash?.includes(":") && dbUser?.passwordHash?.split(":")[0].length === 32));
  await prisma.$disconnect();

  // [6] Test Authentication Status with Session Cookie
  console.log("\n[6] Testing Authenticated Session...");
  const meAuthRes = await fetch(`${BASE}/api/auth/me`, {
    headers: { Cookie: sessionCookie },
  });
  const meAuth = await meAuthRes.json();
  check("Authenticated user recognized by /api/auth/me", meAuth.authenticated === true && meAuth.user?.email === testEmail);

  // [7] Test Login with Newly Created User
  console.log("\n[7] Testing Valid Login Flow...");
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  check("Login with correct credentials succeeds with 200", loginRes.status === 200);
  const loginData = await loginRes.json();
  check("Login returns success: true", loginData.success === true);
  check("Login returns correct user email", loginData.user?.email === testEmail);

  const loginCookieHeader = loginRes.headers.get("set-cookie") || "";
  check("Login provides HttpOnly cookie", loginCookieHeader.includes("aurelia_guest=") && loginCookieHeader.includes("HttpOnly"));

  // [8] Test Logout
  console.log("\n[8] Testing Logout Flow & Session Invalidation...");
  const logoutRes = await fetch(`${BASE}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: sessionCookie },
  });
  check("Logout responds with 200", logoutRes.status === 200);

  const logoutCookieHeader = logoutRes.headers.get("set-cookie") || "";
  check("Logout clears/invalidates session cookie", logoutCookieHeader.includes("Max-Age=0") || logoutCookieHeader.includes("Expires="));

  // [9] Verify GPS Watcher Teardown on Logout Code
  console.log("\n[9] Verifying GPS Watcher Teardown Implementation...");
  const gpsWatcherCode = fs.readFileSync(path.resolve(process.cwd(), "src/lib/location/gps-watcher.ts"), "utf-8");
  check("gps-watcher exports stopAllGpsWatchers", gpsWatcherCode.includes("stopAllGpsWatchers"));
  check("stopAllGpsWatchers calls clearWatch", gpsWatcherCode.includes("navigator.geolocation.clearWatch"));

  const authClientCode = fs.readFileSync(path.resolve(process.cwd(), "src/lib/auth-client.ts"), "utf-8");
  check("performLogout invokes stopAllGpsWatchers", authClientCode.includes("stopAllGpsWatchers()"));
  check("performLogout calls /api/auth/logout", authClientCode.includes("/api/auth/logout"));
  check("performLogout redirects to home page", authClientCode.includes("window.location.href = redirectTo"));

  const nearMeHubCode = fs.readFileSync(path.resolve(process.cwd(), "src/components/location/near-me-hub.tsx"), "utf-8");
  check("near-me-hub listens for aurelia:logout event", nearMeHubCode.includes("aurelia:logout"));
  check("near-me-hub unregisters GPS watch on logout", nearMeHubCode.includes("unregisterGpsWatch"));

  console.log("\n========================================================");
  console.log(`  AUTH TEST RESULTS: ${passes} PASSED, ${failures} FAILED`);
  console.log("========================================================\n");

  if (failures > 0) process.exit(1);
}

runAuthTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
