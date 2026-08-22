import { getWhatsAppEngine, WhatsAppSession } from './engine';

export type { WhatsAppSession };

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

export async function sendStateTyping(sessionId: string, chatId: string) {
  const engine = getWhatsAppEngine();
  return await engine.sendStateTyping(sessionId, chatId);
}

export async function clearState(sessionId: string, chatId: string) {
  const engine = getWhatsAppEngine();
  return await engine.clearState(sessionId, chatId);
}
