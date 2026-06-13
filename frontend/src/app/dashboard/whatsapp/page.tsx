import { getSession } from "@/features/auth/lib/auth-utils";
import { db } from "@/shared/database";
import { whatsappSessions } from "@/shared/database/schema";
import { eq } from "drizzle-orm";
import { getSessions } from "@/features/whatsapp/lib/whatsapp-service";
import WhatsAppSessionsManager from "@/features/whatsapp/components/sessions-manager";
import { redirect } from "next/navigation";

export default async function WhatsAppPage() {
  const userSession = await getSession();
  if (!userSession) redirect("/login");

  const orgSessions = await db.select().from(whatsappSessions).where(eq(whatsappSessions.organizationId, userSession.organizationId as string));
  const engineSessions = await getSessions();

  const initialSessions = orgSessions.map(s => {
    const es = engineSessions.find(e => e.id === s.sessionId);
    return {
      ...s,
      state: es?.state || 'DISCONNECTED',
      ready: es?.ready || false,
    };
  });

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">WhatsApp Sessions</h1>
      </div>

      <WhatsAppSessionsManager 
        initialSessions={initialSessions} 
        organizationId={userSession.organizationId as string} 
      />
    </div>
  );
}
