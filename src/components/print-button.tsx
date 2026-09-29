"use client";

export function PrintButton({ label = "Print voucher" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secondary !py-2.5">
      {label}
    </button>
  );
}
