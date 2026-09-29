"use client";

/** Reloads the page so server components re-attempt the live provider connection. */
export function RetryConnectionButton() {
  return (
    <button
      type="button"
      className="btn-primary"
      onClick={() => {
        // flip the flag back so the next render re-runs provider resolution
        const url = new URL(window.location.href);
        url.searchParams.set("retry", String(Date.now()));
        window.location.replace(url.toString());
      }}
    >
      ⟳ Retry connection
    </button>
  );
}
