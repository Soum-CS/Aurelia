import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { GUEST_COOKIE, getUserToken, findUserByToken } from "./user";

/**
 * Cryptographically secure password hashing using Node.js scrypt.
 * Uses a unique 16-byte cryptographically random salt per user.
 * Never stores plaintext passwords.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Constant-time verification of password against stored scrypt hash.
 * Resistant to timing attacks.
 */
export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) return false;
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  if (!salt || !key) return false;

  try {
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedKey.length) return false;
    return timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
}

/**
 * Returns the currently authenticated user session if one exists.
 * Does not trust any frontend-supplied user ID; validated strictly on the backend.
 */
export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const token = await getUserToken();
  if (!token) return null;
  const user = await findUserByToken(token);
  if (!user || !user.email || !user.passwordHash) return null;

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName || user.email.split("@")[0],
    createdAt: user.createdAt,
  };
}

/**
 * Create HttpOnly session cookie string for secure browser storage.
 */
export function createSessionCookie(token: string): string {
  return `${GUEST_COOKIE}=${token}; Path=/; Max-Age=${60 * 60 * 24 * 30}; HttpOnly; SameSite=Lax`;
}

/**
 * Clear session cookie on logout.
 */
export function createClearSessionCookie(): string {
  return `${GUEST_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}
