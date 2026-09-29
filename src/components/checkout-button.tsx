"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CheckoutButton({ bookingCode }: { bookingCode: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingCode}/checkout`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Checkout failed — try once more.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network hiccup — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={checkout} disabled={busy} className="btn-primary w-full sm:w-auto">
        {busy ? (
          <>
            <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Settling folio…
          </>
        ) : (
          "Check out now"
        )}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium" style={{ color: "#b03a2e" }}>
          {error}
        </p>
      )}
    </div>
  );
}
