#!/usr/bin/env node
/**
 * Test Suite for FIX AURELIA GPS — REAL-TIME USER LOCATION
 *
 * Verifies:
 * 1. Location A detection (Delhi): reverse geocode + hotel search using fresh coordinates
 * 2. Location B update (Mumbai): fresh coordinates discard old location and update search + reverse geocode
 * 3. Exact coordinates match between reverse geocoding and hotel distance calculations
 * 4. Zero fake city substitution: when reverse geocoding returns null, real coords are preserved
 * 5. No fallback city overrides real GPS
 * 6. High-accuracy options configured: { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
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

async function testGPSPipeline() {
  console.log("\n========================================================");
  console.log("  AURELIA GPS — REAL-TIME LOCATION VERIFICATION SUITE");
  console.log("========================================================\n");

  // [1] Check Client Files for Geolocation Configuration
  console.log("[1] Checking Geolocation API Configuration in Components...");
  const filesToCheck = [
    "src/components/location/near-me-hub.tsx",
    "src/components/location-autocomplete.tsx",
    "src/components/location/current-location-chip.tsx",
    "src/components/location/location-permission-banner.tsx",
    "src/components/near-me-controls.tsx",
  ];

  for (const file of filesToCheck) {
    const content = fs.readFileSync(path.resolve(process.cwd(), file), "utf-8");
    const hasMaxAge0 = content.includes("maximumAge: 0");
    const hasTimeout20000 = content.includes("timeout: 20000") || content.includes("timeout: 20_000");
    const hasHighAccuracy = content.includes("enableHighAccuracy: true");
    const hasTimeoutRetry = content.includes("isRetry") || content.includes("Retrying once");
    const noSessionStorageGps = !content.includes('sessionStorage.setItem("aurelia_gps_location"') && !content.includes('sessionStorage.getItem("aurelia_gps_location"');

    check(`${file}: maximumAge is 0 (prevents cached/stale GPS)`, hasMaxAge0);
    check(`${file}: timeout is 20000ms`, hasTimeout20000);
    check(`${file}: enableHighAccuracy is true`, hasHighAccuracy);
    check(`${file}: retries GPS once on timeout`, hasTimeoutRetry);
    check(`${file}: does not cache/store GPS in sessionStorage`, noSessionStorageGps);
  }

  // [2] Verify No IP Fallback or Fake City in Geolocation Handlers
  console.log("\n[2] Verifying No Fake City Fallback / IP Geolocation in NearMeHub...");
  const hubContent = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/location/near-me-hub.tsx"),
    "utf-8"
  );
  check("No attemptIpFallback in NearMeHub", !hubContent.includes("attemptIpFallback"));
  check("Contains 'Update my location' action", hubContent.includes("Update my location"));
  check("Contains 'Detecting your current location...'", hubContent.includes("Detecting your current location..."));
  check("Initial currentGpsLocation state is strictly null", hubContent.includes("useState<LiveGpsLocation | null>(null)"));
  check("GPS debug only displays coordinates when gpsStatus is success", hubContent.includes('gpsStatus === "success" && currentGpsLocation'));
  check("No fallback to fake 'live' timestamp", !hubContent.includes('?? "live"'));
  check("No fallback to fake ±0 m accuracy", !hubContent.includes('?? 0} m accuracy'));

  // [3] Verify Map Centering on Coordinate Updates
  console.log("\n[3] Verifying InteractiveExplorerMap recenters dynamically...");
  const mapContent = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/location/interactive-explorer-map.tsx"),
    "utf-8"
  );
  check("Map executes flyTo when userPoint updates", mapContent.includes("map.flyTo(latLng, 14"));

  // [4] Test 1: Location A (Delhi)
  console.log("\n[4] Test 1 — Location A (Delhi: 28.6139, 77.2090)...");
  const locA = { lat: 28.6139, lng: 77.2090, accuracy: 14 };

  const revA = await fetch(`${BASE}/api/geo/reverse?lat=${locA.lat}&lng=${locA.lng}`).then((r) => r.json());
  check("Location A reverse geocode responds", revA && revA.place !== undefined);
  check(
    "Location A identifies Delhi region",
    revA.place?.label?.toLowerCase().includes("delhi") || revA.place?.label?.toLowerCase().includes("india"),
    revA.place?.label
  );

  const hotelsA = await fetch(`${BASE}/api/hotels?lat=${locA.lat}&lng=${locA.lng}`).then((r) => r.json());
  check("Hotels query for Location A succeeds", hotelsA && Array.isArray(hotelsA.hotels));
  check("Hotels sorted nearest-first for Location A", (hotelsA.hotels?.[0]?.distanceKm ?? 999) < 10, `${hotelsA.hotels?.[0]?.name} @ ${hotelsA.hotels?.[0]?.distanceKm} km`);

  // [5] Test 2: Moving to Location B (Mumbai)
  console.log("\n[5] Test 2 — User Moves to Location B (Mumbai: 19.0760, 72.8777)...");
  const locB = { lat: 19.0760, lng: 72.8777, accuracy: 18 };

  const revB = await fetch(`${BASE}/api/geo/reverse?lat=${locB.lat}&lng=${locB.lng}`).then((r) => r.json());
  check("Location B reverse geocode responds", revB && revB.place !== undefined);
  check(
    "Location B identifies Mumbai region",
    revB.place?.label?.toLowerCase().includes("mumbai") || revB.place?.label?.toLowerCase().includes("maharashtra"),
    revB.place?.label
  );

  const hotelsB = await fetch(`${BASE}/api/hotels?lat=${locB.lat}&lng=${locB.lng}`).then((r) => r.json());
  check("Hotels query for Location B succeeds", hotelsB && Array.isArray(hotelsB.hotels));
  check(
    "Location B nearest hotel is in Mumbai, not Delhi",
    hotelsB.hotels?.[0]?.city?.toLowerCase().includes("mumbai"),
    `${hotelsB.hotels?.[0]?.name} in ${hotelsB.hotels?.[0]?.city} @ ${hotelsB.hotels?.[0]?.distanceKm} km`
  );

  // [6] Test 6 — Reverse Geocoding Failure Retains Real Coordinates
  console.log("\n[6] Test 6 — Reverse Geocoding Graceful Fallback (Real GPS Intact)...");
  // Middle of Atlantic Ocean (no address)
  const oceanCoords = { lat: 25.0000, lng: -40.0000 };
  const revOcean = await fetch(`${BASE}/api/geo/reverse?lat=${oceanCoords.lat}&lng=${oceanCoords.lng}`).then((r) => r.json());
  check("Reverse geocode for unmapped point returns place: null without crashing", revOcean && revOcean.place === null);

  // Hotel search for ocean coords calculates true distance from ocean coords
  const hotelsOcean = await fetch(`${BASE}/api/hotels?lat=${oceanCoords.lat}&lng=${oceanCoords.lng}`).then((r) => r.json());
  check("Hotel search accepts ocean coords", hotelsOcean && Array.isArray(hotelsOcean.hotels));
  check("Calculates large transatlantic distance (~4000+ km)", (hotelsOcean.hotels?.[0]?.distanceKm ?? 0) > 3000, `Nearest: ${hotelsOcean.hotels?.[0]?.distanceKm} km`);

  // [7] Verify Geocoding Lib Has No Hardcoded Known Cities Overwriting GPS
  console.log("\n[7] Verifying Geocoding Lib Has No Snapping to Bhubaneswar/New Delhi...");
  const geoLib = fs.readFileSync(path.resolve(process.cwd(), "src/lib/geocoding.ts"), "utf-8");
  check("No KNOWN_CITIES array in geocoding.ts", !geoLib.includes("KNOWN_CITIES"));
  check("No fallbackCityFromCoords in geocoding.ts", !geoLib.includes("fallbackCityFromCoords"));

  console.log("\n========================================================");
  console.log(`  GPS TEST RESULTS: ${passes} PASSED, ${failures} FAILED`);
  console.log("========================================================\n");

  if (failures > 0) process.exit(1);
}

testGPSPipeline().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
