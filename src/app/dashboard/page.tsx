import { getSession } from "@/features/auth/lib/auth-utils";
import { redirect } from "next/navigation";
import { getDashboardMetrics } from "@/features/analytics/actions/analytics-actions";
import { DashboardOverview } from "@/features/analytics/components/dashboard-overview";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const metrics = await getDashboardMetrics();

  if (!metrics) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500 mt-2">Failed to load organization metrics. Please refresh or verify your account.</p>
      </div>
    );
  }

  return <DashboardOverview metrics={metrics} />;
}
