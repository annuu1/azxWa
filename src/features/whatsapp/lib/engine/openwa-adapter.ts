import { IWhatsAppEngineAdapter, NormalizedWebhookEvent, WhatsAppSession, SessionConfig } from './types';

export class OpenWAAdapter implements IWhatsAppEngineAdapter {
  name = 'openwa';

  private get baseUrl(): string {
    const url = process.env.WHATSAPP_ENGINE_URL || 'http://localhost:2785';
    return url.replace(/\/+$/, '');
  }

  private get apiKey(): string {
    return process.env.API_KEY || 'anurag-dev-api-key';
  }

  private async fetchApi(path: string, options: RequestInit = {}) {
    const fullUrl = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers = {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const res = await fetch(fullUrl, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(errBody.message || errBody.error || `OpenWA HTTP Error ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await res.json();
    }
    return await res.text();
  }

  /**
   * Helper to resolve human-readable session names (e.g. "sales-bot") to OpenWA's internal UUIDs.
   */
  private async resolveSessionId(sessionId: string): Promise<string> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId);
    if (isUuid) return sessionId;

    try {
      const list = await this.fetchApi('/api/sessions');
      if (Array.isArray(list)) {
        const found = list.find((s: any) => s.name === sessionId || s.id === sessionId);
        if (found && found.id) {
          return found.id;
        }
      }
    } catch (err) {
      console.warn('[OpenWAAdapter] Error listing sessions during UUID resolution:', err);
    }

    // Try creating the session on OpenWA if it doesn't exist yet
    try {
      const created = await this.fetchApi('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ name: sessionId }),
      });
      if (created && created.id) {
        return created.id;
      }
    } catch (err: any) {
      if (err.message?.includes('409') || err.message?.includes('exists')) {
        const list = await this.fetchApi('/api/sessions');
        if (Array.isArray(list)) {
          const found = list.find((s: any) => s.name === sessionId || s.id === sessionId);
          if (found && found.id) return found.id;
        }
      }
    }

    return sessionId;
  }

  async getSessions(): Promise<WhatsAppSession[]> {
    try {
      const data = await this.fetchApi('/api/sessions');
      const sessionsList = Array.isArray(data) ? data : data.result || [];

      return sessionsList.map((s: any) => {
        const rawStatus = (s.status || s.state || 'disconnected').toLowerCase();
        let state = 'DISCONNECTED';
        let ready = false;

        if (rawStatus === 'ready' || rawStatus === 'authenticated' || s.engineLoaded === true) {
          state = 'CONNECTED';
          ready = true;
        } else if (rawStatus === 'qr_ready') {
          state = 'QR_READY';
        } else if (rawStatus === 'initializing') {
          state = 'INITIALIZING';
        } else if (rawStatus === 'authenticating') {
          state = 'AUTHENTICATING';
        }

        return {
          id: s.name || s.id,
          uuid: s.id,
          name: s.name || s.id,
          state,
          status: rawStatus,
          ready,
          phone: s.phone || null,
          pushName: s.pushName || null,
          connectedAt: s.connectedAt || null,
          lastActive: s.lastActive || null,
          lastError: s.lastError || null,
          restriction: s.restriction || null,
          engineLoaded: Boolean(s.engineLoaded),
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        };
      });
    } catch (err) {
      console.error('[OpenWAAdapter] getSessions error:', err);
      return [];
    }
  }

  async startSession(sessionId: string): Promise<any> {
    const targetId = await this.resolveSessionId(sessionId);
    return await this.fetchApi(`/api/sessions/${targetId}/start`, { method: 'POST' });
  }

  async stopSession(sessionId: string): Promise<any> {
    const targetId = await this.resolveSessionId(sessionId);
    return await this.fetchApi(`/api/sessions/${targetId}/stop`, { method: 'POST' });
  }

  async logoutSession(sessionId: string): Promise<any> {
    const targetId = await this.resolveSessionId(sessionId);
    return await this.fetchApi(`/api/sessions/${targetId}/logout`, { method: 'POST' });
  }

  async terminateSession(sessionId: string): Promise<any> {
    const targetId = await this.resolveSessionId(sessionId);
    try {
      return await this.fetchApi(`/api/sessions/${targetId}/logout`, { method: 'POST' });
    } catch {
      return await this.fetchApi(`/api/sessions/${targetId}`, { method: 'DELETE' }).catch(() => ({ success: true }));
    }
  }

  async forceKillSession(sessionId: string): Promise<any> {
    const targetId = await this.resolveSessionId(sessionId);
    return await this.fetchApi(`/api/sessions/${targetId}/force-kill`, { method: 'POST' });
  }

  async getSessionConfig(sessionId: string): Promise<SessionConfig | null> {
    try {
      const targetId = await this.resolveSessionId(sessionId);
      return await this.fetchApi(`/api/sessions/${targetId}/config`);
    } catch (err) {
      console.warn('[OpenWAAdapter] getSessionConfig error:', err);
      return null;
    }
  }

  async updateSessionConfig(sessionId: string, config: Partial<SessionConfig>): Promise<SessionConfig> {
    const targetId = await this.resolveSessionId(sessionId);
    return await this.fetchApi(`/api/sessions/${targetId}/config`, {
      method: 'PATCH',
      body: JSON.stringify(config),
    });
  }

  async getSessionStatus(sessionId: string): Promise<{ success: boolean; state: string }> {
    try {
      const targetId = await this.resolveSessionId(sessionId);
      const data = await this.fetchApi(`/api/sessions/${targetId}`);
      const rawStatus = (data.status || 'disconnected').toLowerCase();
      const isReady = rawStatus === 'ready' || data.engineLoaded === true;
      return {
        success: isReady,
        state: isReady ? 'CONNECTED' : rawStatus.toUpperCase(),
      };
    } catch {
      return { success: false, state: 'DISCONNECTED' };
    }
  }

  async requestPairingCode(sessionId: string, phoneNumber: string): Promise<{ code: string }> {
    const targetId = await this.resolveSessionId(sessionId);
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const data = await this.fetchApi(`/api/sessions/${targetId}/pairing-code`, {
      method: 'POST',
      body: JSON.stringify({ phoneNumber: cleanPhone }),
    });
    return { code: data.pairingCode || data.code || data.result };
  }

  async getQrImageBuffer(sessionId: string): Promise<Buffer | null> {
    try {
      const targetId = await this.resolveSessionId(sessionId);
      const data = await this.fetchApi(`/api/sessions/${targetId}/qr`);
      const qrData: string = data.qrCode || data.qr || data;
      if (!qrData) return null;

      if (qrData.startsWith('data:image')) {
        const base64Str = qrData.split(',')[1];
        return Buffer.from(base64Str, 'base64');
      }

      return Buffer.from(qrData);
    } catch (err) {
      console.error('[OpenWAAdapter] getQrImageBuffer error:', err);
      return null;
    }
  }

  async getChats(sessionId: string): Promise<any[]> {
    try {
      const targetId = await this.resolveSessionId(sessionId);
      const data = await this.fetchApi(`/api/sessions/${targetId}/chats`);
      const list = Array.isArray(data) ? data : data.chats || [];

      return list.map((c: any) => ({
        id: { _serialized: c.id || c.chatId || c.jid },
        name: c.name || c.pushName || c.formattedTitle || c.id,
        isGroup: Boolean(c.isGroup || (c.id && c.id.endsWith('@g.us'))),
        unreadCount: c.unreadCount || 0,
        timestamp: c.timestamp || c.lastMessageTimestamp,
      }));
    } catch (err) {
      console.error('[OpenWAAdapter] getChats error:', err);
      return [];
    }
  }

  async fetchMessages(sessionId: string, chatId: string, limit = 20): Promise<any[]> {
    try {
      const targetId = await this.resolveSessionId(sessionId);
      const data = await this.fetchApi(
        `/api/sessions/${targetId}/messages/${encodeURIComponent(chatId)}/history?limit=${limit}`
      );
      const list = Array.isArray(data) ? data : data.messages || [];

      return list.map((m: any) => ({
        id: { _serialized: m.id?._serialized || m.id },
        from: m.from || m.sender?.id || m.sender,
        to: m.to || m.recipient,
        fromMe: Boolean(m.fromMe || m.isFromMe),
        body: m.body || m.text || m.caption || '',
        timestamp: m.timestamp || m.t || Math.floor(Date.now() / 1000),
        isGroup: Boolean(m.isGroup || (m.chatId && m.chatId.endsWith('@g.us'))),
        hasMedia: Boolean(m.hasMedia || m.mediaUrl || m.mimetype),
      }));
    } catch (err) {
      console.error('[OpenWAAdapter] fetchMessages error:', err);
      return [];
    }
  }

  async sendMessage(sessionId: string, chatId: string, text: string): Promise<any> {
    const targetId = await this.resolveSessionId(sessionId);
    return await this.fetchApi(`/api/sessions/${targetId}/messages/send-text`, {
      method: 'POST',
      body: JSON.stringify({
        chatId,
        text,
      }),
    });
  }

  async sendMediaMessage(sessionId: string, chatId: string, mediaUrl: string, caption?: string): Promise<any> {
    const targetId = await this.resolveSessionId(sessionId);
    const isDocument = !mediaUrl.match(/\.(jpeg|jpg|png|gif|webp)$/i);
    const endpoint = isDocument ? 'send-document' : 'send-image';

    return await this.fetchApi(`/api/sessions/${targetId}/messages/${endpoint}`, {
      method: 'POST',
      body: JSON.stringify({
        chatId,
        url: mediaUrl,
        caption: caption || '',
      }),
    });
  }

  async sendStateTyping(sessionId: string, chatId: string): Promise<any> {
    const targetId = await this.resolveSessionId(sessionId);
    return await this.fetchApi(`/api/sessions/${targetId}/chats/typing`, {
      method: 'POST',
      body: JSON.stringify({ chatId, presence: 'composing' }),
    }).catch(() => null);
  }

  async clearState(sessionId: string, chatId: string): Promise<any> {
    const targetId = await this.resolveSessionId(sessionId);
    return await this.fetchApi(`/api/sessions/${targetId}/chats/typing`, {
      method: 'POST',
      body: JSON.stringify({ chatId, presence: 'paused' }),
    }).catch(() => null);
  }

  parseWebhookPayload(body: any): NormalizedWebhookEvent | null {
    if (!body) return null;

    const eventName = body.event || body.eventType || body.dataType || body.type;
    const sessionId = body.sessionId || body.session || body.id || 'default';
    const payloadData = body.data || body.payload || body;

    const isMessageEvent =
      eventName === 'message.received' ||
      eventName === 'message.sent' ||
      eventName === 'message' ||
      eventName === 'message_create';

    if (isMessageEvent) {
      const msg = payloadData.message || payloadData;
      const fromMe = Boolean(msg.fromMe || msg.isFromMe || eventName === 'message.sent');
      const from = msg.from || msg.sender?.id || msg.sender || (fromMe ? msg.to : '');
      const to = msg.to || msg.recipient || (fromMe ? '' : msg.from);
      const bodyText = msg.body || msg.text || msg.caption || '';
      const isGroup = Boolean(msg.isGroup || (from && from.endsWith('@g.us')));

      return {
        eventType: fromMe ? 'message_create' : 'message',
        sessionId,
        data: {
          id: msg.id?._serialized || msg.id,
          from,
          to,
          fromMe,
          body: bodyText,
          isGroup,
          timestamp: msg.timestamp || msg.t,
          hasMedia: Boolean(msg.hasMedia || msg.mediaUrl),
          mediaUrl: msg.mediaUrl,
          raw: body,
        },
      };
    }

    if (eventName?.startsWith('session.')) {
      return {
        eventType: 'status',
        sessionId,
        data: {
          from: '',
          fromMe: false,
          body: payloadData.status || eventName,
          isGroup: false,
          raw: body,
        },
      };
    }

    return null;
  }
}
