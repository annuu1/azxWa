import { getSession } from "@/features/auth/lib/auth-utils";
import CRMDashboard from "@/features/crm/components/crm-dashboard";
import { redirect } from "next/navigation";

export default async function CRMPage() {
  const userSession = await getSession();
  if (!userSession) redirect("/login");

  return (
    <div className="p-8">
      <CRMDashboard />
    </div>
  );
}
