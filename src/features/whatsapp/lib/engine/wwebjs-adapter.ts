import { IWhatsAppEngineAdapter, NormalizedWebhookEvent, WhatsAppSession } from './types';

export class WWebJSAdapter implements IWhatsAppEngineAdapter {
  name = 'wwebjs';

  private get baseUrl(): string {
    const url = process.env.WHATSAPP_ENGINE_URL || 'http://localhost:3000';
    return url.replace(/\/+$/, '');
  }

  private get apiKey(): string {
    return process.env.API_KEY || '';
  }

  private async fetchApi(path: string, options: RequestInit = {}) {
    const fullUrl = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers = {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const res = await fetch(fullUrl, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errBody.error || `WWebJS HTTP Error ${res.status}`);
    }

    return await res.json();
  }

  async getSessions(): Promise<WhatsAppSession[]> {
    try {
      const data = await this.fetchApi('/session/getSessions');
      const sessionIds = data.result || [];

      return await Promise.all(
        sessionIds.map(async (id: string) => {
          try {
            const status = await this.getSessionStatus(id);
            return {
              id,
              state: status.state || 'INITIALIZING',
              ready: status.success,
            };
          } catch {
            return { id, state: 'DISCONNECTED', ready: false };
          }
        })
      );
    } catch (err) {
      console.error('[WWebJSAdapter] getSessions error:', err);
      return [];
    }
  }

  async startSession(sessionId: string): Promise<any> {
    return await this.fetchApi(`/session/start/${sessionId}`);
  }

  async stopSession(sessionId: string): Promise<any> {
    return await this.fetchApi(`/session/stop/${sessionId}`);
  }

  async terminateSession(sessionId: string): Promise<any> {
    return await this.fetchApi(`/session/terminate/${sessionId}`);
  }

  async getSessionStatus(sessionId: string): Promise<{ success: boolean; state: string }> {
    const data = await this.fetchApi(`/session/status/${sessionId}`);
    return {
      success: Boolean(data.success),
      state: data.state || 'INITIALIZING',
    };
  }

  async requestPairingCode(sessionId: string, phoneNumber: string): Promise<{ code: string }> {
    const data = await this.fetchApi(`/session/requestPairingCode/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, showNotification: true }),
    });
    return { code: data.result };
  }

  async getQrImageBuffer(sessionId: string): Promise<Buffer | null> {
    try {
      const res = await fetch(`${this.baseUrl}/session/qr/${sessionId}/image`, {
        headers: { 'x-api-key': this.apiKey },
      });
      if (!res.ok) return null;
      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    } catch {
      return null;
    }
  }

  async getChats(sessionId: string): Promise<any[]> {
    const data = await this.fetchApi(`/client/getChats/${sessionId}`);
    return data.chats || [];
  }

  async fetchMessages(sessionId: string, chatId: string, limit = 20): Promise<any[]> {
    const data = await this.fetchApi(`/chat/fetchMessages/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify({ chatId, searchOptions: { limit } }),
    });
    return data.messages || [];
  }

  async sendMessage(sessionId: string, chatId: string, text: string): Promise<any> {
    return await this.fetchApi(`/client/sendMessage/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify({
        chatId,
        contentType: 'string',
        content: text,
      }),
    });
  }

  async sendMediaMessage(sessionId: string, chatId: string, mediaUrl: string, caption?: string): Promise<any> {
    const res = await fetch(mediaUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to download media file. Status: ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await res.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    const urlParts = mediaUrl.split('/');
    let filename = urlParts[urlParts.length - 1]?.split('?')[0] || 'file';

    return await this.fetchApi(`/client/sendMessage/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify({
        chatId,
        contentType: 'MessageMedia',
        content: {
          mimetype: contentType,
          data: base64Data,
          filename,
        },
        options: caption ? { caption } : {},
      }),
    });
  }

  async sendStateTyping(sessionId: string, chatId: string): Promise<any> {
    return await this.fetchApi(`/chat/sendStateTyping/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify({ chatId }),
    }).catch(() => null);
  }

  async clearState(sessionId: string, chatId: string): Promise<any> {
    return await this.fetchApi(`/chat/clearState/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify({ chatId }),
    }).catch(() => null);
  }

  parseWebhookPayload(body: any): NormalizedWebhookEvent | null {
    if (!body) return null;
    const dataType = body.dataType || body.event;
    const { data, sessionId } = body;

    if (!dataType || (dataType !== 'message' && dataType !== 'message_create')) {
      return null;
    }

    const msg = data?.message || data || {};
    const fromMe = Boolean(msg.fromMe);
    const contactWhatsappId = fromMe ? msg.to : msg.from;

    return {
      eventType: dataType === 'message_create' ? 'message_create' : 'message',
      sessionId: sessionId || 'default',
      data: {
        id: msg.id?._serialized || msg.id,
        from: contactWhatsappId,
        to: msg.to,
        fromMe,
        body: msg.body || '',
        isGroup: Boolean(msg.isGroup),
        timestamp: msg.timestamp,
        hasMedia: Boolean(msg.hasMedia),
        raw: body,
      },
    };
  }
}
