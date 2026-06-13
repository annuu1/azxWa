import { getSession } from "@/features/auth/lib/auth-utils";
import { logout } from "@/features/auth/actions/auth-actions";
import { Button } from "@/shared/components/ui/button";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <form action={logout}>
          <Button type="submit">Logout</Button>
        </form>
      </div>
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-600">Welcome back!</p>
        <div className="mt-4 space-y-2">
          <p><strong>Organization ID:</strong> {session.organizationId as string}</p>
          <p><strong>User ID:</strong> {session.userId as string}</p>
          <p><strong>Role:</strong> {session.role as string}</p>
        </div>
      </div>
    </div>
  );
}
