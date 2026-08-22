'use server';

import { db } from '@/shared/database';
import { whatsappSessions, contacts, activities } from '@/shared/database/schema';
import { getSession } from '@/features/auth/lib/auth-utils';
import { 
  startSession as engineStartSession, 
  stopSession as engineStopSession,
  terminateSession as engineTerminateSession,
  logoutSession as engineLogoutSession,
  forceKillSession as engineForceKillSession,
  getSessionConfig as engineGetSessionConfig,
  updateSessionConfig as engineUpdateSessionConfig,
  requestPairingCode as engineRequestPairingCode,
  getSessions as engineGetSessions,
  getChats as engineGetChats,
  fetchMessages as engineFetchMessages,
  sendMessage as engineSendMessage,
  sendMediaMessage as engineSendMediaMessage
} from '../lib/whatsapp-service';
import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';

export async function getWhatsAppSessionsData() {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');

  try {
    const orgSessions = await db.select().from(whatsappSessions).where(eq(whatsappSessions.organizationId, userSession.organizationId as string));
    const engineSessions = await engineGetSessions();

    const sessions = orgSessions.map(s => {
      const es = engineSessions.find((e: any) => e.id === s.sessionId || e.uuid === s.sessionId || e.name === s.sessionId);
      return {
        ...s,
        state: es?.state || 'DISCONNECTED',
        status: es?.status || 'disconnected',
        ready: es?.ready || false,
        phone: es?.phone || null,
        pushName: es?.pushName || null,
        connectedAt: es?.connectedAt || null,
        lastActive: es?.lastActive || null,
        lastError: es?.lastError || null,
        restriction: es?.restriction || null,
        engineLoaded: Boolean(es?.engineLoaded),
      };
    });

    return { success: true, sessions };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createWhatsAppSession(sessionId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');

  if (!sessionId) throw new Error('Session ID is required');

  try {
    const [existing] = await db.select().from(whatsappSessions).where(
      and(
        eq(whatsappSessions.sessionId, sessionId),
        eq(whatsappSessions.organizationId, userSession.organizationId as string)
      )
    ).limit(1);

    if (!existing) {
      await db.insert(whatsappSessions).values({
        organizationId: userSession.organizationId as string,
        sessionId,
        status: 'DISCONNECTED',
      });
    }

    revalidatePath('/dashboard/whatsapp');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function startWhatsAppSession(sessionId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');

  try {
    await engineStartSession(sessionId);
    revalidatePath('/dashboard/whatsapp');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function stopWhatsAppSession(sessionId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');

  try {
    await engineStopSession(sessionId);
    revalidatePath('/dashboard/whatsapp');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function logoutWhatsAppSession(sessionId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');

  try {
    await engineLogoutSession(sessionId);
    revalidatePath('/dashboard/whatsapp');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function forceKillWhatsAppSession(sessionId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');

  try {
    await engineForceKillSession(sessionId);
    revalidatePath('/dashboard/whatsapp');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function getWhatsAppSessionConfig(sessionId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');

  try {
    const config = await engineGetSessionConfig(sessionId);
    return { success: true, config };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateWhatsAppSessionConfig(sessionId: string, config: { autoRejectCalls?: boolean }) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');

  try {
    const updated = await engineUpdateSessionConfig(sessionId, config);
    return { success: true, config: updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getPairingCode(sessionId: string, phoneNumber: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');

  try {
    const response = await engineRequestPairingCode(sessionId, phoneNumber);
    return { success: true, code: response.code };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteWhatsAppSession(sessionId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');

  try {
    try { await engineTerminateSession(sessionId); } catch (e) {}
    
    await db.delete(whatsappSessions).where(
      and(
        eq(whatsappSessions.sessionId, sessionId),
        eq(whatsappSessions.organizationId, userSession.organizationId as string)
      )
    );
    revalidatePath('/dashboard/whatsapp');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function getWhatsAppChats(sessionId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const chats = await engineGetChats(sessionId);
    
    if (chats && chats.length > 0) {
      await db.transaction(async (tx) => {
        for (const chat of chats) {
          const whatsappId = chat.id._serialized;
          const [existingContact] = await tx.select().from(contacts).where(
            and(
              eq(contacts.whatsappId, whatsappId),
              eq(contacts.organizationId, orgId)
            )
          ).limit(1);

          if (!existingContact) {
            await tx.insert(contacts).values({
              organizationId: orgId,
              whatsappId,
              name: chat.name || null,
              pushName: chat.name || null,
              isGroup: chat.isGroup || false,
            });
          } else if (existingContact.name !== chat.name) {
            await tx.update(contacts)
              .set({ name: chat.name, pushName: chat.name, updatedAt: new Date() })
              .where(eq(contacts.id, existingContact.id));
          }
        }
      });
    }

    return { success: true, chats };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getWhatsAppMessages(sessionId: string, chatId: string, limit = 40) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');

  try {
    const messages = await engineFetchMessages(sessionId, chatId, limit);
    return { success: true, messages };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function sendWhatsAppMessage(sessionId: string, chatId: string, text: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const response = await engineSendMessage(sessionId, chatId, text);

    const [contact] = await db.select().from(contacts).where(
      and(
        eq(contacts.whatsappId, chatId),
        eq(contacts.organizationId, orgId)
      )
    ).limit(1);

    if (contact) {
      await db.update(contacts)
        .set({ aiEnabled: false, updatedAt: new Date() })
        .where(eq(contacts.id, contact.id));

      await db.insert(activities).values({
        organizationId: orgId,
        contactId: contact.id,
        type: 'MESSAGE_SENT',
        description: `Outgoing message sent: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`,
        userId: userSession.userId as string,
      });
    }

    return { success: true, result: response.result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function sendWhatsAppMediaMessage(sessionId: string, chatId: string, mediaUrl: string, caption?: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const response = await engineSendMediaMessage(sessionId, chatId, mediaUrl, caption);

    const [contact] = await db.select().from(contacts).where(
      and(
        eq(contacts.whatsappId, chatId),
        eq(contacts.organizationId, orgId)
      )
    ).limit(1);

    if (contact) {
      await db.update(contacts)
        .set({ aiEnabled: false, updatedAt: new Date() })
        .where(eq(contacts.id, contact.id));
    }

    return { success: true, result: response.result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
