import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { NotificationsBell } from "./notifications-bell";
import { getUserToken, findUserByToken } from "@/lib/user";
import { db } from "@/lib/db";

/**
 * Contextual main navigation (spec §28). FOOD / EXPERIENCES / WALLET link
 * straight into the guest's active stay when one exists; otherwise they fall
 * back to the concierge explainer which routes guests to a stay.
 */
export async function SiteHeader() {
  const token = await getUserToken();
  const user = await findUserByToken(token);
  const activeStay = user
    ? (await db.booking.findFirst({
        where: { userId: user.id, status: "CHECKED_IN" },
        orderBy: { checkIn: "asc" },
      })) ??
      (await db.booking.findFirst({
        where: { userId: user.id, status: "CONFIRMED" },
        orderBy: { checkIn: "asc" },
      }))
    : null;

  const foodHref = activeStay ? `/trips/${activeStay.code}/stay/food` : "/concierge";
  const expHref = activeStay ? `/trips/${activeStay.code}/stay/experiences` : "/concierge";
  const walletHref = activeStay ? `/trips/${activeStay.code}/stay/wallet` : "/trips";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/85 backdrop-blur-md">
      <div className="container-x flex h-16 items-center justify-between gap-2">
        <Link
          href="/"
          className="focus-visible:outline-accent group flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <span
            aria-hidden
            className="bg-accent text-on-accent flex h-8 w-8 items-center justify-center rounded-full font-display text-sm font-semibold transition-transform duration-300 group-hover:rotate-12"
          >
            A
          </span>
          <span className="font-display text-xl font-semibold tracking-[0.08em] uppercase">
            Aurelia
          </span>
        </Link>

        <nav aria-label="Main" className="flex items-center gap-0.5 sm:gap-1">
          <HeaderLink href="/">Home</HeaderLink>
          <HeaderLink href="/#stays" className="hidden md:block">Explore</HeaderLink>
          <HeaderLink href="/#stays" className="hidden xl:block">Hotels</HeaderLink>
          <HeaderLink href={activeStay ? `/trips/${activeStay.code}` : "/trips"} className="hidden sm:block">
            My Stay{activeStay ? " ●" : ""}
          </HeaderLink>
          <HeaderLink href={foodHref} className="hidden lg:block">Food</HeaderLink>
          <HeaderLink href={expHref} className="hidden xl:block">Experiences</HeaderLink>
          <HeaderLink href="/concierge" className="hidden md:block">AI Concierge</HeaderLink>
          <HeaderLink href={walletHref} className="hidden xl:block">Wallet</HeaderLink>
          <HeaderLink href="/trips" className="hidden lg:block">Bookings</HeaderLink>
          <HeaderLink href="/profile" className="hidden sm:block">Profile</HeaderLink>

          <NotificationsBell />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

function HeaderLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`focus-visible:outline-accent rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:bg-raised focus-visible:outline-2 ${className}`}
    >
      {children}
    </Link>
  );
}
