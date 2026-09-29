"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

const ICONS: Record<string, string> = {
  checkin: "🏨",
  checkout: "🧳",
  food: "🍛",
  service: "🧺",
  activity: "🌅",
  system: "🔔",
};

export function NotificationsBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const d = await res.json();
      setItems(d.notifications ?? []);
      setUnread(d.unread ?? 0);
      setLoadedOnce(true);
    } catch {
      /* silent for the bell */
    }
  }, []);

  useEffect(() => {
    void (async () => load())();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function markRead(id?: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { ids: [id] } : { all: true }),
    });
    load();
  }

  if (!loadedOnce && unread === 0) {
    // still render the button so guests discover it after their first stay
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="focus-visible:outline-accent relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-raised focus-visible:outline-2"
      >
        <span aria-hidden>🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold" style={{ background: "#b03a2e", color: "white" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="card absolute right-0 z-50 mt-2 max-h-96 w-80 overflow-y-auto p-3 sm:w-96">
          <div className="flex items-center justify-between px-1 pb-2">
            <p className="text-xs font-bold tracking-widest uppercase">Notifications</p>
            {items.length > 0 && (
              <button type="button" className="cursor-pointer text-[11px] underline" style={{ color: "var(--muted)" }} onClick={() => markRead()}>
                mark all read
              </button>
            )}
          </div>
          {!loadedOnce ? (
            <p className="px-1 py-4 text-sm" style={{ color: "var(--muted)" }}>Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-1 py-4 text-sm" style={{ color: "var(--muted)" }}>
              Nothing yet — reminders appear as your stay approaches.
            </p>
          ) : (
            <ul className="space-y-1">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href ?? "#"}
                    onClick={() => {
                      if (!n.readAt) markRead(n.id);
                      setOpen(false);
                    }}
                    className="block rounded-xl px-2 py-2 transition-colors hover:bg-raised"
                    style={!n.readAt ? { background: "color-mix(in srgb, var(--accent) 7%, transparent)" } : undefined}
                  >
                    <span className="flex gap-2">
                      <span aria-hidden>{ICONS[n.type] ?? "🔔"}</span>
                      <span>
                        <strong className="block text-sm leading-snug">{n.title}</strong>
                        <span className="block text-xs" style={{ color: "var(--muted)" }}>{n.body}</span>
                        <span className="mt-0.5 block text-[10px]" style={{ color: "var(--muted)" }}>
                          {new Date(n.createdAt).toLocaleString("en-IN")}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
