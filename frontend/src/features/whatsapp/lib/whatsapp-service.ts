export interface WhatsAppSession {
  id: string;
  state: string;
  ready: boolean;
}

const API_KEY = process.env.API_KEY || '';
const ENGINE_URL = process.env.WHATSAPP_ENGINE_URL || 'http://localhost:3000';

async function fetchEngine(path: string, options: RequestInit = {}) {
  const response = await fetch(`${ENGINE_URL}${path}`, {
    ...options,
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function getSessions(): Promise<WhatsAppSession[]> {
  try {
    const data = await fetchEngine('/session/getSessions');
    const sessionIds = data.result || [];

    const sessions = await Promise.all(
      sessionIds.map(async (id: string) => {
        try {
          const status = await getSessionStatus(id);
          return {
            id,
            state: status.state || 'INITIALIZING',
            ready: status.success || false,
          };
        } catch (err) {
          return {
            id,
            state: 'DISCONNECTED',
            ready: false,
          };
        }
      })
    );

    return sessions;
  } catch (error) {
    console.error('Failed to fetch sessions:', error);
    return [];
  }
}

export async function startSession(sessionId: string) {
  return await fetchEngine(`/session/start/${sessionId}`);
}

export async function stopSession(sessionId: string) {
  return await fetchEngine(`/session/stop/${sessionId}`);
}

export async function terminateSession(sessionId: string) {
  return await fetchEngine(`/session/terminate/${sessionId}`);
}

export async function getSessionStatus(sessionId: string) {
  return await fetchEngine(`/session/status/${sessionId}`);
}

export async function requestPairingCode(sessionId: string, phoneNumber: string) {
  const response = await fetchEngine(`/session/requestPairingCode/${sessionId}`, {
    method: 'POST',
    body: JSON.stringify({ phoneNumber, showNotification: true }),
  });
  return { code: response.result };
}

export function getQrImageUrl(sessionId: string) {
  return `/api/whatsapp/qr/${sessionId}?cache=${Date.now()}`;
}

export async function getChats(sessionId: string): Promise<any[]> {
  const data = await fetchEngine(`/client/getChats/${sessionId}`);
  return data.chats || [];
}

export async function fetchMessages(sessionId: string, chatId: string, limit = 20): Promise<any[]> {
  const data = await fetchEngine(`/chat/fetchMessages/${sessionId}`, {
    method: 'POST',
    body: JSON.stringify({ chatId, searchOptions: { limit } }),
  });
  return data.messages || [];
}

export async function sendMessage(sessionId: string, chatId: string, text: string) {
  return await fetchEngine(`/client/sendMessage/${sessionId}`, {
    method: 'POST',
    body: JSON.stringify({
      chatId,
      contentType: 'string',
      content: text,
    }),
  });
}

