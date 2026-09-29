import Link from "next/link";
import { providerStatus } from "@/lib/hotel-provider";
import { RetryConnectionButton } from "./retry-connection-button";

/**
 * Shown wherever real hotel inventory would appear but no live provider is
 * configured. Aurelia deliberately has NO demo/sample hotel fallback — per
 * product policy the app states exactly what is missing instead.
 */
export function LiveConnectionRequired() {
  const status = providerStatus();

  return (
    <section className="container-x mt-10 pb-4" aria-live="polite">
      <div
        className="card mx-auto max-w-2xl p-8 text-center sm:p-12"
        style={{ borderColor: "var(--gold)" }}
      >
        <span
          aria-hidden
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--gold) 18%, transparent)", color: "var(--accent-strong)" }}
        >
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
        </span>
        <h2 className="font-display mt-5 text-2xl font-semibold sm:text-3xl">
          Live hotel data connection required
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          Aurelia displays only real hotel inventory, availability and prices
          when a live hotel provider is configured. No hotel provider is
          configured on this deployment yet — so there is nothing to display
          here, and no sample data is being shown.
        </p>

        <div className="mt-6 rounded-2xl border p-5 text-left" style={{ borderColor: "var(--line)", background: "var(--background)" }}>
          <p className="label">Required server environment (.env.local)</p>
          <ul className="mt-1 space-y-1.5 font-mono text-xs">
            {status.requires.map((r) => (
              <li key={r.env}>
                <span style={{ color: "var(--accent)" }}>{r.env}</span>
                <span style={{ color: "var(--muted)" }}>={r.value}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
            Create a free account at developers.amadeus.com, generate an API key
            and secret, then restart the server. Other authorized providers
            (Expedia Rapid, Booking.com Demand API) require a signed partner
            agreement — see README → “Connecting live hotel data”.
          </p>
        </div>

        <div className="no-print mt-7 flex flex-wrap justify-center gap-3">
          <RetryConnectionButton />
          <Link href="/" className="btn-secondary">
            Back to search
          </Link>
        </div>
      </div>
    </section>
  );
}
