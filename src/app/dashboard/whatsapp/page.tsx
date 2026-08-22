import { getSession } from "@/features/auth/lib/auth-utils";
import { db } from "@/shared/database";
import { whatsappSessions } from "@/shared/database/schema";
import { eq } from "drizzle-orm";
import { getSessions } from "@/features/whatsapp/lib/whatsapp-service";
import { getWhatsAppEngine } from "@/features/whatsapp/lib/engine";
import WhatsAppSessionsManager from "@/features/whatsapp/components/sessions-manager";
import { redirect } from "next/navigation";

export default async function WhatsAppPage() {
  const userSession = await getSession();
  if (!userSession) redirect("/login");

  const engine = getWhatsAppEngine();
  const activeEngineName = engine.name;

  const orgSessions = await db
    .select()
    .from(whatsappSessions)
    .where(eq(whatsappSessions.organizationId, userSession.organizationId as string));
  const engineSessions = await getSessions();

  const initialSessions = orgSessions.map((s) => {
    const es = engineSessions.find((e) => e.id === s.sessionId);
    return {
      ...s,
      state: es?.state || "DISCONNECTED",
      ready: es?.ready || false,
    };
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 sm:pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            WhatsApp Sessions
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your connected WhatsApp accounts, QR authentication, and pairing codes.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Engine:</span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
            {activeEngineName.toUpperCase()} API Gateway
          </span>
        </div>
      </div>

      <WhatsAppSessionsManager
        initialSessions={initialSessions}
        organizationId={userSession.organizationId as string}
        activeEngine={activeEngineName}
      />
    </div>
  );
}
