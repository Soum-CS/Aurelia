"use client";

import { useEffect, useState } from "react";
import { LOYALTY_TIERS, LoyaltyTier } from "@/lib/loyalty";

interface LoyaltyBadgeProps {
  guestEmail: string;
}

export function LoyaltyBadge({ guestEmail }: LoyaltyBadgeProps) {
  const [account, setAccount] = useState<{
    tier: LoyaltyTier;
    tierLabel: string;
    points: number;
    lifetimePoints: number;
    perks: string[];
  } | null>(null);

  useEffect(() => {
    if (!guestEmail) return;
    fetch(`/api/loyalty?email=${encodeURIComponent(guestEmail)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.tier) setAccount(d);
      })
      .catch(() => {});
  }, [guestEmail]);

  if (!account) return null;

  const tier = account.tier;
  const nextTier: LoyaltyTier | null =
    tier === "EXPLORER" ? "VOYAGER" : tier === "VOYAGER" ? "ELITE" : tier === "ELITE" ? "SIGNATURE" : null;
  const nextMin = nextTier ? LOYALTY_TIERS[nextTier].minPoints : 40000;
  const progressPct = Math.min(100, Math.round((account.lifetimePoints / nextMin) * 100));

  const tierColors: Record<LoyaltyTier, { badge: string; bg: string }> = {
    EXPLORER: { badge: "border-stone-400 bg-stone-500/10 text-stone-700 dark:text-stone-300", bg: "from-stone-500/20" },
    VOYAGER: { badge: "border-blue-400 bg-blue-500/10 text-blue-700 dark:text-blue-300", bg: "from-blue-500/20" },
    ELITE: { badge: "border-amber-400 bg-amber-500/10 text-amber-700 dark:text-amber-300", bg: "from-amber-500/20" },
    SIGNATURE: { badge: "border-purple-400 bg-purple-500/10 text-purple-700 dark:text-purple-300", bg: "from-purple-500/20" },
  };

  const style = tierColors[tier] || tierColors.EXPLORER;

  return (
    <div className="card overflow-hidden p-5 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${style.badge}`}>
            ⚜️ {account.tierLabel}
          </span>
          <h4 className="font-display mt-2 text-xl font-bold text-foreground">
            {account.points.toLocaleString("en-IN")}{" "}
            <span className="text-xs font-normal text-muted">Aurelia Points</span>
          </h4>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase tracking-wider text-muted">Folio Credit Value</span>
          <p className="font-semibold text-accent">
            ₹{Math.round(account.points / 10).toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {nextTier && (
        <div className="mt-4">
          <div className="flex justify-between text-[11px] text-muted">
            <span>Progress to {LOYALTY_TIERS[nextTier].label}</span>
            <span>{account.lifetimePoints} / {nextMin} pts</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Active Member Perks */}
      <div className="mt-4 border-t border-line pt-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          Your Member Privileges
        </span>
        <ul className="mt-1.5 space-y-1 text-xs text-foreground">
          {account.perks.map((perk, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="text-accent">✓</span>
              <span>{perk}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
