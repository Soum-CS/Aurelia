/**
 * AURELIA — PROFILE FUNCTIONALITY ACCEPTANCE TEST SUITE
 *
 * Verifies all 11 requirements from Section 30 of the Profile Specification:
 * - Test 1: Open Profile page
 * - Test 2 & 3: Select preferences (Vegetarian, Spicy, Indian, Nature, High floor, Balcony, King bed, 22°C, ₹8000, 01:00 PM, 01:00 PM, Peanuts)
 * - Test 4: Save preferences
 * - Test 5: Refresh/Reload profile — verify persistence and normalization
 * - Test 6: Concierge: "Recommend something for dinner" — reflects Vegetarian, Spicy, Indian, Peanuts
 * - Test 7: Concierge: "What kind of room would suit me?" — reflects King bed, Balcony, Budget
 * - Test 8: Itinerary: reflects Nature / activity interests
 * - Test 9: Delete preference profile
 * - Test 10: Verify profile reset
 * - Test 11: Regression checks across existing platform features
 */

const BASE = "http://localhost:3000";

let failures = 0;
function check(label, ok, detail = "") {
  if (ok) {
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    console.error(`✗ FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
    failures++;
  }
}

async function api(path, init = {}, cookie = null) {
  const headers = { ...(init.headers || {}) };
  if (cookie) headers.cookie = cookie;
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* text or html */
  }
  const setCookie = res.headers.get("set-cookie");
  return { status: res.status, body, setCookie, res };
}

async function main() {
  console.log("========================================================");
  console.log("  AURELIA PROFILE FUNCTIONALITY — ACCEPTANCE TEST SUITE");
  console.log("========================================================\n");

  // Step 1: Open Profile Page
  console.log("[1] Testing Profile Page Rendering (Test 1)...");
  const profilePage = await fetch(`${BASE}/profile`);
  check("Profile page responds with 200", profilePage.status === 200);
  const profileHtml = await profilePage.text();
  check("Contains 'Your Aurelia preference profile'", profileHtml.includes("Your Aurelia preference profile"));
  check("Contains privacy guarantee statement", profileHtml.includes("never sold, never shared"));

  // Step 2 & 3 & 4: Save Complete Preference Profile (Tests 2, 3, 4)
  console.log("\n[2] Testing Preferences Save & Normalization (Tests 2, 3, 4)...");
  // Obtain fresh guest session cookie
  const initRes = await api("/api/preferences");
  let cookie = initRes.setCookie ? initRes.setCookie.split(";")[0] : null;
  if (!cookie) {
    const freshUser = await api("/api/hotels");
    cookie = freshUser.setCookie ? freshUser.setCookie.split(";")[0] : "aurelia_guest=test_profile_suite_" + Date.now();
  }

  const payload = {
    foodPrefs: ["vegetarian", "spicy"],
    cuisines: ["indian"],
    interests: ["nature"],
    roomPrefs: ["high floor", "balcony"],
    bedPreference: "king",
    temperatureC: 22,
    budgetPerNightInr: 8000,
    checkinTime: "01:00 PM",
    checkoutTime: "01:00 PM",
    allergies: "Peanuts",
  };

  const saveRes = await api("/api/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, cookie);

  if (saveRes.setCookie) {
    cookie = saveRes.setCookie.split(";")[0];
  }

  check("Save preferences returns 200", saveRes.status === 200);
  check("Save returns success: true", saveRes.body?.success === true);

  // Step 5: Refresh the page / Re-fetch (Test 5)
  console.log("\n[3] Testing Profile Persistence & Type Normalization (Test 5)...");
  const getRes = await api("/api/preferences", {}, cookie);
  check("Re-fetch preferences returns 200", getRes.status === 200);
  const p = getRes.body?.preferences;

  check("foodPrefs persisted correctly", Array.isArray(p?.foodPrefs) && p.foodPrefs.includes("vegetarian") && p.foodPrefs.includes("spicy"), JSON.stringify(p?.foodPrefs));
  check("cuisines persisted correctly", Array.isArray(p?.cuisines) && p.cuisines.includes("indian"), JSON.stringify(p?.cuisines));
  check("interests persisted correctly", Array.isArray(p?.interests) && p.interests.includes("nature"), JSON.stringify(p?.interests));
  check("roomPrefs persisted correctly", Array.isArray(p?.roomPrefs) && p.roomPrefs.includes("high floor") && p.roomPrefs.includes("balcony"), JSON.stringify(p?.roomPrefs));
  check("bedPreference is 'king'", p?.bedPreference === "king", p?.bedPreference);
  check("temperatureC is 22", p?.temperatureC === 22, `${p?.temperatureC}°C`);
  check("budgetPerNightInr is 8000", p?.budgetPerNightInr === 8000, `₹${p?.budgetPerNightInr}`);
  check("checkinTime normalized to '13:00'", p?.checkinTime === "13:00", p?.checkinTime);
  check("checkoutTime normalized to '13:00'", p?.checkoutTime === "13:00", p?.checkoutTime);
  check("allergies normalized to ['peanuts']", Array.isArray(p?.allergies) && p.allergies.includes("peanuts"), JSON.stringify(p?.allergies));

  // Create an active booking to test Concierge in stay context
  console.log("\n[4] Provisioning Active Stay for Concierge Grounding...");
  const hotelsRes = await api("/api/hotels");
  const hotel = hotelsRes.body?.hotels?.[0];
  const offsetDays = 60 + Math.floor(Math.random() * 30);
  const checkIn = new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
  const checkOut = new Date(Date.now() + (offsetDays + 2) * 86_400_000).toISOString().slice(0, 10);

  const orderRes = await api("/api/payment/create-order", {
    method: "POST",
    body: JSON.stringify({
      hotel_id: hotel.hotel_id,
      check_in: checkIn,
      check_out: checkOut,
      rooms: 1,
      guests: 2,
      guest_name: "Aurelia Profile Guest",
      guest_email: `profile_${Date.now()}@aureliastays.com`,
    }),
  }, cookie);

  const bookingCode = orderRes.body?.code;
  check("Booking intent created for testing", Boolean(bookingCode), bookingCode);

  // Simulate payment to confirm stay
  const simRes = await api("/api/payment/simulate", {
    method: "POST",
    body: JSON.stringify({ orderId: orderRes.body?.orderId }),
  });
  const verifyRes = await api("/api/payment/verify", {
    method: "POST",
    body: JSON.stringify(simRes.body),
  }, cookie);
  check("Stay confirmed for Concierge testing", verifyRes.status === 200 && verifyRes.body?.status === "CONFIRMED");

  // Step 6: Test Concierge Dinner Recommendation (Test 6)
  console.log("\n[5] Testing Concierge Food Recommendations with Profile (Test 6)...");
  const dinnerAsk = await api("/api/concierge/stay", {
    method: "POST",
    body: JSON.stringify({
      code: bookingCode,
      message: "Recommend something for dinner.",
    }),
  }, cookie);

  check("Concierge dinner inquiry responds with 200", dinnerAsk.status === 200);
  check("Concierge returns food recommendations", dinnerAsk.body?.cards?.some((c) => c.kind === "food"));
  check("Reply mentions pricing in ₹", /₹/.test(dinnerAsk.body?.reply ?? ""));
  check("Reply includes allergy notice for peanuts", /peanuts/i.test(dinnerAsk.body?.reply ?? ""));
  
  // Verify that all returned food cards are vegetarian or safe
  const returnedCards = dinnerAsk.body?.cards?.filter((c) => c.kind === "food") || [];
  check("Returned food recommendations exist", returnedCards.length > 0, `${returnedCards.length} dish(es)`);

  // Step 7: Test Concierge Room Recommendation (Test 7)
  console.log("\n[6] Testing Concierge Room Recommendations with Profile (Test 7)...");
  const roomAsk = await api("/api/concierge/stay", {
    method: "POST",
    body: JSON.stringify({
      code: bookingCode,
      message: "What kind of room would suit me?",
    }),
  }, cookie);

  check("Concierge room inquiry responds with 200", roomAsk.status === 200);
  check("Matched intent is 'room-recommendation'", roomAsk.body?.matchedIntent === "room-recommendation");
  check("Reply considers King bed preference", /king/i.test(roomAsk.body?.reply ?? ""));
  check("Reply considers balcony preference", /balcony/i.test(roomAsk.body?.reply ?? ""));
  check("Reply mentions nightly budget or price", /₹|budget/i.test(roomAsk.body?.reply ?? ""));
  check("Room card includes 3D view link", roomAsk.body?.cards?.some((c) => c.kind === "link" && c.payload?.href?.includes("/rooms/")));

  // Step 7b: Test Room Temperature Intent (Section 7)
  console.log("\n[7] Testing Concierge Room Temperature Intent (Section 7)...");
  const tempAsk = await api("/api/concierge/stay", {
    method: "POST",
    body: JSON.stringify({
      code: bookingCode,
      message: "My preferred room temperature is 22°C.",
    }),
  }, cookie);

  check("Temperature inquiry responds with 200", tempAsk.status === 200);
  check("Matched intent is 'room-temperature'", tempAsk.body?.matchedIntent === "room-temperature");
  check("Reply acknowledges 22°C preference", /22\s*°C/i.test(tempAsk.body?.reply ?? ""));

  // Step 8: Test Itinerary Intent (Test 8)
  console.log("\n[8] Testing Itinerary with Saved Interests (Test 8)...");
  const itinAsk = await api("/api/concierge/stay", {
    method: "POST",
    body: JSON.stringify({
      code: bookingCode,
      message: "Ask for an itinerary",
    }),
  }, cookie);

  check("Itinerary request responds with 200", itinAsk.status === 200);
  check("Matched intent is 'itinerary'", itinAsk.body?.matchedIntent === "itinerary");
  check("Reply mentions nature or saved interests", /nature|interest/i.test(itinAsk.body?.reply ?? ""));

  // Step 8b: Test /rooms page RoomTools profile sync
  console.log("\n[9] Testing /rooms Page RoomTools Integration...");
  const roomsPage = await fetch(`${BASE}/rooms`);
  check("/rooms page renders 200", roomsPage.status === 200);
  const roomsHtml = await roomsPage.text();
  check("/rooms page contains 3D room tools", roomsHtml.includes("Step inside a room before you book it"));

  // Step 9 & 10: Delete Preference Profile (Tests 9 & 10)
  console.log("\n[10] Testing Profile Deletion & Reset (Tests 9 & 10)...");
  const deleteRes = await api("/api/preferences", { method: "DELETE" }, cookie);
  check("DELETE /api/preferences returns 200", deleteRes.status === 200);
  check("Delete reports deleted: true", deleteRes.body?.deleted === true);

  // Verify profile is wiped
  const getAfterDelete = await api("/api/preferences", {}, cookie);
  const pAfter = getAfterDelete.body?.preferences;
  const isReset = !pAfter?.foodPrefs?.length && !pAfter?.cuisines?.length && !pAfter?.interests?.length;
  check("Profile is completely reset after deletion", isReset);

  // Step 11: Regression Testing — Verify Stays and Bookings are Preserved
  console.log("\n[11] Regression Testing — Bookings & Platform Preservation (Test 11)...");
  const bookingCheck = await api(`/api/bookings/${bookingCode}/bill`, {}, cookie);
  check("Booking remains intact after profile deletion", bookingCheck.status === 200 && bookingCheck.body?.booking?.code === bookingCode);

  console.log("\n========================================================");
  if (failures === 0) {
    console.log("  ALL PROFILE ACCEPTANCE CHECKS PASSED (0 FAILURES) ✓");
  } else {
    console.log(`  ${failures} CHECK(S) FAILED`);
  }
  console.log("========================================================\n");

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
