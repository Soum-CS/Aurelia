"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ConciergeCard {
  kind: "food" | "menu" | "service" | "link" | "itinerary" | "confirm_food";
  label: string;
  payload?: Record<string, unknown>;
}

interface Message {
  role: "user" | "concierge";
  text: string;
  escalated?: boolean;
  cards?: ConciergeCard[];
}

interface StayMetadata {
  code: string;
  guestName: string;
  guestFirstName: string;
  hotelName: string;
  hotelCity: string;
  roomNumber: string;
  roomName: string;
  checkInFormatted: string;
  checkOutFormatted: string;
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
}

interface ActiveRequestItem {
  id: string;
  type: "food" | "service";
  title: string;
  status: string;
  statusCode: string;
  timeText: string;
}

interface TimelineEvent {
  title: string;
  detail: string;
  timeText: string;
}

export function StayConcierge({
  bookingCode,
  hotelName: initialHotelName,
  initialRoomNumber,
}: {
  bookingCode: string;
  hotelName: string;
  initialRoomNumber?: string;
}) {
  const router = useRouter();
  const [stayMeta, setStayMeta] = useState<StayMetadata | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [thinkingText, setThinkingText] = useState("Aurelia Concierge is assisting…");
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    type: "food" | "service";
    title: string;
    priceInr?: number;
    payload: Record<string, unknown>;
  } | null>(null);

  // Timeline / Active requests drawer state
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [activeRequests, setActiveRequests] = useState<ActiveRequestItem[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Load stay metadata on mount
  useEffect(() => {
    let isMounted = true;
    async function loadStayInfo() {
      try {
        const res = await fetch("/api/concierge/stay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: bookingCode, action: "get_stay_info" }),
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.stay) {
            setStayMeta(data.stay);
            // Personalized initial greeting
            const greeting =
              data.stay.timeOfDay === "morning"
                ? "Good morning"
                : data.stay.timeOfDay === "afternoon"
                  ? "Good afternoon"
                  : data.stay.timeOfDay === "evening"
                    ? "Good evening"
                    : "Good night";

            setMessages([
              {
                role: "concierge",
                text: `${greeting}, ${data.stay.guestFirstName}.\nYou're staying in Room ${data.stay.roomNumber} at ${data.stay.hotelName}.\n\nWhat can I help with?\n🍛 Order food from the kitchen\n🧺 Request towels or housekeeping\n🌅 Explore nearby experiences\n💳 View your live folio\n🛎️ Hotel services & hours`,
                cards: [
                  { kind: "menu", label: "🍛 ORDER FOOD", payload: {} },
                  {
                    kind: "service",
                    label: "🧺 REQUEST TOWELS",
                    payload: { kind: "HOUSEKEEPING", title: "Fresh towels", detail: "Two bath towels to room" },
                  },
                  {
                    kind: "link",
                    label: "💳 VIEW FOLIO",
                    payload: { href: `/trips/${bookingCode}/stay/wallet` },
                  },
                  {
                    kind: "link",
                    label: "🌅 NEARBY EXPERIENCES",
                    payload: { href: `/trips/${bookingCode}/stay/experiences` },
                  },
                ],
              },
            ]);
            return;
          }
        }
      } catch {}

      // Fallback greeting if metadata load fails
      if (isMounted) {
        setMessages([
          {
            role: "concierge",
            text: `Good day — I'm your ${initialHotelName} Aurelia Concierge. I can find food from the hotel kitchen ("something spicy under ₹700"), arrange towels or housekeeping, plan your day nearby, or tell you what you've spent. What can I do?`,
          },
        ]);
      }
    }

    loadStayInfo();

    return () => {
      isMounted = false;
    };
  }, [bookingCode, initialHotelName]);

  // Fetch timeline / active requests
  async function fetchTimeline() {
    setLoadingTimeline(true);
    try {
      const res = await fetch("/api/concierge/stay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: bookingCode, action: "get_timeline" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.timeline) {
          setActiveRequests(data.timeline.activeRequests ?? []);
          setTimelineEvents(data.timeline.events ?? []);
        }
      }
    } catch {
    } finally {
      setLoadingTimeline(false);
    }
  }

  // Send conversational message
  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;

    // Conversational history for memory
    const historyPayload = messages.slice(-4).map((m) => ({ role: m.role, text: m.text }));

    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setInput("");
    setThinking(true);

    if (/food|hungry|eat|spicy|dinner|lunch/i.test(trimmed)) {
      setThinkingText("Checking hotel kitchen menu…");
    } else if (/bill|spent|folio|charges/i.test(trimmed)) {
      setThinkingText("Reviewing your live folio…");
    } else if (/towel|pillow|water|housekeeping/i.test(trimmed)) {
      setThinkingText("Coordinating with housekeeping…");
    } else {
      setThinkingText("Aurelia Concierge is assisting…");
    }

    try {
      const res = await fetch("/api/concierge/stay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          code: bookingCode,
          history: historyPayload,
        }),
      });
      const data = await res.json();
      await new Promise((r) => setTimeout(r, 350));
      setMessages((m) => [
        ...m,
        {
          role: "concierge",
          text: data.reply ?? data.message ?? "I hit a snag — one moment.",
          escalated: Boolean(data.escalate),
          cards: Array.isArray(data.cards) ? data.cards : [],
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "concierge", text: "Connection hiccup on my end — try again in a moment." },
      ]);
    } finally {
      setThinking(false);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
      );
    }
  }

  /**
   * Runs an action card.
   * Food orders and paid services require explicit confirmation before placement.
   */
  async function runCard(card: ConciergeCard) {
    if (busyLabel) return;

    // Two-step confirmation for food item cards
    if (card.kind === "food" && card.payload?.menuItemId) {
      setPendingConfirm({
        type: "food",
        title: String(card.payload?.name ?? "Food Item"),
        priceInr: Number(card.payload?.priceInr ?? 0),
        payload: card.payload,
      });
      return;
    }

    // Direct links and navigations
    if (card.kind === "link") {
      router.push(String(card.payload?.href ?? "/"));
      return;
    }
    if (card.kind === "menu") {
      router.push(`/trips/${bookingCode}/stay/food`);
      return;
    }
    if (card.kind === "itinerary") {
      setBusyLabel(card.label);
      try {
        const res = await fetch(`/api/bookings/${bookingCode}/itinerary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const data = await res.json();
        setToast(res.ok ? "Itinerary ready — opening My Stay." : (data.error ?? "Could not generate itinerary."));
        if (res.ok) setTimeout(() => router.push(`/trips/${bookingCode}/stay/experiences#itinerary`), 800);
      } finally {
        setBusyLabel(null);
      }
      return;
    }

    // Service request direct execution
    if (card.kind === "service") {
      setBusyLabel(card.label);
      try {
        const res = await fetch("/api/concierge/stay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: bookingCode,
            action: "confirm_service",
            payload: card.payload,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setToast("Request submitted to the team — track it under Services.");
          setMessages((m) => [
            ...m,
            {
              role: "concierge",
              text: data.reply ?? "Request submitted successfully.",
              cards: [{ kind: "link", label: "TRACK UNDER SERVICES", payload: { href: `/trips/${bookingCode}/stay/services` } }],
            },
          ]);
          fetchTimeline();
        } else {
          setToast(data.error ?? "The request could not be logged.");
        }
      } catch {
        setToast("Connection error — please try again.");
      } finally {
        setBusyLabel(null);
      }
    }
  }

  // Execute confirmed order
  async function executeConfirmedOrder() {
    if (!pendingConfirm) return;
    setBusyLabel("Placing order…");

    try {
      if (pendingConfirm.type === "food") {
        const res = await fetch("/api/concierge/stay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: bookingCode,
            action: "confirm_food_order",
            payload: pendingConfirm.payload,
          }),
        });
        const data = await res.json();
        if (res.ok && data.order) {
          setToast(`Order #${data.order.code} confirmed · ₹${data.order.totalInr.toLocaleString("en-IN")}`);
          setMessages((m) => [
            ...m,
            {
              role: "concierge",
              text: data.reply,
              cards: data.cards ?? [],
            },
          ]);
          setPendingConfirm(null);
          fetchTimeline();
          router.refresh();
        } else {
          setToast(data.error ?? "Could not place order. Nothing was charged.");
        }
      }
    } catch {
      setToast("Network error placing order. Nothing was charged.");
    } finally {
      setBusyLabel(null);
    }
  }

  const currentHotel = stayMeta?.hotelName ?? initialHotelName;
  const currentRoom = stayMeta?.roomNumber ?? initialRoomNumber ?? "502";
  const currentCheckOut = stayMeta?.checkOutFormatted ?? "during your stay";

  return (
    <div className="flex h-full flex-col">
      {/* 1. Stay-Aware Concierge Header (Point 3) */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-sm font-semibold tracking-tight sm:text-base text-foreground">
              Aurelia Concierge
            </h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active Stay
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs" style={{ color: "var(--muted)" }}>
            Your stay at <span className="font-medium text-foreground">{currentHotel}</span> · Room{" "}
            <span className="font-medium text-foreground">{currentRoom}</span> · Check-out{" "}
            <span className="font-medium text-foreground">{currentCheckOut}</span>
          </p>
        </div>

        {/* Timeline / Requests Drawer Toggle (Point 22 & 23) */}
        <button
          type="button"
          onClick={() => {
            setTimelineOpen(!timelineOpen);
            if (!timelineOpen) fetchTimeline();
          }}
          className="flex items-center gap-1.5 rounded-full border border-line bg-raised px-3 py-1 text-xs font-semibold text-foreground hover:bg-background transition-colors"
        >
          <span>📋</span>
          <span>{timelineOpen ? "Hide Requests" : "Requests & Timeline"}</span>
          {activeRequests.length > 0 && (
            <span className="rounded-full bg-accent px-1.5 py-0.2 text-[10px] font-bold text-on-accent">
              {activeRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* Timeline & Active Requests Drawer */}
      {timelineOpen && (
        <div className="animate-fade-up mb-3 rounded-2xl border border-line bg-raised/95 p-4 shadow-md backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-accent">
              Live Requests & Stay Activity
            </h4>
            <button
              type="button"
              onClick={() => setTimelineOpen(false)}
              className="text-xs text-muted hover:text-foreground"
            >
              ✕
            </button>
          </div>

          {loadingTimeline ? (
            <p className="mt-3 text-xs text-muted italic">Checking current hotel systems…</p>
          ) : activeRequests.length === 0 && timelineEvents.length === 0 ? (
            <p className="mt-3 text-xs text-muted">No active requests logged yet for this stay.</p>
          ) : (
            <div className="mt-3 space-y-3 max-h-48 overflow-y-auto">
              {activeRequests.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Active Requests</span>
                  <ul className="mt-1 space-y-1.5">
                    {activeRequests.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between rounded-xl bg-background/80 px-3 py-1.5 text-xs"
                      >
                        <span className="truncate font-medium text-foreground">{r.title}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted">{r.timeText}</span>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              r.statusCode === "CONFIRMED" || r.status === "Confirmed"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : r.statusCode === "PREPARING"
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                  : "bg-black/10 text-foreground"
                            }`}
                          >
                            {r.status}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {timelineEvents.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Recent Events</span>
                  <ul className="mt-1 space-y-1.5">
                    {timelineEvents.slice(0, 4).map((ev, i) => (
                      <li key={i} className="flex items-start justify-between gap-2 text-xs text-muted">
                        <div>
                          <span className="font-medium text-foreground">{ev.title}</span>
                          <span className="block text-[11px]">{ev.detail}</span>
                        </div>
                        <span className="shrink-0 text-[10px] text-muted">{ev.timeText}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. Contextual Quick Actions Bar (Point 5) */}
      <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { label: "🍛 Order Food", prompt: "What food is available from the kitchen right now?" },
          { label: "🧺 Request Towels", prompt: "Send two fresh bath towels to my room" },
          { label: "🧹 Housekeeping", prompt: "I need housekeeping to clean my room" },
          { label: "💳 View Folio", prompt: "How much have I spent during my stay?" },
          { label: "🌅 Things To Do", prompt: "What can I do near the hotel tonight?" },
          { label: "🚕 Airport Chauffeur", prompt: "Can I arrange an airport transfer?" },
          { label: "🧖 Book Spa", prompt: "Can I book a spa appointment?" },
          { label: "🛎️ Hotel Services", prompt: "What services and facilities does the hotel provide?" },
        ].map((action, i) => (
          <button
            key={i}
            type="button"
            onClick={() => send(action.prompt)}
            disabled={thinking}
            className="flex shrink-0 items-center gap-1 rounded-full border border-line bg-raised hover:bg-background px-3 py-1 text-xs font-medium text-foreground shadow-sm transition-all hover:scale-105 active:scale-95"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* 3. Messages Scroll View */}
      <div
        ref={scrollRef}
        className="min-h-72 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-line bg-background p-4 shadow-inner"
        aria-live="polite"
      >
        {messages.map((m, i) => (
          <div key={i} className="animate-fade-up">
            <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  m.role === "user"
                    ? "text-on-accent rounded-br-sm shadow-md"
                    : "border border-line bg-raised text-foreground rounded-bl-sm"
                }`}
                style={m.role === "user" ? { background: "var(--accent)" } : undefined}
              >
                {m.text.replace(/\*\*/g, "")}
                {m.escalated && (
                  <span className="mt-2 block text-[11px] font-semibold tracking-wide uppercase opacity-75">
                    Duty manager paged
                  </span>
                )}
              </div>
            </div>

            {/* Action Cards */}
            {m.cards && m.cards.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-2 pl-1">
                {m.cards.map((c, j) =>
                  c.kind === "food" ? (
                    <button
                      key={j}
                      type="button"
                      onClick={() => runCard(c)}
                      disabled={Boolean(busyLabel)}
                      className="btn-primary !px-4 !py-2 !text-xs font-semibold shadow-sm hover:scale-105 transition-transform"
                    >
                      {busyLabel === c.label ? "Checking…" : c.label}
                    </button>
                  ) : (
                    <button
                      key={j}
                      type="button"
                      onClick={() => runCard(c)}
                      disabled={Boolean(busyLabel)}
                      className="btn-secondary !px-4 !py-2 !text-xs font-semibold shadow-sm hover:scale-105 transition-transform"
                    >
                      {c.label}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        ))}

        {/* Typing / Loading indicator with contextual label */}
        {thinking && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-line bg-raised px-4 py-2.5 shadow-sm">
              <span className="flex gap-1" aria-label="Concierge is working">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </span>
              <span className="text-xs text-muted font-medium">{thinkingText}</span>
            </div>
          </div>
        )}
      </div>

      {/* Two-Step Order Confirmation Modal (Point 7 & 19) */}
      {pendingConfirm && (
        <div className="animate-fade-up mt-3 rounded-2xl border border-accent/40 bg-raised p-4 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">Order Confirmation</span>
              <h4 className="font-display mt-0.5 text-base font-semibold text-foreground">
                {pendingConfirm.title} {pendingConfirm.priceInr ? `· ₹${pendingConfirm.priceInr.toLocaleString("en-IN")}` : ""}
              </h4>
              <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                Would you like to place this order to <span className="font-medium text-foreground">Room {currentRoom}</span>?
                Charges will appear on your room folio.
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={executeConfirmedOrder}
              disabled={Boolean(busyLabel)}
              className="btn-primary !px-4 !py-2 !text-xs font-semibold"
            >
              {busyLabel ? "Placing Order…" : `Confirm Order (${pendingConfirm.priceInr ? `₹${pendingConfirm.priceInr.toLocaleString("en-IN")}` : "Submit"})`}
            </button>
            <button
              type="button"
              onClick={() => setPendingConfirm(null)}
              disabled={Boolean(busyLabel)}
              className="btn-secondary !px-4 !py-2 !text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Live Toast feedback */}
      {toast && (
        <p
          role="status"
          aria-live="polite"
          className="animate-fade-up mt-2 rounded-xl border border-line bg-raised px-3.5 py-2 text-xs font-medium shadow-sm"
          style={{ color: "var(--pine)" }}
        >
          {toast}
        </p>
      )}

      {/* Natural Language Input Form */}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          className="input flex-1 !text-xs sm:!text-sm"
          placeholder='Ask anything: "Something spicy under ₹700", "Send towels", "My bill"'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Message the Aurelia Concierge"
        />
        <button
          type="submit"
          className="btn-primary shrink-0 !px-5 !py-2 !text-xs font-semibold"
          disabled={!input.trim() || thinking}
        >
          Send
        </button>
      </form>

      {/* Footer Notice (Point 36) */}
      <p className="mt-2 text-center text-[11px]" style={{ color: "var(--muted)" }}>
        Demo experience — payments simulated in test mode · Orders require your confirmation before placement ·{" "}
        <Link href="/trips" className="underline hover:text-foreground">
          switch stays
        </Link>
      </p>
    </div>
  );
}
