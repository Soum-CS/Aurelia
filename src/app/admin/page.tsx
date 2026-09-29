import type { Metadata } from "next";
import { AdminDashboard } from "@/components/stay/admin-dashboard";

export const metadata: Metadata = { title: "Hotel operations" };
export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <div className="container-x pt-10 pb-4">
      <p className="eyebrow">Hotel operations</p>
      <h1 className="font-display mt-2 mb-6 text-3xl font-semibold sm:text-4xl">
        Staff dashboard
      </h1>
      <AdminDashboard />
    </div>
  );
}
