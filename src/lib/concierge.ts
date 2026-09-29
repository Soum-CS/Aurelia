export interface FaqItem {
  q: string;
  a: string;
}

const ESCALATION_WORDS = [
  "human", "agent", "manager", "real person", "someone real",
  "complaint", "complain", "angry", "furious", "unacceptable",
  "terrible service", "speak to", "talk to someone",
];

const INTENTS: Array<{
  id: string;
  keywords: string[];
  reply: (ctx: ConciergeContext) => string;
}> = [
  {
    id: "wifi",
    keywords: ["wifi", "wi-fi", "password", "internet", "network"],
    reply: (c) =>
      c.faq.find((f) => f.q.toLowerCase().includes("wifi"))?.a ??
      "The guest network details are on the card by the desk — I can also have front desk send them to your app inbox.",
  },
  {
    id: "checkout",
    keywords: ["checkout", "check out", "check-out", "leave", "departure"],
    reply: () =>
      `Checkout is at 11:00. If you'd like to linger, late checkout can be added to your folio — just say “arrange late checkout” and I'll set it up.`,
  },
  {
    id: "breakfast",
    keywords: ["breakfast", "food", "eat", "dinner", "restaurant", "hungry", "menu", "dining"],
    reply: (c) =>
      c.faq.find((f) => /breakfast|dinner|dining/i.test(f.q))?.a ??
      "Dining hours are in your stay guide; you can also order room service any time from the In-Stay hub.",
  },
  {
    id: "pool",
    keywords: ["pool", "swim", "swimming"],
    reply: (c) =>
      c.faq.find((f) => /pool/i.test(f.q))?.a ??
      "Pool hours are posted poolside and in your stay guide.",
  },
  {
    id: "gym",
    keywords: ["gym", "fitness", "workout", "exercise"],
    reply: (c) =>
      c.faq.find((f) => /gym|fitness/i.test(f.q))?.a ??
      "The fitness area is accessible with your room key; hours are in your stay guide.",
  },
  {
    id: "spa",
    keywords: ["spa", "sauna", "massage", "hammam"],
    reply: (c) =>
      c.faq.find((f) => /spa|sauna/i.test(f.q))?.a ??
      "Spa treatments can be booked through the In-Stay hub — same-day slots are often open before 16:00.",
  },
  {
    id: "parking",
    keywords: ["parking", "park", "car", "garage", "valet"],
    reply: (c) =>
      c.faq.find((f) => /park/i.test(f.q))?.a ?? "Parking details are in your stay guide.",
  },
  {
    id: "pets",
    keywords: ["pet", "dog", "cat"],
    reply: (c) => c.faq.find((f) => /pet/i.test(f.q))?.a ?? "Pet policy details are in your stay guide.",
  },
  {
    id: "transfer",
    keywords: ["airport", "transfer", "taxi", "pickup", "pick up", "flight"],
    reply: () =>
      "I can arrange an airport transfer — add it from your trip dashboard, or tell me your flight number and arrival time and I'll pass it to the driver team.",
  },
  {
    id: "towels",
    keywords: ["towel", "toiletries", "amenities", "extra blanket", "pillow"],
    reply: () =>
      "Happy to help — I've noted that. Housekeeping typically delivers extras within 15 minutes. You can also track it under Requests in your In-Stay hub.",
  },
  {
    id: "late-checkout-action",
    keywords: ["arrange late checkout", "book late checkout"],
    reply: () =>
      "Done — I've flagged late checkout for housekeeping planning. The €/night fee will appear on your final folio only if granted.",
  },
  {
    id: "room-suit",
    keywords: ["what kind of room", "suit me", "recommend a room", "which room", "room recommendation", "room for me", "what room"],
    reply: (c) => {
      const prefs = c.preferences;
      const bed = prefs?.bedPreference ? `${prefs.bedPreference} bed` : "King bed";
      const roomPrefs = prefs?.roomPrefs?.length ? prefs.roomPrefs.join(", ") : "balcony and ocean view";
      const budget = prefs?.budgetPerNightInr ? `₹${prefs.budgetPerNightInr.toLocaleString("en-IN")}` : "₹8,000";
      return `Based on your Aurelia preference profile (${bed}, ${roomPrefs} · ${budget} budget), our Deluxe and Grand Suite twins match your preferences. High floor and quiet placement away from the lift are noted for your stay. You can explore each room twin in 3D under 'Try 3D'.`;
    },
  },
  {
    id: "room-temp",
    keywords: ["room temp", "room temperature", "preferred temp", "preferred temperature", "thermostat", "air condition", "climate control"],
    reply: (c) => {
      const temp = c.preferences?.temperatureC ?? 22;
      return `Your preferred room temperature is saved as ${temp}°C on your Aurelia profile. In-room climate controls can be adjusted manually on the wall thermostat, and housekeeping prepares the room to this preference prior to check-in.`;
    },
  },
  {
    id: "itinerary-plan",
    keywords: ["itinerary", "plan my day", "daily plan", "things to do today", "suggest an itinerary"],
    reply: (c) => {
      const interests = c.preferences?.interests?.length ? c.preferences.interests.join(", ") : "culture, nature, relaxation";
      const ci = c.preferences?.checkinTime ?? "13:00";
      const co = c.preferences?.checkoutTime ?? "11:00";
      return `I've personalized itinerary planning around your saved interests (${interests}), with check-in at ${ci} and checkout at ${co}. You can view or regenerate your interactive day-by-day itinerary under your Trip Dashboard.`;
    },
  },
];

export interface ConciergePreferences {
  foodPrefs?: string[];
  cuisines?: string[];
  roomPrefs?: string[];
  interests?: string[];
  allergies?: string[];
  bedPreference?: string | null;
  temperatureC?: number | null;
  budgetPerNightInr?: number | null;
  checkinTime?: string | null;
  checkoutTime?: string | null;
}

export interface ConciergeContext {
  hotelName: string;
  hotelSlug: string;
  guestName?: string;
  faq: FaqItem[];
  preferences?: ConciergePreferences | null;
}

export interface ConciergeReply {
  reply: string;
  escalate: boolean;
  matchedIntent: string;
  suggestions: string[];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function faqMatch(message: string, faq: FaqItem[]): FaqItem | null {
  const tokens = tokenize(message).filter((t) => t.length > 2);
  if (tokens.length === 0) return null;
  let best: { item: FaqItem; score: number } | null = null;
  for (const item of faq) {
    const qTokens = new Set(tokenize(item.q));
    let score = 0;
    for (const t of tokens) {
      if (qTokens.has(t)) score += 2;
      else if ([...qTokens].some((qt) => qt.startsWith(t.slice(0, 4)))) score += 1;
    }
    if (!best || score > best.score) best = { item, score };
  }
  return best && best.score >= 3 ? best.item : null;
}

export function conciergeAnswer(
  message: string,
  ctx: ConciergeContext
): ConciergeReply {
  const lower = message.toLowerCase();

  if (ESCALATION_WORDS.some((w) => lower.includes(w))) {
    return {
      reply: `I'm sorry this hasn't gone right${ctx.guestName ? `, ${ctx.guestName.split(" ")[0]}` : ""}. I'm connecting you with ${ctx.hotelName}'s duty manager now — they'll see this conversation and your booking, and will follow up shortly. Your ticket reference appears under Requests.`,
      escalate: true,
      matchedIntent: "escalation",
      suggestions: [],
    };
  }

  const faq = faqMatch(message, ctx.faq);
  if (faq) {
    return {
      reply: faq.a,
      escalate: false,
      matchedIntent: "faq",
      suggestions: SUGGESTED_TOPICS(ctx),
    };
  }

  const intent = INTENTS.find((i) =>
    i.keywords.some((k) => lower.includes(k))
  );
  if (intent) {
    return {
      reply: intent.reply(ctx),
      escalate: false,
      matchedIntent: intent.id,
      suggestions: SUGGESTED_TOPICS(ctx),
    };
  }

  return {
    reply: `I want to get this right, so I'll hand specific requests to our team — but here's what I know cold: WiFi, breakfast hours, pool & spa times, parking, pets, checkout, and airport transfers. Ask me one of those, or type “manager” and I'll bring in a human.`,
    escalate: false,
    matchedIntent: "fallback",
    suggestions: SUGGESTED_TOPICS(ctx),
  };
}

function SUGGESTED_TOPICS(ctx: ConciergeContext): string[] {
  const base = [
    "What's the WiFi password?",
    "When is breakfast?",
    "Can I get late checkout?",
  ];
  if (ctx.faq.some((f) => /pool/i.test(f.q))) base.push("Pool hours?");
  return base.slice(0, 4);
}
