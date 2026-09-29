"use client";

import { stopAllGpsWatchers } from "@/lib/location/gps-watcher";

/**
 * Perform a clean, secure logout:
 * 1. Invalidate authentication session on server
 * 2. Clear authenticated client state
 * 3. Stop any active GPS watchers (clearWatch)
 * 4. Clear private user location state
 * 5. Redirect to public home page
 */
export async function performLogout(redirectTo = "/"): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch (error) {
    console.warn("Server logout notification failed:", error);
  }

  // Stop any active GPS watcher and dispatch event
  stopAllGpsWatchers();

  // Clear private location storage if present
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem("aurelia_loc_banner_dismissed");
    } catch {
      // Ignore storage errors
    }
    // Redirect cleanly to home page
    window.location.href = redirectTo;
  }
}
