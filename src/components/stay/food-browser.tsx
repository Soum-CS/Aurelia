"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatINR } from "@/lib/format";

/* ── types mirroring the API ─────────────────────────────────────────── */
interface Addon {
  name: string;
  priceInr: number;
}
interface Item {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  priceInr: number;
  diet: "VEG" | "NON_VEG" | "VEGAN" | "EGG" | string;
  calories: number | null;
  allergens: string[];
  ingredients: string | null;
  prepMinutes: number;
  spiceLevel: number;
  proteinG: number | null;
  tags: string[];
  addons: Addon[];
  emoji: string;
  available: boolean;
}
interface MenuData {
  restaurant: { id: string; name: string; cuisine: string; summary: string; hours: Record<string, string>; provenance: string };
  hotel: { name: string; city: string };
  categories: { id: string; name: string }[];
  items: Item[];
}
interface OrderItem {
  name: string;
  qty: number;
  lineTotalInr: number;
}
interface Order {
  id: string;
  code: string;
  status: string;
  scheduledFor: string | null;
  deliveryLocation: string;
  totalInr: number;
  etaMinutes: number;
  timeline: Record<string, string>;
  items: OrderItem[];
  createdAt: string;
}

const ORDER_FLOW = ["CONFIRMED", "PREPARING", "READY", "ON_THE_WAY", "DELIVERED"] as const;
const FLOW_LABELS: Record<string, string> = {
  CONFIRMED: "Order confirmed",
  PREPARING: "Preparing",
  READY: "Ready for delivery",
  ON_THE_WAY: "On the way",
  DELIVERED: "Delivered",
};

const DIET_BADGE: Record<string, { label: string; color: string }> = {
  VEG: { label: "● Veg", color: "#1e7d32" },
  NON_VEG: { label: "▲ Non-veg", color: "#a13226" },
  VEGAN: { label: "🌱 Vegan", color: "#2e6b3f" },
  EGG: { label: "○ Egg", color: "#b07d2b" },
};

interface CartLine {
  itemId: string;
  qty: number;
  addonNames: string[];
}

export function FoodBrowser({ bookingCode }: { bookingCode: string }) {
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeCat, setActiveCat] = useState<string>("__all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState<string>("");
  const [placing, setPlacing] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [recs, setRecs] = useState<Item[]>([]);
  const [recQuery, setRecQuery] = useState("");
  const [recLoading, setRecLoading] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${bookingCode}/food/orders`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders ?? []);
      }
    } catch {
      /* keep previous state */
    }
  }, [bookingCode]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/bookings/${bookingCode}/food/menu`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          setMenuError(data.message ?? data.error ?? "Hotel dining is temporarily unavailable.");
          return;
        }
        setMenu(data);
      } catch {
        setMenuError("Hotel dining is temporarily unavailable. Please try again later.");
      }
      await loadOrders();
    })();
  }, [bookingCode, loadOrders]);

  // poll live order statuses while anything is in flight
  useEffect(() => {
    const hasLive = orders.some((o) => o.status !== "DELIVERED" && o.status !== "CANCELLED");
    if (!hasLive) return;
    const t = setInterval(loadOrders, 15000);
    return () => clearInterval(t);
  }, [orders, loadOrders]);

  const itemsByCat = useMemo(() => {
    if (!menu) return [];
    return activeCat === "__all"
      ? menu.items
      : menu.items.filter((i) => i.categoryId === activeCat);
  }, [menu, activeCat]);

  function addToCart(item: Item, qty = 1, addonNames: string[] = []) {
    setCart((c) => {
      const key = (l: CartLine) => l.itemId === item.id && l.addonNames.join("|") === addonNames.join("|");
      const existing = c.find(key);
      if (existing) return c.map((l) => (key(l) ? { ...l, qty: Math.min(20, l.qty + qty) } : l));
      return [...c, { itemId: item.id, qty, addonNames }];
    });
  }

  function cartTotal(): number {
    if (!menu) return 0;
    let sum = 0;
    for (const line of cart) {
      const item = menu.items.find((i) => i.id === line.itemId);
      if (!item) continue;
      const addons = item.addons.filter((a) => line.addonNames.includes(a.name));
      sum += (item.priceInr + addons.reduce((s, a) => s + a.priceInr, 0)) * line.qty;
    }
    return sum;
  }

  async function placeOrder() {
    if (!cart.length || placing) return;
    setPlacing(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/bookings/${bookingCode}/food/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((l) => ({ menuItemId: l.itemId, qty: l.qty, addonNames: l.addonNames })),
          scheduledFor: scheduleAt || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.order) {
        setCart([]);
        setScheduleAt("");
        setExpanded(null);
        setNotice({
          ok: true,
          text: `Order ${data.order.code} confirmed — ₹${data.order.totalInr.toLocaleString("en-IN")} charged to your room. Track it below.`,
        });
        await loadOrders();
      } else {
        setNotice({ ok: false, text: data.error ?? data.message ?? "The order could not be placed. No charge was made." });
      }
    } catch {
      setNotice({ ok: false, text: "Network problem — the order was not placed." });
    } finally {
      setPlacing(false);
    }
  }

  async function runRecs() {
    if (!recQuery.trim() || recLoading) return;
    setRecLoading(true);
    try {
      // The concierge endpoint returns real menu matches as actionable cards.
      const res = await fetch("/api/concierge/stay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: recQuery, code: bookingCode }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.cards)) {
        const ids = data.cards.filter((c: { kind?: string }) => c.kind === "food").map((c: { payload?: { menuItemId?: string } }) => c.payload?.menuItemId);
        if (menu) {
          setRecs(ids.map((id: string) => menu.items.find((i) => i.id === id)).filter(Boolean).slice(0, 6));
        }
        setNotice(null);
      } else {
        setNotice({ ok: false, text: data.reply ?? data.error ?? "Could not get recommendations right now." });
      }
    } finally {
      setRecLoading(false);
    }
  }

  /* ── states ── */
  if (menuError) {
    return (
      <div className="card p-8 text-center">
        <p className="text-3xl" aria-hidden>🍽️</p>
        <h2 className="font-display mt-3 text-xl font-semibold">Hotel dining unavailable</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm" style={{ color: "var(--muted)" }}>{menuError}</p>
        <button type="button" className="btn-secondary mt-5" onClick={() => location.reload()}>
          TRY AGAIN
        </button>
      </div>
    );
  }
  if (!menu) {
    return (
      <div className="card animate-pulse p-8 text-center text-sm" style={{ color: "var(--muted)" }}>
        Loading the menu…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* restaurant header */}
      <section aria-label="Restaurant" className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold">{menu.restaurant.name}</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{menu.restaurant.summary}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
              {menu.restaurant.cuisine}
              {Object.entries(menu.restaurant.hours).map(([k, v]) => ` · ${k} ${v}`)}
            </p>
          </div>
          <span
            className="rounded-full px-3 py-1 text-[11px] font-bold tracking-wide uppercase"
            style={{
              background: menu.restaurant.provenance === "demo"
                ? "color-mix(in srgb, #b07d2b 14%, transparent)"
                : "color-mix(in srgb, var(--pine) 13%, transparent)",
              color: menu.restaurant.provenance === "demo" ? "#8a6217" : "var(--pine)",
            }}
          >
            {menu.restaurant.provenance === "demo" ? "Demo menu · not live inventory" : "Live availability"}
          </span>
        </div>
      </section>

      {/* AI food recommendation */}
      <section aria-label="AI food recommendations" className="card p-5 sm:p-6">
        <h3 className="font-display text-lg font-semibold">AI recommendations</h3>
        <p className="mb-3 mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
          Only from what&apos;s actually on {menu.restaurant.name}&apos;s menu right now.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            runRecs();
          }}
        >
          <input
            className="input flex-1"
            placeholder='e.g. "healthy vegetarian dinner under ₹500"'
            value={recQuery}
            onChange={(e) => setRecQuery(e.target.value)}
            aria-label="Describe what you'd like to eat"
          />
          <button type="submit" className="btn-primary !px-4" disabled={!recQuery.trim() || recLoading}>
            {recLoading ? "Thinking…" : "Find"}
          </button>
        </form>
        {recs.length > 0 && (
          <ul className="mt-4 grid gap-2 sm:grid-cols-3">
            {recs.map((r) => (
              <li key={r.id} className="rounded-xl border border-line p-3 text-sm">
                <p className="font-semibold">{r.emoji} {r.name}</p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                  ₹{r.priceInr.toLocaleString("en-IN")} · {r.prepMinutes} min{r.calories ? ` · ~${r.calories} kcal` : ""}
                </p>
                <button type="button" className="btn-secondary mt-2 !px-3 !py-1.5 !text-xs" onClick={() => addToCart(r)}>
                  ADD TO ORDER
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* category tabs */}
      <div role="tablist" aria-label="Menu categories" className="flex flex-wrap gap-1.5">
        {[{ id: "__all", name: "All" }, ...menu.categories].map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={activeCat === c.id}
            onClick={() => setActiveCat(c.id)}
            className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${activeCat === c.id ? "" : "hover:bg-raised"}`}
            style={activeCat === c.id
              ? { background: "var(--accent)", color: "var(--on-accent)", borderColor: "transparent" }
              : { borderColor: "var(--line)" }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* items */}
      <ul className="grid gap-3 sm:grid-cols-2">
        {itemsByCat.map((item) => {
          const badge = DIET_BADGE[item.diet];
          const isOpen = expanded === item.id;
          return (
            <li key={item.id} className={`card p-4 ${!item.available ? "opacity-60" : ""}`}>
              <div className="flex gap-3">
                <span aria-hidden className="text-3xl">{item.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold leading-snug">{item.name}</h4>
                    <span className="shrink-0 text-sm font-semibold">{formatINR(item.priceInr)}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{item.description}</p>
                  <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]" style={{ color: badge?.color ?? "var(--muted)" }}>
                    <strong>{badge?.label ?? item.diet}</strong>
                    <span style={{ color: "var(--muted)" }}>⏱ {item.prepMinutes} min</span>
                    {item.calories != null && <span style={{ color: "var(--muted)" }}>~{item.calories} kcal</span>}
                    {item.spiceLevel > 0 && (
                      <span style={{ color: "#b03a2e" }}>{"🌶".repeat(Math.min(3, item.spiceLevel))}</span>
                    )}
                  </p>
                  {!item.available && (
                    <p className="mt-1 text-[11px] font-semibold" style={{ color: "#b03a2e" }}>Sold out right now</p>
                  )}
                  {(item.allergens.length > 0 || item.addons.length > 0 || item.ingredients) && (
                    <>
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : item.id)}
                        className="mt-1.5 cursor-pointer text-[11px] font-bold tracking-wide uppercase hover:underline"
                        style={{ color: "var(--accent)" }}
                        aria-expanded={isOpen}
                      >
                        {isOpen ? "Hide details −" : "Details & customise +"}
                      </button>
                      {isOpen && (
                        <div className="mt-2 space-y-2 rounded-xl bg-raised p-3 text-xs">
                          {item.ingredients && (
                            <p><strong>Ingredients:</strong> <span style={{ color: "var(--muted)" }}>{item.ingredients}</span></p>
                          )}
                          {item.allergens.length > 0 && (
                            <p><strong>Allergens:</strong> <span style={{ color: "var(--muted)" }}>{item.allergens.join(", ")}</span></p>
                          )}
                          {item.proteinG != null && (
                            <p><strong>Protein:</strong> <span style={{ color: "var(--muted)" }}>{item.proteinG} g</span></p>
                          )}
                          {item.tags.length > 0 && (
                            <p className="flex flex-wrap gap-1">
                              {item.tags.map((t) => (
                                <span key={t} className="rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold">{t.replace("-", " ")}</span>
                              ))}
                            </p>
                          )}
                          {item.available &&
                            (item.addons.length > 0 ? (
                              <AddonPicker
                                item={item}
                                onAdd={(qty, addons) => {
                                  addToCart(item, qty, addons);
                                  setExpanded(null);
                                  setNotice({ ok: true, text: `${item.name} added to your order.` });
                                  setTimeout(() => setNotice(null), 2500);
                                }}
                              />
                            ) : (
                              <QuickAdd
                                item={item}
                                onAdd={(qty) => {
                                  addToCart(item, qty);
                                  setExpanded(null);
                                }}
                              />
                            ))}
                        </div>
                      )}
                    </>
                  )}
                  {item.available && (item.allergens.length === 0 && !item.ingredients) && (
                    <button
                      type="button"
                      className="btn-primary mt-2 !px-4 !py-1.5 !text-xs"
                      onClick={() => addToCart(item)}
                    >
                      ADD TO ORDER
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* floating cart bar */}
      {cart.length > 0 && (
        <div className="sticky bottom-4 z-30">
          <div className="card border-accent p-4 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <strong>{cart.reduce((s, l) => s + l.qty, 0)} item{cart.reduce((s, l) => s + l.qty, 0) === 1 ? "" : "s"}</strong>
                {" · "}
                {formatINR(cartTotal())} + 5% tax
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs" htmlFor="schedule-at" style={{ color: "var(--muted)" }}>Schedule</label>
                <input
                  id="schedule-at"
                  type="datetime-local"
                  className="input !w-auto !py-1.5 text-xs"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                />
                <button type="button" className="btn-primary !px-4 !py-2 !text-xs" onClick={placeOrder} disabled={placing}>
                  {placing ? "Placing…" : scheduleAt ? "CONFIRM SCHEDULE" : "PLACE ORDER"}
                </button>
                <button
                  type="button"
                  aria-label="Clear cart"
                  className="cursor-pointer px-2 text-xs underline"
                  style={{ color: "var(--muted)" }}
                  onClick={() => setCart([])}
                >
                  clear
                </button>
              </div>
            </div>
            {notice && (
              <p role="status" className="mt-2 text-xs font-medium" style={{ color: notice.ok ? "var(--pine)" : "#b03a2e" }}>
                {notice.text}
              </p>
            )}
          </div>
        </div>
      )}

      {/* order tracking */}
      <section aria-label="Order history and tracking" className="card p-5 sm:p-6">
        <h3 className="font-display text-lg font-semibold">Your orders</h3>
        {orders.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>No orders yet on this stay.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {orders.map((o) => {
              const flowIdx = ORDER_FLOW.indexOf(o.status as (typeof ORDER_FLOW)[number]);
              const cancelled = o.status === "CANCELLED";
              return (
                <li key={o.id} className="rounded-2xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">
                      <strong>ORDER #{o.code}</strong>{" "}
                      <span style={{ color: "var(--muted)" }}>
                        · {o.deliveryLocation} · placed{" "}
                        {new Date(o.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <span className="text-sm font-semibold">{formatINR(o.totalInr)}</span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                    {o.items.map((it) => `${it.qty}× ${it.name}`).join(" · ")}
                    {o.scheduledFor && ` · scheduled ${new Date(o.scheduledFor).toLocaleString("en-IN")}`}
                  </p>
                  {cancelled ? (
                    <p className="mt-2 text-xs font-semibold" style={{ color: "#b03a2e" }}>Cancelled — no charge stands.</p>
                  ) : (
                    <ol className="mt-3 space-y-1.5" aria-label={`Order ${o.code} progress`}>
                      {ORDER_FLOW.map((step, i) => {
                        const done = flowIdx >= i;
                        const current = flowIdx === i;
                        const at = o.timeline[step];
                        return (
                          <li key={step} className="flex items-center gap-2 text-xs">
                            <span aria-hidden style={{ color: done ? "var(--pine)" : "var(--muted)" }}>
                              {done ? (current ? "●" : "✓") : "○"}
                            </span>
                            <span style={{ color: current ? "var(--ink)" : done ? "var(--pine)" : "var(--muted)", fontWeight: current ? 700 : 400 }}>
                              {FLOW_LABELS[step]}
                              {current && step === "ON_THE_WAY" && " — arriving in ~5 min"}
                              {at && i > 0 && flowIdx > i && (
                                <span style={{ color: "var(--muted)" }}>
                                  {" "}· {new Date(at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function AddonPicker({
  item,
  onAdd,
}: {
  item: Item;
  onAdd: (qty: number, addonNames: string[]) => void;
}) {
  const [qty, setQty] = useState(1);
  const [chosen, setChosen] = useState<string[]>([]);
  const extra = item.addons.filter((a) => chosen.includes(a.name)).reduce((s, a) => s + a.priceInr, 0);
  return (
    <div>
      {item.addons.length > 0 && (
        <fieldset className="space-y-1">
          <legend className="font-semibold">Add-ons</legend>
          {item.addons.map((a) => (
            <label key={a.name} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={chosen.includes(a.name)}
                onChange={(e) =>
                  setChosen((c) => (e.target.checked ? [...c, a.name] : c.filter((n) => n !== a.name)))
                }
              />
              {a.name} (+{formatINR(a.priceInr)})
            </label>
          ))}
        </fieldset>
      )}
      <div className="mt-2 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Decrease quantity" className="cursor-pointer rounded-full border border-line px-2.5 py-0.5" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          <span className="w-5 text-center font-semibold">{qty}</span>
          <button type="button" aria-label="Increase quantity" className="cursor-pointer rounded-full border border-line px-2 py-0.5" onClick={() => setQty((q) => Math.min(20, q + 1))}>+</button>
        </div>
        <button
          type="button"
          className="btn-primary !px-4 !py-1.5 !text-xs"
          onClick={() => onAdd(qty, chosen)}
        >
          ADD · {formatINR((item.priceInr + extra) * qty)}
        </button>
      </div>
    </div>
  );
}

function QuickAdd({ item, onAdd }: { item: Item; onAdd: (qty: number) => void }) {
  const [qty, setQty] = useState(1);
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Decrease quantity" className="cursor-pointer rounded-full border border-line px-2.5 py-0.5" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
        <span className="w-5 text-center font-semibold">{qty}</span>
        <button type="button" aria-label="Increase quantity" className="cursor-pointer rounded-full border border-line px-2 py-0.5" onClick={() => setQty((q) => Math.min(20, q + 1))}>+</button>
      </div>
      <button type="button" className="btn-primary !px-4 !py-1.5 !text-xs" onClick={() => onAdd(qty)}>
        ADD · {formatINR(item.priceInr * qty)}
      </button>
    </div>
  );
}
