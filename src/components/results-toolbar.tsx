"use client";

import { useRouter, useSearchParams } from "next/navigation";

const SORTS = [
  ["recommended", "Recommended"],
  ["price_asc", "Price · low to high"],
  ["price_desc", "Price · high to low"],
  ["rating", "Top rated"],
] as const;

/**
 * Sort / view / filter controls for the results header. Everything works by
 * rewriting the URL — the server pipeline (?sort=&minRating=&maxPrice=&view=)
 * stays the single source of truth.
 */
export function ResultsToolbar({ resultCount }: { resultCount: number }) {
  const router = useRouter();
  const sp = useSearchParams();

  function setParam(key: string, value?: string) {
    const params = new URLSearchParams(sp.toString());
    if (value && value !== "recommended") params.set(key, value);
    else params.delete(key);
    router.push(`/?${params.toString()}#stays`, { scroll: false });
  }

  const sort = sp.get("sort") ?? "recommended";
  const minRating = sp.get("minRating");
  const maxPrice = sp.get("maxPrice");
  const isList = sp.get("view") === "list";

  return (
    <div className="no-print flex flex-wrap items-center gap-2" role="group" aria-label="Sort and filter results">
      {/* sort */}
      <label className="sr-only" htmlFor="results-sort">
        Sort hotels
      </label>
      <select
        id="results-sort"
        className="input !w-auto !rounded-full !px-4 !py-2 text-xs font-semibold"
        value={sort}
        onChange={(e) => setParam("sort", e.target.value)}
      >
        {SORTS.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>

      {/* quick filters */}
      <button
        type="button"
        className="chip"
        aria-pressed={minRating === "4.5"}
        onClick={() => setParam("minRating", minRating === "4.5" ? undefined : "4.5")}
      >
        ★ 4.5+
      </button>
      <button
        type="button"
        className="chip"
        aria-pressed={minRating === "4"}
        onClick={() => setParam("minRating", minRating === "4" ? undefined : "4")}
      >
        ★ 4.0+
      </button>
      <button
        type="button"
        className="chip"
        aria-pressed={maxPrice === "5000"}
        onClick={() => setParam("maxPrice", maxPrice === "5000" ? undefined : "5000")}
      >
        Under ₹5,000
      </button>
      {(minRating || maxPrice || sort !== "recommended") && (
        <button
          type="button"
          className="cursor-pointer text-xs underline underline-offset-2"
          style={{ color: "var(--muted)" }}
          onClick={() =>
            router.push(`/?${(() => {
              const p = new URLSearchParams(sp.toString());
              for (const k of ["sort", "minRating", "maxPrice"]) p.delete(k);
              return p.toString();
            })()}#stays`, { scroll: false })
          }
        >
          Clear all
        </button>
      )}

      {/* grid / list */}
      <div className="ml-auto flex overflow-hidden rounded-full border border-line">
        <button
          type="button"
          aria-pressed={!isList}
          aria-label="Grid view"
          className={`cursor-pointer px-3 py-1.5 text-xs font-semibold ${!isList ? "" : ""}`}
          style={!isList ? { background: "var(--accent)", color: "var(--on-accent)" } : { color: "var(--muted)" }}
          onClick={() => setParam("view", undefined)}
        >
          ▦ Grid
        </button>
        <button
          type="button"
          aria-pressed={isList}
          aria-label="List view"
          className="cursor-pointer border-l border-line px-3 py-1.5 text-xs font-semibold"
          style={isList ? { background: "var(--accent)", color: "var(--on-accent)" } : { color: "var(--muted)" }}
          onClick={() => setParam("view", "list")}
        >
          ☰ List
        </button>
      </div>

      <span className="sr-only" role="status">
        {resultCount} properties found
      </span>
    </div>
  );
}
