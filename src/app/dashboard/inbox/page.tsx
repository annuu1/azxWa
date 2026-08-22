import { getSession } from "@/features/auth/lib/auth-utils";
import { db } from "@/shared/database";
import { whatsappSessions } from "@/shared/database/schema";
import { eq } from "drizzle-orm";
import UnifiedInbox from "@/features/whatsapp/components/inbox/unified-inbox";
import { redirect } from "next/navigation";

export default async function InboxPage() {
  const userSession = await getSession();
  if (!userSession) redirect("/login");

  const orgSessions = await db.select().from(whatsappSessions).where(eq(whatsappSessions.organizationId, userSession.organizationId as string));
  
  // For the prototype, we just use the first session found
  const activeSessionId = orgSessions[0]?.sessionId;

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Unified Inbox</h1>
      </div>

      {activeSessionId ? (
        <UnifiedInbox sessionId={activeSessionId} />
      ) : (
        <div className="text-center py-20 bg-white rounded-lg border border-dashed">
          <p className="text-gray-500 mb-4">No active WhatsApp sessions found.</p>
          <a href="/dashboard/whatsapp">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-md">Connect WhatsApp</button>
          </a>
        </div>
      )}
    </div>
  );
}
