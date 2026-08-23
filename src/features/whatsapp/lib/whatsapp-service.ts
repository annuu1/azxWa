import { getWhatsAppEngine, WhatsAppSession, SessionConfig } from './engine';

export type { WhatsAppSession, SessionConfig };

export async function getSessions(): Promise<WhatsAppSession[]> {
  const engine = getWhatsAppEngine();
  return await engine.getSessions();
}

export async function startSession(sessionId: string) {
  const engine = getWhatsAppEngine();
  return await engine.startSession(sessionId);
}

export async function stopSession(sessionId: string) {
  const engine = getWhatsAppEngine();
  return await engine.stopSession(sessionId);
}

export async function logoutSession(sessionId: string) {
  const engine = getWhatsAppEngine();
  if (engine.logoutSession) {
    return await engine.logoutSession(sessionId);
  }
  return await engine.terminateSession(sessionId);
}

export async function forceKillSession(sessionId: string) {
  const engine = getWhatsAppEngine();
  if (engine.forceKillSession) {
    return await engine.forceKillSession(sessionId);
  }
  return await engine.stopSession(sessionId);
}

export async function getSessionConfig(sessionId: string): Promise<SessionConfig | null> {
  const engine = getWhatsAppEngine();
  if (engine.getSessionConfig) {
    return await engine.getSessionConfig(sessionId);
  }
  return null;
}

export async function updateSessionConfig(sessionId: string, config: Partial<SessionConfig>): Promise<SessionConfig | null> {
  const engine = getWhatsAppEngine();
  if (engine.updateSessionConfig) {
    return await engine.updateSessionConfig(sessionId, config);
  }
  return null;
}

export async function terminateSession(sessionId: string) {
  const engine = getWhatsAppEngine();
  return await engine.terminateSession(sessionId);
}

export async function getSessionStatus(sessionId: string) {
  const engine = getWhatsAppEngine();
  return await engine.getSessionStatus(sessionId);
}

export async function requestPairingCode(sessionId: string, phoneNumber: string) {
  const engine = getWhatsAppEngine();
  return await engine.requestPairingCode(sessionId, phoneNumber);
}

export function getQrImageUrl(sessionId: string) {
  return `/api/whatsapp/qr/${sessionId}?cache=${Date.now()}`;
}

export async function getChats(sessionId: string): Promise<any[]> {
  const engine = getWhatsAppEngine();
  return await engine.getChats(sessionId);
}

export async function fetchMessages(sessionId: string, chatId: string, limit = 20): Promise<any[]> {
  const engine = getWhatsAppEngine();
  return await engine.fetchMessages(sessionId, chatId, limit);
}

export async function sendMessage(sessionId: string, chatId: string, text: string) {
  const engine = getWhatsAppEngine();
  return await engine.sendMessage(sessionId, chatId, text);
}

export async function sendMediaMessage(sessionId: string, chatId: string, mediaUrl: string, caption?: string) {
  const engine = getWhatsAppEngine();
  return await engine.sendMediaMessage(sessionId, chatId, mediaUrl, caption);
}

export async function sendMedia(
  sessionId: string,
  chatId: string,
  mediaType: 'image' | 'video' | 'audio' | 'document' | 'sticker',
  payload: { base64?: string; url?: string; mimetype: string; filename?: string; caption?: string; quotedMessageId?: string }
) {
  const engine = getWhatsAppEngine();
  if (engine.sendMedia) {
    return await engine.sendMedia(sessionId, chatId, mediaType, payload);
  }
  return await engine.sendMediaMessage(sessionId, chatId, payload.url || (payload.base64 ? `data:${payload.mimetype};base64,${payload.base64}` : ''), payload.caption);
}

export async function reactMessage(sessionId: string, chatId: string, messageId: string, emoji: string) {
  const engine = getWhatsAppEngine();
  if (engine.reactMessage) {
    return await engine.reactMessage(sessionId, chatId, messageId, emoji);
  }
  return { success: false, error: 'Reactions not supported on this engine' };
}

export async function deleteMessage(sessionId: string, chatId: string, messageId: string, forEveryone = true) {
  const engine = getWhatsAppEngine();
  if (engine.deleteMessage) {
    return await engine.deleteMessage(sessionId, chatId, messageId, forEveryone);
  }
  return { success: false, error: 'Message deletion not supported on this engine' };
}

export async function replyMessage(sessionId: string, chatId: string, quotedMessageId: string, text: string) {
  const engine = getWhatsAppEngine();
  if (engine.replyMessage) {
    return await engine.replyMessage(sessionId, chatId, quotedMessageId, text);
  }
  return await engine.sendMessage(sessionId, chatId, text);
}

export async function getProfilePicture(sessionId: string, contactId: string): Promise<string | null> {
  const engine = getWhatsAppEngine();
  if (engine.getProfilePicture) {
    return await engine.getProfilePicture(sessionId, contactId);
  }
  return null;
}

export async function sendStateTyping(sessionId: string, chatId: string) {
  const engine = getWhatsAppEngine();
  return await engine.sendStateTyping(sessionId, chatId);
}

export async function clearState(sessionId: string, chatId: string) {
  const engine = getWhatsAppEngine();
  return await engine.clearState(sessionId, chatId);
}
