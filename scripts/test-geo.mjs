#!/usr/bin/env node
/**
 * Acceptance tests for the worldwide location system.
 *
 * Run: npm run build && npm start && npm run test:geo
 * (Requires outbound internet for the upstream geocoder; when it's offline
 * the API degrades to seeded-city fallback and this suite reports SKIP.)
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let failures = 0;
let skipped = false;
function check(name, ok, detail = "") {
  console.log(`${ok ? "  PASS" : "✗ FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function main() {
  // 1) Worldwide search beyond seed cities: Bhubaneswar, Odisha, India
  const s1 = await getJSON(`${BASE}/api/geo/search?q=Bhubaneswar`);
  if (s1.source === "fallback") {
    skipped = true;
    console.log("  SKIP  upstream geocoder unreachable (fallback mode) — structural checks only");
  } else {
    check("search finds Bhubaneswar", s1.places.length > 0);
    const bbsr = s1.places[0];
    check("label reads like 'Bhubaneswar, Odisha, India'",
      /Bhubanes(h)?war|Bhubaneshwar/i.test(bbsr.label) && /India/.test(bbsr.label),
      bbsr.label);
    check("coordinates are real (≈20.3N 85.8E)",
      Math.abs(bbsr.latitude - 20.3) < 0.6 && Math.abs(bbsr.longitude - 85.82) < 0.6,
      `${bbsr.latitude}, ${bbsr.longitude}`);

    // 2) Another continent: Tokyo
    const s2 = await getJSON(`${BASE}/api/geo/search?q=Tokyo`);
    const tokyo = s2.places[0];
    check("search finds Tokyo, Japan",
      Boolean(tokyo) && /Japan|Tōkyō|Tokyo/i.test(tokyo.label),
      tokyo?.label ?? "none");
    check("Tokyo coordinates plausible",
      Math.abs(tokyo.latitude - 35.68) < 0.7 && Math.abs(tokyo.longitude - 139.69) < 0.7,
      `${tokyo.latitude}, ${tokyo.longitude}`);
  }

  // 3) Reverse geocoding: central Bengaluru → "Bengaluru, Karnataka, India"-style label
  const r1 = await getJSON(`${BASE}/api/geo/reverse?lat=12.9716&lng=77.5946`);
  check("reverse geocode returns a place", Boolean(r1.place), r1.notice ?? "");
  if (r1.place) {
    check("Bengaluru reverse label mentions city/country",
      /Bengaluru|Bangalore|Karnataka|India/i.test(r1.place.label),
      r1.place.label);
    check("reverse coordinates echo input",
      Math.abs(r1.place.latitude - 12.9716) < 0.35 && Math.abs(r1.place.longitude - 77.5946) < 0.35);
  }

  // 4) Bad input is rejected politely
  const bad = await fetch(`${BASE}/api/geo/reverse?lat=abc&lng=77`);
  check("invalid reverse input → 400", bad.status === 400);

  // 5) Short queries short-circuit
  const tiny = await getJSON(`${BASE}/api/geo/search?q=a`);
  check("1-char query returns no results", Array.isArray(tiny.places) && tiny.places.length === 0);

  console.log(
    skipped
      ? "\nGeo acceptance: completed in fallback mode"
      : `\nGeo acceptance test: ${failures} FAILURE(S)`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
