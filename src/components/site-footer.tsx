export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="container-x flex flex-col items-center justify-between gap-4 py-10 sm:flex-row">
        <p className="font-display text-sm tracking-[0.14em] uppercase opacity-70">
          Aurelia · See your room before you stay
        </p>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Demo experience — payments are simulated. © {new Date().getFullYear()} Aurelia
        </p>
      </div>
    </footer>
  );
}
