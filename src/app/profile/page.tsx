import type { Metadata } from "next";
import { PreferencesForm } from "@/components/stay/preferences-form";
import { ProfileAccountSection } from "@/components/stay/profile-account-section";
import { getAuthenticatedUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Profile & preferences" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getAuthenticatedUser();

  return (
    <div className="container-x max-w-3xl pt-10 pb-4">
      <p className="eyebrow">Profile</p>
      <h1 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">
        Your Aurelia preference profile
      </h1>
      <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
        These preferences personalise the concierge, food recommendations, room suggestions and
        itineraries. They stay on your device&apos;s guest session — never sold, never shared —
        and you can wipe them entirely at any time.
      </p>
      <div className="mt-6">
        <ProfileAccountSection user={user} />
      </div>
      <div className="card p-5 sm:p-6">
        <PreferencesForm />
      </div>
    </div>
  );
}
