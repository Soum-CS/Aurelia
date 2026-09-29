const PATHS: Record<string, string> = {
  pool: "M2 17c2.5 0 2.5 1.6 5 1.6s2.5-1.6 5-1.6 2.5 1.6 5 1.6 2.5-1.6 5-1.6M2 12c2.5 0 2.5 1.6 5 1.6s2.5-1.6 5-1.6 2.5 1.6 5 1.6 2.5-1.6 5-1.6M8 9V4a2 2 0 1 1 4 0M14 9V4a2 2 0 1 1 4 0",
  spa: "M12 21C7 18 3 14.5 3 10.2 3 7.3 5.2 5 8 5c1.6 0 3.1.8 4 2 .9-1.2 2.4-2 4-2 2.8 0 5 2.3 5 5.2 0 4.3-4 7.8-9 10.8ZM12 7v14M7 11c1.7-.8 3.3-.8 5 0 1.7-.8 3.3-.8 5 0",
  concierge:
    "M4 18h16M6 18a6 6 0 0 1 12 0M12 9V7m-2 0h4M10 21h4",
  wifi: "M2.5 9.5C8 4.5 16 4.5 21.5 9.5M5.5 13c4-3.5 9-3.5 13 0M8.5 16.5c2-1.8 5-1.8 7 0M12 20h.01",
  dining:
    "M7 3v8m-3-8v5a3 3 0 0 0 6 0V3M7 11v10m9-18c-2 2-2.5 4.5-2.5 7H16m0-7v18",
  bar: "M5 3h14l-6 8v7m-4 3h8M8 6h8",
  gym: "M6.5 6.5v11m11-11v11M3 9v6m18-6v6M6.5 12h11",
  car: "M5 16l1.5-5.5A2 2 0 0 1 8.4 9h7.2a2 2 0 0 1 1.9 1.5L19 16M5 16h14v3h-2m-10 0H5v-3Zm2 3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  bike: "M6.5 17.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm11 0a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM6.5 14 12 5l3 5.5M15 14l-3.5-4M18 10.5 15 14",
  fire: "M12 22c4 0 7-2.8 7-6.8 0-3.2-2-5.4-3.5-7.2C14 6.2 13 4.6 13 2c-3.5 2-5 5.5-5 8 0 0-2-1-2-3.5C4.6 8.6 5 10.5 5 12.5 5 19 8 22 12 22Z",
  parking: "M6 3h9a5 5 0 0 1 0 10h-5v8H6V3Zm4 4v4h4.5a2 2 0 0 0 0-4H10Z",
  music: "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  sunset: "M12 9a4 4 0 0 1 4 4M17.7 8.3l1.4-1.4M22 15h-2M4 15H2m4.3-6.7L4.9 6.9M8 19h8m-9 3h10M12 3v3m-7 9a7 7 0 0 1 14 0",
  steam: "M8 3c-1.5 2-1.5 4 0 6s1.5 4 0 6m4-18c-1.5 2-1.5 4 0 6s1.5 4 0 6m4-18c-1.5 2-1.5 4 0 6s1.5 4 0 6M4 19h16v3H4z",
};

export function AmenityIcon({ name, className }: { name: string; className?: string }) {
  const lower = name.toLowerCase();
  const key =
    Object.keys(PATHS).find((k) => lower.includes(k)) ??
    (lower.includes("wifi") || lower.includes("internet")
      ? "wifi"
      : lower.includes("ski") || lower.includes("boot")
        ? "steam"
        : "");
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {key && PATHS[key] ? (
        <path d={PATHS[key]} />
      ) : (
        <>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}
