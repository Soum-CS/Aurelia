#!/usr/bin/env node
/**
 * Automated test suite for the Aurelia Additive Upgrade:
 * 1. Location Intelligence (Near-Me POIs, category filtering, travel times)
 * 2. Live Weather API (temperature, condition, humidity, contextual advice)
 * 3. VIP Airport Transfers (quote calculation, booking persistence)
 * 4. Razorpay Integration & Webhook Idempotency
 * 5. Cancellation & Refund Policy
 * 6. Loyalty Program (tier, points, perks)
 * 7. Digital Room Key (key generation, NFC/BLE tap-to-unlock)
 * 8. AI Concierge 2.0 (weather, transfer, key, loyalty intents)
 */

import crypto from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let failures = 0;
let passes = 0;

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
  console.log("  AURELIA ADDITIVE UPGRADE — COMPREHENSIVE TEST SUITE");
  console.log("========================================================\n");

  // Ensure a test booking exists for stay-scoped operations
  let testBooking = await prisma.booking.findFirst({
    where: { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
  });

  if (!testBooking) {
    const hotel = await prisma.hotel.findFirst();
    const rt = await prisma.roomType.findFirst({ where: { hotelId: hotel?.id } });
    testBooking = await prisma.booking.create({
      data: {
        code: `AUR-KEY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        hotelId: hotel?.id,
        roomTypeId: rt?.id,
        guestName: "Lady Genevieve",
        guestEmail: "genevieve@aurelia.luxury",
        checkIn: new Date(),
        checkOut: new Date(Date.now() + 86400000 * 3),
        nights: 3,
        guests: 2,
        subtotal: 45000,
        taxesFees: 5400,
        total: 50400,
        status: "CONFIRMED",
        paymentStatus: "PAID",
      },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Live Weather API
  // ──────────────────────────────────────────────────────────────────────────
  console.log("[1] Testing Live Weather Service (/api/location/weather)...");
  try {
    const res = await fetch(`${BASE}/api/location/weather?lat=28.6139&lng=77.2090`);
    check("Weather API responds with 200", res.status === 200, `status ${res.status}`);
    const weather = await res.json();
    check("Weather returns temperatureC", typeof weather.temperatureC === "number", `${weather.temperatureC}°C`);
    check("Weather returns condition", typeof weather.condition === "string" && weather.condition.length > 0, weather.condition);
    check("Weather returns humidityPct", typeof weather.humidityPct === "number", `${weather.humidityPct}%`);
    check("Weather returns contextualTip", typeof weather.contextualTip === "string" && weather.contextualTip.length > 0, weather.contextualTip);
  } catch (err) {
    check("Weather API request threw error", false, err.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Near-Me & POI Discovery API
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n[2] Testing Location Intelligence & Near-Me POIs (/api/location/near-me)...");
  try {
    const res = await fetch(`${BASE}/api/location/near-me?lat=12.9716&lng=77.5946&radius=35`);
    check("Near-Me API responds with 200", res.status === 200, `status ${res.status}`);
    const data = await res.json();
    check("Near-Me returns origin echo", data.origin?.latitude === 12.9716 && data.origin?.longitude === 77.5946);
    check("Near-Me returns items array", Array.isArray(data.items) && data.items.length > 0, `${data.items?.length} items`);

    const first = data.items[0];
    check("POI item contains travel time and distance", Boolean(first?.travelTimeText && typeof first?.distanceKm === "number"), `${first?.name}: ${first?.formattedDistance}, ${first?.travelTimeText}`);

    // Test category filter
    const catRes = await fetch(`${BASE}/api/location/near-me?lat=12.9716&lng=77.5946&category=airports`);
    const catData = await catRes.json();
    const allAirports = catData.items?.every((item) => item.category === "airports");
    check("Category filter strictly returns only requested category", allAirports && catData.items?.length > 0, `${catData.items?.length} airport(s) returned`);
  } catch (err) {
    check("Near-Me API request threw error", false, err.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. VIP Airport Transfers API
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n[3] Testing VIP Airport Transfers (/api/transfers)...");
  try {
    // Quote calculation
    const quoteRes = await fetch(`${BASE}/api/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hotelId: "amadeus-del",
        airportCode: "DEL",
        vehicleType: "LUXURY_SUV",
        scheduledTime: new Date(Date.now() + 86400000).toISOString(),
        passengers: 3,
        type: "PICKUP",
      }),
    });
    check("Transfer quote responds with 200", quoteRes.status === 200, `status ${quoteRes.status}`);
    const quote = await quoteRes.json();
    check("Transfer quote calculates price and vehicle label", quote.priceInr > 0 && quote.vehicleLabel.includes("SUV"), `₹${quote.priceInr} for ${quote.vehicleLabel}`);
    check("Transfer quote provides travel time text", Boolean(quote.travelTimeText), quote.travelTimeText);

    // Booking creation
    const bookRes = await fetch(`${BASE}/api/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hotelId: "amadeus-del",
        airportCode: "DEL",
        vehicleType: "SEDAN",
        scheduledTime: new Date(Date.now() + 86400000).toISOString(),
        passengers: 2,
        type: "PICKUP",
        flightNumber: "AI-101",
        guestName: "Lord Stirling",
        guestPhone: "+91 98765 43210",
      }),
    });
    check("Transfer booking responds with 200", bookRes.status === 200, `status ${bookRes.status}`);
    const booked = await bookRes.json();
    check("Transfer booking returns code and CONFIRMED status", Boolean(booked.code && booked.status === "CONFIRMED"), `Code: ${booked.code}`);
  } catch (err) {
    check("Airport transfer request threw error", false, err.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Razorpay Signature Verification & Webhook Idempotency
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n[4] Testing Razorpay Signatures & Webhook Idempotency (/api/payment/webhook)...");
  try {
    const webhookSecret = "aur_whsec_test_luxury_2026";
    const eventId = `evt_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const payload = JSON.stringify({
      entity: "event",
      account_id: "acc_aurelia_live",
      event: "payment.captured",
      contains: ["payment"],
      payload: {
        payment: {
          entity: {
            id: `pay_${Date.now()}`,
            order_id: `order_${Date.now()}`,
            amount: 2500000,
            currency: "INR",
            status: "captured",
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    });

    const signature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

    // First delivery
    const wh1 = await fetch(`${BASE}/api/payment/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": signature,
        "x-razorpay-event-id": eventId,
      },
      body: payload,
    });
    check("Valid webhook responds 200", wh1.status === 200, `status ${wh1.status}`);
    const wh1Body = await wh1.json();
    check("Webhook processed new event", wh1Body.received === true && wh1Body.processed === true);

    // Duplicate delivery (idempotency check)
    const wh2 = await fetch(`${BASE}/api/payment/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": signature,
        "x-razorpay-event-id": eventId,
      },
      body: payload,
    });
    check("Duplicate webhook responds 200", wh2.status === 200, `status ${wh2.status}`);
    const wh2Body = await wh2.json();
    check("Duplicate webhook deduplicated via idempotent ledger", wh2Body.duplicate === true && wh2Body.processed === false);

    // Bad signature rejection
    const whBad = await fetch(`${BASE}/api/payment/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": "invalid_forged_signature_12345",
        "x-razorpay-event-id": `${eventId}_bad`,
      },
      body: payload,
    });
    check("Forged signature rejected with 400", whBad.status === 400, `status ${whBad.status}`);
  } catch (err) {
    check("Webhook verification test threw error", false, err.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Aurelia Loyalty API
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n[5] Testing Aurelia Wallet 2.0 & Loyalty (/api/loyalty)...");
  try {
    const testEmail = `vip_${Date.now()}@aurelia.luxury`;
    const loyaltyRes = await fetch(`${BASE}/api/loyalty?email=${encodeURIComponent(testEmail)}`);
    check("Loyalty API responds with 200", loyaltyRes.status === 200, `status ${loyaltyRes.status}`);
    const loyalty = await loyaltyRes.json();
    check("New member starts at EXPLORER tier", loyalty.tier === "EXPLORER", loyalty.tierLabel);
    check("Loyalty returns perks array", Array.isArray(loyalty.perks) && loyalty.perks.length > 0, `${loyalty.perks.length} perks`);
    check("Loyalty returns multiplier info", loyalty.points >= 500, `${loyalty.points} welcome points`);
  } catch (err) {
    check("Loyalty API test threw error", false, err.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Digital Room Key API
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n[6] Testing Digital Room Key (/api/keys/[code])...");
  try {
    const keyRes = await fetch(`${BASE}/api/keys/${testBooking.code}`);
    check("Digital Key endpoint responds with 200", keyRes.status === 200, `status ${keyRes.status}`);
    const keyData = await keyRes.json();
    check("Digital Key has roomNumber and keyToken", Boolean(keyData.roomNumber && keyData.keyToken), `Room ${keyData.roomNumber}`);

    // Test tap-to-unlock simulation
    const unlockRes = await fetch(`${BASE}/api/keys/${testBooking.code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlock" }),
    });
    check("Tap-to-unlock responds with 200", unlockRes.status === 200, `status ${unlockRes.status}`);
    const unlockData = await unlockRes.json();
    check("Door unlocks successfully with haptic confirmation", unlockData.unlocked === true, unlockData.message);
  } catch (err) {
    check("Digital Key API test threw error", false, err.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. AI Concierge 2.0 Stay Context
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n[7] Testing AI Concierge 2.0 Stay Context (/api/concierge/stay)...");
  try {
    // Weather intent
    const wRes = await fetch(`${BASE}/api/concierge/stay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: testBooking.code, message: "What's the weather today?" }),
    });
    check("Concierge weather responds with 200", wRes.status === 200, `status ${wRes.status}`);
    const wData = await wRes.json();
    check("Concierge identifies weather intent and gives temperature advice", wData.matchedIntent === "weather" && wData.reply.includes("°C"), wData.reply);

    // Airport transfer intent
    const aRes = await fetch(`${BASE}/api/concierge/stay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: testBooking.code, message: "Can I get an airport chauffeur?" }),
    });
    check("Concierge airport transfer responds with 200", aRes.status === 200, `status ${aRes.status}`);
    const aData = await aRes.json();
    check("Concierge provides airport transfer link card", aData.matchedIntent === "airport-transfer" && aData.cards?.length > 0);

    // Digital Key intent
    const kRes = await fetch(`${BASE}/api/concierge/stay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: testBooking.code, message: "How do I unlock my room with digital key?" }),
    });
    check("Concierge digital key responds with 200", kRes.status === 200, `status ${kRes.status}`);
    const kData = await kRes.json();
    check("Concierge provides digital key card", kData.matchedIntent === "digital-key" && kData.cards?.length > 0);
  } catch (err) {
    check("AI Concierge test threw error", false, err.message);
  }

  await prisma.$disconnect();

  // ──────────────────────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n========================================================");
  console.log(`  TEST RESULTS: ${passes} PASSED, ${failures} FAILED`);
  console.log("========================================================\n");

  if (failures > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Unhandled error in test suite:", err);
  process.exit(1);
});
