"use client";

import { useState } from "react";
import Link from "next/link";
import { performLogout } from "@/lib/auth-client";

interface Props {
  user: {
    id: string;
    email: string;
    displayName: string;
  } | null;
}

export function ProfileAccountSection({ user }: Props) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await performLogout("/");
  }

  if (user) {
    return (
      <div className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {user.displayName}
              </span>
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent uppercase">
                Member
              </span>
            </div>
            <p className="text-xs text-muted">{user.email}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="btn-secondary !py-1.5 !px-3.5 text-xs font-semibold self-start sm:self-auto"
        >
          {loggingOut ? "Signing out…" : "Log Out"}
        </button>
      </div>
    );
  }

  return (
    <div className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Sign In to Your Aurelia Account
        </h3>
        <p className="mt-0.5 text-xs text-muted">
          Sign in to sync your preferences, luxury bookings, and concierge history.
        </p>
      </div>
      <Link
        href="/login?redirect=/profile"
        className="btn-primary !py-1.5 !px-4 text-xs font-semibold self-start sm:self-auto"
      >
        Sign In
      </Link>
    </div>
  );
}
