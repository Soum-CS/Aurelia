"use client";

import { useState } from "react";

/**
 * EMAIL RECEIPT — Aurelia has no email infrastructure configured yet.
 * Per product policy we say exactly that instead of pretending to send.
 */
export function EmailReceiptButton() {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex flex-col items-center">
      <button type="button" className="btn-secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        ✉ Email receipt
      </button>
      {open && (
        <p role="status" className="animate-fade-up mt-2 max-w-xs rounded-xl border border-line bg-raised px-4 py-3 text-center text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          Email delivery is not configured yet. You can download or print your
          invoice below — both contain the same verified figures.
        </p>
      )}
    </span>
  );
}
