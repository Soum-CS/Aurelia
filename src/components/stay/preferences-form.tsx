"use client";

import { useEffect, useState, useMemo } from "react";
import { formatINR } from "@/lib/format";

const FOOD_PREFS = [
  "vegetarian",
  "vegan",
  "jain",
  "spicy",
  "healthy",
  "high-protein",
  "low-cal",
];

const CUISINES = [
  "indian",
  "chinese",
  "continental",
  "mediterranean",
  "italian",
];

const INTERESTS = [
  "culture",
  "history",
  "art",
  "food",
  "nature",
  "adventure",
  "nightlife",
  "music",
  "relaxation",
  "shopping",
];

const ROOM_PREFS = [
  "high floor",
  "balcony",
  "city view",
  "ocean view",
  "away from lift",
];

export interface Prefs {
  foodPrefs: string[];
  cuisines: string[];
  roomPrefs: string[];
  interests: string[];
  allergies: string[];
  bedPreference: string | null;
  temperatureC: number | null;
  budgetPerNightInr: number | null;
  checkinTime: string | null;
  checkoutTime: string | null;
}

const EMPTY: Prefs = {
  foodPrefs: [],
  cuisines: [],
  roomPrefs: [],
  interests: [],
  allergies: [],
  bedPreference: null,
  temperatureC: 22,
  budgetPerNightInr: 8000,
  checkinTime: "13:00",
  checkoutTime: "11:00",
};

const STORAGE_KEY = "aurelia_guest_preferences";

function formatTime12(t: string | null | undefined): string {
  if (!t) return "—";
  const m24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    let h = parseInt(m24[1], 10);
    const mm = m24[2];
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${String(h).padStart(2, "0")}:${mm} ${ampm}`;
  }
  return t;
}

function normalizeTimeInput(v: string): string {
  const m12 = v.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const mm = m12[2];
    const ampm = m12[3].toUpperCase();
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${mm}`;
  }
  return v;
}

export function PreferencesForm() {
  const [prefs, setPrefs] = useState<Prefs>(EMPTY);
  const [allergiesText, setAllergiesText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Load from API + localStorage fallback
  useEffect(() => {
    let active = true;
    (async () => {
      // 1. Instant hydration from client storage if available
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached && active) {
          const parsed = JSON.parse(cached);
          setPrefs((p) => ({ ...p, ...parsed }));
          if (Array.isArray(parsed.allergies)) {
            setAllergiesText(parsed.allergies.join(", "));
          }
        }
      } catch {
        // storage disabled or unavailable
      }

      // 2. Authoritative server load
      try {
        const res = await fetch("/api/preferences", { cache: "no-store" });
        if (res.ok && active) {
          const d = await res.json();
          if (d.preferences && Object.keys(d.preferences).length > 0) {
            const merged = { ...EMPTY, ...d.preferences };
            setPrefs(merged);
            if (Array.isArray(merged.allergies)) {
              setAllergiesText(merged.allergies.join(", "));
            }
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        // network issue — rely on client cached state
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function toggle(
    key: "foodPrefs" | "cuisines" | "roomPrefs" | "interests",
    value: string,
  ) {
    setPrefs((p) => ({
      ...p,
      [key]: p[key].includes(value)
        ? p[key].filter((v) => v !== value)
        : [...p[key], value],
    }));
  }

  // Parse allergies from text input into a clean string array
  const parsedAllergies = useMemo(() => {
    const list = allergiesText
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return [...new Set(list)];
  }, [allergiesText]);

  async function save() {
    if (saving) return;

    // Validation
    if (prefs.budgetPerNightInr != null && prefs.budgetPerNightInr <= 0) {
      setToast("Please enter a valid nightly budget greater than zero.");
      setToastType("error");
      return;
    }

    setSaving(true);
    setToast(null);

    const payload: Prefs = {
      ...prefs,
      allergies: parsedAllergies,
      checkinTime: prefs.checkinTime ? normalizeTimeInput(prefs.checkinTime) : null,
      checkoutTime: prefs.checkoutTime ? normalizeTimeInput(prefs.checkoutTime) : null,
      temperatureC:
        prefs.temperatureC != null
          ? Math.min(30, Math.max(16, Math.round(prefs.temperatureC)))
          : null,
    };

    try {
      const res = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (res.ok) {
        const saved = d.preferences ?? payload;
        setPrefs(saved);
        setAllergiesText(saved.allergies?.join(", ") ?? "");
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        } catch {
          /* ignore */
        }
        setToast("Preferences saved ✓ — recommendations will adapt.");
        setToastType("success");
      } else {
        setToast(d.error ?? "Could not save preferences. Please retry.");
        setToastType("error");
      }
    } catch {
      setToast("Network problem — nothing was saved.");
      setToastType("error");
    } finally {
      setSaving(false);
      setTimeout(() => {
        setToast(null);
        setToastType(null);
      }, 5000);
    }
  }

  async function wipe() {
    try {
      await fetch("/api/preferences", { method: "DELETE" });
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setPrefs({
        foodPrefs: [],
        cuisines: [],
        roomPrefs: [],
        interests: [],
        allergies: [],
        bedPreference: null,
        temperatureC: null,
        budgetPerNightInr: null,
        checkinTime: null,
        checkoutTime: null,
      });
      setAllergiesText("");
      setConfirmDelete(false);
      setToast("Your preference profile has been deleted.");
      setToastType("success");
    } catch {
      setToast("Could not delete preference profile. Please retry.");
      setToastType("error");
    } finally {
      setTimeout(() => {
        setToast(null);
        setToastType(null);
      }, 4000);
    }
  }

  if (!loaded) {
    return (
      <div
        className="card animate-pulse p-8 text-center text-sm"
        style={{ color: "var(--muted)" }}
      >
        Loading your preference profile…
      </div>
    );
  }

  const hasAnyPrefs =
    prefs.foodPrefs.length > 0 ||
    prefs.cuisines.length > 0 ||
    prefs.interests.length > 0 ||
    prefs.roomPrefs.length > 0 ||
    Boolean(prefs.bedPreference) ||
    Boolean(prefs.budgetPerNightInr) ||
    Boolean(prefs.temperatureC) ||
    parsedAllergies.length > 0;

  return (
    <div className="space-y-6">
      {/* ── Smart Profile Summary Section ── */}
      {hasAnyPrefs && (
        <section
          aria-label="Your Aurelia profile summary"
          className="rounded-2xl border border-line bg-raised/50 p-4 sm:p-5 text-xs space-y-3"
        >
          <div className="flex items-center justify-between border-b border-line/60 pb-2">
            <h2 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Your Aurelia Profile
            </h2>
            <span className="text-[11px] text-muted">Active guest session</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 text-muted">
            {prefs.foodPrefs.length > 0 && (
              <div>
                <span className="font-semibold text-foreground">Food: </span>
                <span className="capitalize">
                  {prefs.foodPrefs.map((f) => f.replace("-", " ")).join(" · ")}
                </span>
              </div>
            )}
            {prefs.cuisines.length > 0 && (
              <div>
                <span className="font-semibold text-foreground">Cuisines: </span>
                <span className="capitalize">{prefs.cuisines.join(" · ")}</span>
              </div>
            )}
            {prefs.interests.length > 0 && (
              <div>
                <span className="font-semibold text-foreground">Interests: </span>
                <span className="capitalize">{prefs.interests.join(" · ")}</span>
              </div>
            )}
            {prefs.roomPrefs.length > 0 && (
              <div>
                <span className="font-semibold text-foreground">Room: </span>
                <span className="capitalize">
                  {[
                    ...prefs.roomPrefs,
                    prefs.bedPreference ? `${prefs.bedPreference} bed` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            )}
            {prefs.budgetPerNightInr != null && (
              <div>
                <span className="font-semibold text-foreground">Budget: </span>
                <span>{formatINR(prefs.budgetPerNightInr)}/night</span>
              </div>
            )}
            {prefs.temperatureC != null && (
              <div>
                <span className="font-semibold text-foreground">Temperature: </span>
                <span>{prefs.temperatureC}°C</span>
              </div>
            )}
            {parsedAllergies.length > 0 && (
              <div>
                <span className="font-semibold text-foreground">Allergies: </span>
                <span className="capitalize text-amber-500 font-medium">
                  {parsedAllergies.join(", ")}
                </span>
              </div>
            )}
            {(prefs.checkinTime || prefs.checkoutTime) && (
              <div>
                <span className="font-semibold text-foreground">Hours: </span>
                <span>
                  Check-in: {formatTime12(prefs.checkinTime)} · Check-out:{" "}
                  {formatTime12(prefs.checkoutTime)}
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Food preferences ── */}
      <ChipGroup
        label="Food preferences"
        options={FOOD_PREFS}
        selected={prefs.foodPrefs}
        onToggle={(v) => toggle("foodPrefs", v)}
      />

      {/* ── Favourite cuisines ── */}
      <ChipGroup
        label="Favourite cuisines"
        options={CUISINES}
        selected={prefs.cuisines}
        onToggle={(v) => toggle("cuisines", v)}
      />

      {/* ── Activity interests ── */}
      <ChipGroup
        label="Activity interests"
        options={INTERESTS}
        selected={prefs.interests}
        onToggle={(v) => toggle("interests", v)}
      />

      {/* ── Room preferences ── */}
      <ChipGroup
        label="Room preferences"
        options={ROOM_PREFS}
        selected={prefs.roomPrefs}
        onToggle={(v) => toggle("roomPrefs", v)}
      />

      {/* ── Numerical / Time / Selection Preferences ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Bed Preference */}
        <div>
          <label htmlFor="pref-bed" className="label">
            Bed preference
          </label>
          <select
            id="pref-bed"
            className="input"
            value={prefs.bedPreference ?? ""}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, bedPreference: e.target.value || null }))
            }
          >
            <option value="">No preference</option>
            <option value="king">King bed</option>
            <option value="twin">Twin beds</option>
            <option value="firm-mattress">Firm mattress</option>
            <option value="soft-pillows">Extra pillows</option>
          </select>
        </div>

        {/* Room Temperature Slider & Control */}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="pref-temp" className="label">
              Room temperature · °C
            </label>
            <span className="text-xs font-bold font-mono text-accent">
              {prefs.temperatureC ?? 22}°C
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <input
              id="pref-temp"
              type="range"
              min={16}
              max={30}
              step={1}
              className="w-full accent-accent cursor-pointer"
              value={prefs.temperatureC ?? 22}
              onChange={(e) =>
                setPrefs((p) => ({
                  ...p,
                  temperatureC: Number(e.target.value),
                }))
              }
              aria-valuenow={prefs.temperatureC ?? 22}
              aria-valuemin={16}
              aria-valuemax={30}
            />
            <input
              type="number"
              min={16}
              max={30}
              className="input !w-16 !py-1 text-center font-mono text-xs"
              value={prefs.temperatureC ?? 22}
              onChange={(e) =>
                setPrefs((p) => ({
                  ...p,
                  temperatureC: e.target.value ? Number(e.target.value) : 22,
                }))
              }
            />
          </div>
          <p className="mt-1 text-[11px] text-muted">
            Preferred range: 16°C–30°C · Preset for pre-arrival room preparation.
          </p>
        </div>

        {/* Budget per night */}
        <div>
          <label htmlFor="pref-budget" className="label">
            Budget per night · ₹
          </label>
          <input
            id="pref-budget"
            type="number"
            min={0}
            step={500}
            className="input font-mono"
            placeholder="8000"
            value={prefs.budgetPerNightInr ?? ""}
            onChange={(e) =>
              setPrefs((p) => ({
                ...p,
                budgetPerNightInr: e.target.value ? Number(e.target.value) : null,
              }))
            }
          />
          <p className="mt-1 text-[11px] text-muted">
            Target nightly budget used for room and hotel suggestions.
          </p>
        </div>

        {/* Preferred Check-in & Check-out Times */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="pref-ci" className="label">
              Preferred check-in
            </label>
            <input
              id="pref-ci"
              type="time"
              className="input"
              value={prefs.checkinTime ?? "13:00"}
              onChange={(e) =>
                setPrefs((p) => ({
                  ...p,
                  checkinTime: e.target.value || null,
                }))
              }
            />
            <p className="mt-1 text-[10px] text-muted">
              {formatTime12(prefs.checkinTime ?? "13:00")}
            </p>
          </div>
          <div>
            <label htmlFor="pref-co" className="label">
              Preferred check-out
            </label>
            <input
              id="pref-co"
              type="time"
              className="input"
              value={prefs.checkoutTime ?? "11:00"}
              onChange={(e) =>
                setPrefs((p) => ({
                  ...p,
                  checkoutTime: e.target.value || null,
                }))
              }
            />
            <p className="mt-1 text-[10px] text-muted">
              {formatTime12(prefs.checkoutTime ?? "11:00")}
            </p>
          </div>
        </div>
      </div>

      {/* ── Allergies (comma-separated) ── */}
      <div>
        <label htmlFor="pref-allergies" className="label">
          Allergies (comma-separated)
        </label>
        <input
          id="pref-allergies"
          className="input"
          placeholder="peanuts, shellfish, gluten, dairy"
          value={allergiesText}
          onChange={(e) => setAllergiesText(e.target.value)}
        />
        <p className="mt-1 text-[11px] text-muted">
          Allergies are normalized and cross-referenced against all kitchen menus and ingredients.
        </p>
      </div>

      {/* ── Action Buttons ── */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          className="btn-primary"
          onClick={save}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save preferences"}
        </button>

        {confirmDelete ? (
          <div
            role="alertdialog"
            aria-label="Confirm profile deletion"
            className="flex flex-wrap items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-xs"
          >
            <span className="text-red-400 font-medium">
              Wipe all saved dietary, room & activity preferences?
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                className="rounded-lg bg-red-600 px-3 py-1 font-bold text-white hover:bg-red-700 transition-colors"
                onClick={wipe}
              >
                Yes, delete everything
              </button>
              <button
                type="button"
                className="text-muted hover:text-foreground underline px-1 transition-colors"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="cursor-pointer text-xs underline text-muted hover:text-red-400 transition-colors"
            onClick={() => setConfirmDelete(true)}
          >
            Delete my preference profile
          </button>
        )}
      </div>

      {/* ── Accessible Live Feedback Status ── */}
      <p
        role="status"
        aria-live="polite"
        className={`min-h-5 text-xs font-medium transition-opacity ${
          toastType === "error"
            ? "text-red-400"
            : "text-emerald-500"
        }`}
      >
        {toast ?? ""}
      </p>
    </div>
  );
}

function ChipGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const isSelected = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggle(o)}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                isSelected
                  ? "bg-accent text-on-accent border-transparent shadow-sm scale-[1.02]"
                  : "border-line text-foreground hover:bg-raised"
              }`}
            >
              {o.replace("-", " ")}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
