import { getSession } from "@/features/auth/lib/auth-utils";
import CampaignsManager from "@/features/campaigns/components/campaigns-manager";
import { redirect } from "next/navigation";

export default async function CampaignsPage() {
  const userSession = await getSession();
  if (!userSession) redirect("/login");

  return (
    <div className="p-8">
      <CampaignsManager />
    </div>
  );
}
