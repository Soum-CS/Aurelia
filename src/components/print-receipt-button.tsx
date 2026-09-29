"use client";

/** Triggers the browser print dialog; the page's print CSS shows only the receipt. */
export function PrintReceiptButton() {
  return (
    <button type="button" className="btn-secondary" onClick={() => window.print()}>
      🖨 Print receipt
    </button>
  );
}
