#!/usr/bin/env node
/**
 * Comprehensive Acceptance Test Suite for AURELIA CONCIERGE — PREMIUM STAY-AWARE UPGRADE
 *
 * Tests:
 * 1. Stay Metadata & Time-Aware Context (get_stay_info, greeting, room, hotel)
 * 2. Real Kitchen Menu & Budget/Dietary Intelligence (zero hallucination, strict price <= budget)
 * 3. Two-Step Food Ordering Confirmation (prompts first, never claims placed until DB confirmed)
 * 4. Real Service Request Creation & Tracking (SR-XXXX, status: REQUESTED)
 * 5. Live Folio & Wallet Intelligence (unified bill, exact ₹ breakdown)
 * 6. Stay Timeline & Active Requests (chronological events, live tracking)
 * 7. Preservation of Weather, Airport Transfer, Digital Key & Loyalty intents
 * 8. Frontend Pages (/concierge empty state, /concierge active state, /trips/[code]/in-stay)
 */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let passes = 0;
let failures = 0;

function check(name, ok, detail = "") {
  if (ok) {
    passes++;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures++;
    console.error(`✗ FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log("\n========================================================");
  console.log("  AURELIA CONCIERGE — PREMIUM STAY-AWARE TEST SUITE");
  console.log("========================================================\n");

  // Step 0: Ensure a confirmed test stay exists
  let booking = await prisma.booking.findFirst({
    where: { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
    include: { roomType: { include: { hotel: true } } },
    orderBy: { createdAt: "desc" },
  });

  if (!booking) {
    const hotel = await prisma.hotel.findFirst();
    const rt = await prisma.roomType.findFirst({ where: { hotelId: hotel?.id } });
    booking = await prisma.booking.create({
      data: {
        code: `AUR-CONCIERGE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        hotelId: hotel?.id,
        roomTypeId: rt?.id,
        guestName: "Lady Genevieve Vance",
        guestEmail: "genevieve@aurelia.luxury",
        checkIn: new Date(),
        checkOut: new Date(Date.now() + 86400000 * 3),
        nights: 3,
        guests: 2,
        subtotal: 55000,
        taxesFees: 6600,
        total: 61600,
        status: "CHECKED_IN",
        paymentStatus: "PAID",
        roomNumber: "604",
        roomName: "Royal Heritage Penthouse",
      },
      include: { roomType: { include: { hotel: true } } },
    });
  }

  const code = booking.code;
  console.log(`Testing with active booking: ${code} (${booking.roomType?.hotel.name ?? booking.hotelName})\n`);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Stay Metadata & Time-Aware Context
  // ──────────────────────────────────────────────────────────────────────────
  console.log("[1] Testing Stay Metadata & Time-Aware Context...");
  try {
    const res = await fetch(`${BASE}/api/concierge/stay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, action: "get_stay_info" }),
    });
    check("Stay info responds with 200", res.status === 200, `status ${res.status}`);
    const data = await res.json();
    const expectedFirst = (data.stay?.guestName ?? "").split(" ")[0];
    check("Returns guest name & first name", Boolean(data.stay?.guestName && data.stay?.guestFirstName === expectedFirst), data.stay?.guestFirstName);
    check("Returns room number and hotel", Boolean(data.stay?.roomNumber && data.stay?.hotelName), `Room ${data.stay?.roomNumber} at ${data.stay?.hotelName}`);
    check("Returns valid timeOfDay", ["morning", "afternoon", "evening", "night"].includes(data.stay?.timeOfDay), data.stay?.timeOfDay);
  } catch (err) {
    check("Stay info threw error", false, err.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Kitchen Menu Search & Budget Intelligence
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n[2] Testing Real Kitchen Menu & Budget Intelligence...");
  try {
    const res = await fetch(`${BASE}/api/concierge/stay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, message: "I'm hungry, show me something spicy under ₹700" }),
    });
    check("Menu search responds with 200", res.status === 200, `status ${res.status}`);
    const data = await res.json();
    check("Returns food cards from hotel kitchen", Array.isArray(data.cards) && data.cards.some((c) => c.kind === "food"), `${data.cards?.length} cards`);
    
    const foodCards = data.cards?.filter((c) => c.kind === "food") ?? [];
    const allUnder700 = foodCards.every((c) => c.payload?.priceInr <= 700);
    check("Every recommended item respects ₹700 budget limit", allUnder700 && foodCards.length > 0, `All prices <= ₹700`);
    check("Reply mentions items and pricing in ₹", /₹/.test(data.reply));
  } catch (err) {
    check("Menu search threw error", false, err.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Two-Step Food Order Confirmation (Zero false claims)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n[3] Testing Two-Step Food Order Confirmation Flow...");
  try {
    // Step 3a: Conversational intent must prompt confirmation, NOT claim order is placed
    const intentRes = await fetch(`${BASE}/api/concierge/stay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, message: "I want to order biryani to my room" }),
    });
    check("Order intent responds with 200", intentRes.status === 200, `status ${intentRes.status}`);
    const intentData = await intentRes.json();
    check(
      "Intent prompts confirmation and does NOT falsely claim order is placed",
      !intentData.reply.toLowerCase().includes("placed successfully") &&
      (intentData.matchedIntent === "order_confirmation_prompt" || intentData.cards?.some((c) => c.kind === "confirm_food")),
      intentData.reply.slice(0, 75) + "..."
    );

    // Step 3b: Explicit backend confirmation creates the order and returns real code
    const menuRes = await fetch(`${BASE}/api/concierge/stay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, action: "get_menu" }),
    });
    const menuData = await menuRes.json();
    const testItem = menuData.items?.[0];
    check("Hotel has dishes on the kitchen menu", Boolean(testItem?.id), testItem?.name);

    if (testItem) {
      const confirmRes = await fetch(`${BASE}/api/concierge/stay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          action: "confirm_food_order",
          payload: {
            items: [{ menuItemId: testItem.id, quantity: 1 }],
            instructions: "Extra mint chutney please",
          },
        }),
      });
      check("Confirm order responds with 200", confirmRes.status === 200, `status ${confirmRes.status}`);
      const confirmData = await confirmRes.json();
      check("Backend confirms order and provides AUR- code", Boolean(confirmData.order?.code && confirmData.order.code.startsWith("AUR-")), confirmData.order?.code);
      check("Order reply confirms placement", confirmData.reply.includes("placed successfully"));

      // Verify row in database
      const dbOrder = await prisma.foodOrder.findFirst({ where: { code: confirmData.order.code } });
      check("Order actually persisted in database with initial status", Boolean(dbOrder && dbOrder.status === "CONFIRMED" || dbOrder?.status === "PLACED"), dbOrder?.status);
    }
  } catch (err) {
    check("Food ordering flow threw error", false, err.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Real Service Request Creation & Tracking
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n[4] Testing Service Request Creation & Tracking...");
  try {
    const srvRes = await fetch(`${BASE}/api/concierge/stay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        action: "confirm_service",
        payload: {
          kind: "HOUSEKEEPING",
          title: "Extra fluffy bath towels",
          detail: "Please bring 2 additional bath towels to room",
        },
      }),
    });
    check("Service request responds with 200", srvRes.status === 200, `status ${srvRes.status}`);
    const srvData = await srvRes.json();
    check("Service request returns reference code", Boolean(srvData.request?.code), srvData.request?.code);
    check("Initial service request status is REQUESTED", srvData.request?.status === "REQUESTED", srvData.request?.status);
    check("Reply mentions dispatch to guest room", srvData.reply.toLowerCase().includes("room") || srvData.reply.toLowerCase().includes("housekeeping"));
  } catch (err) {
    check("Service request threw error", false, err.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Live Folio & Wallet Intelligence
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n[5] Testing Live Folio & Spending Intelligence...");
  try {
    const folioRes = await fetch(`${BASE}/api/concierge/stay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, message: "How much have I spent so far during my stay?" }),
    });
    check("Folio inquiry responds with 200", folioRes.status === 200, `status ${folioRes.status}`);
    const folioData = await folioRes.json();
    check("Folio reply quotes verified total in ₹", /₹/.test(folioData.reply), folioData.reply.slice(0, 80) + "...");
    check("Folio provides link card to wallet", Array.isArray(folioData.cards) && folioData.cards.some((c) => c.payload?.href?.includes("wallet")));
  } catch (err) {
    check("Folio inquiry threw error", false, err.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Stay Timeline & Activity Log
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n[6] Testing Stay Timeline & Activity Log...");
  try {
    const tlRes = await fetch(`${BASE}/api/concierge/stay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, action: "get_timeline" }),
    });
    check("Timeline responds with 200", tlRes.status === 200, `status ${tlRes.status}`);
    const tlData = await tlRes.json();
    check("Timeline returns chronological events", Array.isArray(tlData.timeline) && tlData.timeline.length > 0, `${tlData.timeline?.length} events`);
    check("Timeline returns active requests list", Array.isArray(tlData.activeRequests), `${tlData.activeRequests?.length} active requests`);
  } catch (err) {
    check("Timeline threw error", false, err.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Preservation of Existing Concierge Intents
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n[7] Testing Preservation of Additive Intents...");
  try {
    // Weather
    const wRes = await fetch(`${BASE}/api/concierge/stay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, message: "What is the weather outside?" }),
    });
    const wData = await wRes.json();
    check("Weather intent preserved with °C", wData.matchedIntent === "weather" && wData.reply.includes("°C"));

    // Airport transfer
    const tRes = await fetch(`${BASE}/api/concierge/stay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, message: "Can I get an airport chauffeur?" }),
    });
    const tData = await tRes.json();
    check("Airport transfer intent preserved with booking card", tData.matchedIntent === "airport-transfer" && tData.cards?.length > 0);

    // Digital Key
    const kRes = await fetch(`${BASE}/api/concierge/stay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, message: "How do I use my digital room key?" }),
    });
    const kData = await kRes.json();
    check("Digital Key intent preserved with unlock card", kData.matchedIntent === "digital-key" && kData.cards?.length > 0);

    // Loyalty
    const lRes = await fetch(`${BASE}/api/concierge/stay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, message: "What are my loyalty rewards?" }),
    });
    const lData = await lRes.json();
    check("Loyalty intent preserved with rewards card", lData.matchedIntent === "loyalty" && lData.cards?.length > 0);
  } catch (err) {
    check("Additive intents threw error", false, err.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Page Rendering & UI Contracts
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n[8] Testing Concierge Pages Rendering...");
  try {
    // Empty state on /concierge
    const emptyRes = await fetch(`${BASE}/concierge`);
    check("/concierge renders 200", emptyRes.status === 200, `status ${emptyRes.status}`);
    const emptyHtml = await emptyRes.text();
    check("/concierge contains 'Find a Hotel' CTA", emptyHtml.includes("Find a Hotel") || emptyHtml.includes("find a hotel"));
    check("/concierge contains 'Aurelia Concierge'", emptyHtml.includes("Aurelia Concierge"));

    // Active stay state on /concierge?code=...
    const activeRes = await fetch(`${BASE}/concierge?code=${code}`);
    check("/concierge?code=... renders 200", activeRes.status === 200, `status ${activeRes.status}`);
    const activeHtml = await activeRes.text();
    check("/concierge?code=... reflects stay metadata", activeHtml.includes(code));

    // In-stay hub with upgraded concierge
    const inStayRes = await fetch(`${BASE}/trips/${code}/in-stay`);
    check("/trips/[code]/in-stay renders 200", inStayRes.status === 200, `status ${inStayRes.status}`);
  } catch (err) {
    check("Page rendering threw error", false, err.message);
  }

  await prisma.$disconnect();

  console.log("\n========================================================");
  console.log(`  CONCIERGE TEST RESULTS: ${passes} PASSED, ${failures} FAILED`);
  console.log("========================================================\n");

  if (failures > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
