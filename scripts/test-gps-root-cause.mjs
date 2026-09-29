import assert from "node:assert/strict";
import fs from "node:fs";

console.log("\n========================================================");
console.log("  AURELIA GPS — ROOT CAUSE VERIFICATION SUITE");
console.log("========================================================\n");

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (e) {
    console.error(`  FAIL  ${name}: ${e.message}`);
    failed++;
  }
}

// 1. Check all 5 files contain console.log("REAL GPS RESULT", ...)
const filesWithGpsLog = [
  "src/components/location/near-me-hub.tsx",
  "src/components/location-autocomplete.tsx",
  "src/components/location/current-location-chip.tsx",
  "src/components/near-me-controls.tsx",
  "src/components/location/location-permission-banner.tsx",
];

console.log("[1] Verifying REAL GPS RESULT logging across components...");
for (const file of filesWithGpsLog) {
  check(`${file} logs REAL GPS RESULT`, () => {
    const code = fs.readFileSync(file, "utf8");
    assert.ok(code.includes('console.log("REAL GPS RESULT"'), `Missing REAL GPS RESULT in ${file}`);
  });
}

// 2. Check that stale URL parameters are deleted on GPS selection
console.log("\n[2] Verifying Stale Query Parameter Cleansing on GPS Selection...");
for (const file of filesWithGpsLog) {
  if (file === "src/components/location-autocomplete.tsx") continue; // delegates to hero-search or parent
  check(`${file} removes q, place, city, state, search on GPS update`, () => {
    const code = fs.readFileSync(file, "utf8");
    assert.ok(code.includes('delete("q")'), `Missing delete("q") in ${file}`);
    assert.ok(code.includes('delete("place")'), `Missing delete("place") in ${file}`);
    assert.ok(code.includes('delete("city")'), `Missing delete("city") in ${file}`);
    assert.ok(code.includes('delete("state")'), `Missing delete("state") in ${file}`);
    assert.ok(code.includes('delete("search")'), `Missing delete("search") in ${file}`);
  });
}

// 3. Verify hero-search cleans query parameters
check("src/components/hero-search.tsx cleans query parameters on coordinate select", () => {
  const code = fs.readFileSync("src/components/hero-search.tsx", "utf8");
  assert.ok(code.includes('params.delete("city")'), "Missing delete('city') in hero-search.tsx");
  assert.ok(code.includes('params.delete("state")'), "Missing delete('state') in hero-search.tsx");
  assert.ok(code.includes('params.delete("search")'), "Missing delete('search') in hero-search.tsx");
});

// 4. Verify LiveResults in app/page.tsx ignores sp.city/state when coordinates are present
console.log("\n[3] Verifying app/page.tsx Coordinates Priority Over Stale City/State...");
check("app/page.tsx does not pass sp.city or sp.state when latitude is finite", () => {
  const code = fs.readFileSync("src/app/page.tsx", "utf8");
  assert.ok(
    code.includes("city: Number.isFinite(latitude) ? undefined : sp.city"),
    "city must be undefined when latitude is finite"
  );
  assert.ok(
    code.includes("state: Number.isFinite(latitude) ? undefined : sp.state"),
    "state must be undefined when latitude is finite"
  );
});

// 5. Verify /api/hotels route ignores city/state when coordinates are present
console.log("\n[4] Verifying /api/hotels Route Coordinates Priority...");
check("/api/hotels prioritizes coordinate search over city/state filters", () => {
  const code = fs.readFileSync("src/app/api/hotels/route.ts", "utf8");
  assert.ok(
    code.includes("city: hasCoords ? undefined :"),
    "city filter should not restrict coordinate-based search"
  );
  assert.ok(
    code.includes("state: hasCoords ? undefined :"),
    "state filter should not restrict coordinate-based search"
  );
});

// 6. Verify GPS DEBUG diagnostic box exists
console.log("\n[5] Verifying GPS DEBUG Diagnostic Box...");
check("near-me-hub.tsx contains GPS DEBUG diagnostic element", () => {
  const code = fs.readFileSync("src/components/location/near-me-hub.tsx", "utf8");
  assert.ok(code.includes("GPS DEBUG"), "Missing GPS DEBUG box in near-me-hub.tsx");
  assert.ok(code.includes("Latitude:"), "Missing Latitude in GPS DEBUG");
  assert.ok(code.includes("Longitude:"), "Missing Longitude in GPS DEBUG");
  assert.ok(code.includes("Accuracy:"), "Missing Accuracy in GPS DEBUG");
  assert.ok(code.includes("Timestamp:"), "Missing Timestamp in GPS DEBUG");
});

check("current-location-chip.tsx contains GPS DEBUG diagnostic box", () => {
  const code = fs.readFileSync("src/components/location/current-location-chip.tsx", "utf8");
  assert.ok(code.includes("GPS DEBUG"), "Missing GPS DEBUG box in current-location-chip.tsx");
});

// 7. Test live server with coordinate query vs old city query
console.log("\n[6] Testing Live Next.js Server API Responses...");
async function runApiTests() {
  // Test coordinate search with leftover Bhubaneswar city param
  const res = await fetch("http://localhost:3000/api/hotels?lat=19.0760&lng=72.8777&city=Bhubaneswar");
  const data = await res.json();
  
  check("API returns Mumbai hotels even if stale city=Bhubaneswar parameter was present", () => {
    assert.equal(data.success, true);
    assert.ok(data.hotels.length > 0);
    // The nearest hotel to Mumbai coords (19.0760, 72.8777) must be in Mumbai, not Bhubaneswar!
    assert.equal(data.hotels[0].city, "Mumbai");
    assert.ok(data.hotels[0].distanceKm < 10);
  });

  // Test reverse geocode endpoint with real coordinates
  const revRes = await fetch("http://localhost:3000/api/geo/reverse?lat=19.0760&lng=72.8777");
  const revData = await revRes.json();
  check("API reverse geocodes 19.0760, 72.8777 to Mumbai without hardcoding", () => {
    assert.ok(revData.place?.label.includes("Mumbai") || revData.place?.region?.includes("Maharashtra"));
  });

  console.log("\n========================================================");
  console.log(`  GPS ROOT CAUSE TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("========================================================\n");
  if (failed > 0) process.exit(1);
}

runApiTests().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
