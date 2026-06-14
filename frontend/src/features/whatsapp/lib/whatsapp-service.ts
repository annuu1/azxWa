export interface WhatsAppSession {
  id: string;
  state: string;
  ready: boolean;
}

async function fetchEngine(path: string, options: RequestInit = {}) {
  const apiKey = process.env.API_KEY || '';
  const engineUrl = process.env.WHATSAPP_ENGINE_URL || 'http://localhost:3000';

  const response = await fetch(`${engineUrl}${path}`, {
    ...options,
    headers: {
      'x-api-key': apiKey,
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

export async function sendStateTyping(sessionId: string, chatId: string) {
  return await fetchEngine(`/chat/sendStateTyping/${sessionId}`, {
    method: 'POST',
    body: JSON.stringify({ chatId }),
  });
}

export async function clearState(sessionId: string, chatId: string) {
  return await fetchEngine(`/chat/clearState/${sessionId}`, {
    method: 'POST',
    body: JSON.stringify({ chatId }),
  });
}

export async function sendMediaMessage(sessionId: string, chatId: string, mediaUrl: string, caption?: string) {
  try {
    const response = await fetch(mediaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download media file. Status: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      throw new Error(`The link provided is a web page or API response, not a direct media file link (Content-Type: ${contentType}). Please provide a direct link ending with .jpg, .png, .mp4, etc.`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    
    // Determine filename
    const urlParts = mediaUrl.split('/');
    let filename = urlParts[urlParts.length - 1]?.split('?')[0] || 'file';
    if (!filename.includes('.')) {
      const ext = contentType.split('/')[1]?.split('+')[0] || 'bin';
      filename = `${filename}.${ext}`;
    }

    return await fetchEngine(`/client/sendMessage/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify({
        chatId,
        contentType: 'MessageMedia',
        content: {
          mimetype: contentType || 'image/jpeg',
          data: base64Data,
          filename: filename,
        },
        options: caption ? { caption } : {},
      }),
    });
  } catch (err: any) {
    console.error('Error in sendMediaMessage:', err);
    throw new Error(`Media sending failed: ${err.message}`);
  }
}

