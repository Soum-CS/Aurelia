"use client";

/**
 * Payment failure — per product policy this is explicit: no booking exists,
 * nothing was confirmed, and the guest can retry or go back.
 */
export function PaymentFailedCard({
  message,
  onRetry,
  onBack,
}: {
  message: string | null;
  onRetry?: () => void;
  onBack?: () => void;
}) {
  return (
    <div className="card mx-auto max-w-lg p-10 text-center sm:p-12" role="alert">
      <span
        aria-hidden
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
        style={{ background: "#c0392b14", color: "#b03a2e" }}
      >
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 8v5m0 3.5h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </span>
      <h1 className="font-display mt-5 text-2xl font-semibold sm:text-3xl">Payment failed</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
        Your payment could not be completed. No booking has been confirmed and
        you have not been charged for a stay.
      </p>
      {message && (
        <p className="mx-auto mt-3 max-w-sm rounded-xl border px-4 py-2.5 text-xs font-medium" style={{ borderColor: "#c0392b55", background: "#c0392b0d", color: "#b03a2e" }}>
          {message}
        </p>
      )}
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        {onRetry && (
          <button type="button" className="btn-primary" onClick={onRetry}>
            Try again
          </button>
        )}
        {onBack && (
          <button type="button" className="btn-secondary" onClick={onBack}>
            Back to booking
          </button>
        )}
      </div>
    </div>
  );
}
