import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-x flex flex-col items-center py-28 text-center">
      <p className="eyebrow">404</p>
      <h1 className="font-display mt-3 text-4xl font-semibold">
        This door doesn&apos;t open
      </h1>
      <p className="mt-3 max-w-md text-sm" style={{ color: "var(--muted)" }}>
        The page or stay you&apos;re looking for has checked out. Head back to
        the lobby to find your next room.
      </p>
      <Link href="/" className="btn-primary mt-8">
        Back to the lobby
      </Link>
    </div>
  );
}
