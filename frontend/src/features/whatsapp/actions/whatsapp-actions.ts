'use server';

import { db } from '@/shared/database';
import { whatsappSessions } from '@/shared/database/schema';
import { getSession } from '@/features/auth/lib/auth-utils';
import { 
  startSession as engineStartSession, 
  stopSession as engineStopSession,
  terminateSession as engineTerminateSession,
  requestPairingCode as engineRequestPairingCode,
  getSessions as engineGetSessions,
  getChats as engineGetChats,
  fetchMessages as engineFetchMessages,
  sendMessage as engineSendMessage
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
      const es = engineSessions.find((e: any) => e.id === s.sessionId);
      return {
        ...s,
        state: es?.state || 'DISCONNECTED',
        ready: es?.ready || false,
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
    await db.insert(whatsappSessions).values({
      organizationId: userSession.organizationId as string,
      sessionId,
      status: 'DISCONNECTED',
    });

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
    // Try to terminate/logout if running
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

  try {
    const chats = await engineGetChats(sessionId);
    return { success: true, chats };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getWhatsAppMessages(sessionId: string, chatId: string, limit = 20) {
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

  try {
    const response = await engineSendMessage(sessionId, chatId, text);
    return { success: true, result: response.result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
