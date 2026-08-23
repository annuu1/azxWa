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
  const sessionIds = orgSessions.map(s => s.sessionId);

  return (
    <div className="p-2 sm:p-4 lg:p-6 flex flex-col h-[calc(100dvh-57px)] md:h-screen overflow-hidden space-y-2 sm:space-y-4">
      <div className="flex justify-between items-center shrink-0 px-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Unified WhatsApp Inbox</h1>
          <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 hidden sm:block">
            Manage customer conversations and AI auto-replies across all connected sessions.
          </p>
        </div>
      </div>

      {sessionIds.length > 0 ? (
        <div className="flex-1 min-h-0">
          <UnifiedInbox availableSessions={sessionIds} />
        </div>
      ) : (
        <div className="text-center py-16 sm:py-20 bg-white rounded-xl border border-dashed border-gray-300 p-6 sm:p-8 shadow-xs">
          <p className="text-gray-500 mb-4 font-medium text-sm">No active WhatsApp sessions found for your organization.</p>
          <a href="/dashboard/whatsapp">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors">
              Connect WhatsApp Session
            </button>
          </a>
        </div>
      )}
    </div>
  );
}
