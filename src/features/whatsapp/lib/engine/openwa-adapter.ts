import { IWhatsAppEngineAdapter, NormalizedWebhookEvent, WhatsAppSession, SessionConfig } from './types';
import { getAppUrl, getWhatsAppEngineUrl } from '@/shared/config/platform';

export class OpenWAAdapter implements IWhatsAppEngineAdapter {
  name = 'openwa';

  private get baseUrl(): string {
    return getWhatsAppEngineUrl('2785');
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
      if (res.status === 429) {
        throw new Error('OpenWA API rate limit exceeded. Please wait a few seconds before retrying.');
      }
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

  /**
   * Automatically registers application dynamic webhook with OpenWA engine for live event streaming
   * Uses unique session UUID to guarantee multi-tenant isolation even if friendly session names overlap.
   */
  private async ensureWebhookRegistered(targetId: string): Promise<void> {
    try {
      const appUrl = getAppUrl();
      const targetWebhookUrl = `${appUrl}/api/whatsapp/webhook?sessionId=${encodeURIComponent(targetId)}`;
      
      const webhooks = await this.fetchApi(`/api/sessions/${targetId}/webhooks`).catch(() => []);
      let hasValidWebhook = false;

      if (Array.isArray(webhooks)) {
        for (const w of webhooks) {
          if (w.url === targetWebhookUrl && w.active) {
            hasValidWebhook = true;
          } else if (w.url && w.url.includes('/api/whatsapp/webhook')) {
            await this.fetchApi(`/api/sessions/${targetId}/webhooks/${w.id}`, { method: 'DELETE' }).catch(() => null);
            console.log(`[OpenWAAdapter] Deleted legacy/mismatched webhook (${w.url}) for session UUID ${targetId}`);
          }
        }
      }

      if (!hasValidWebhook) {
        await this.fetchApi(`/api/sessions/${targetId}/webhooks`, {
          method: 'POST',
          body: JSON.stringify({
            url: targetWebhookUrl,
          }),
        });
        console.log(`[OpenWAAdapter] Auto-registered unique UUID session webhook for ${targetId}: ${targetWebhookUrl}`);
      }
    } catch (err: any) {
      console.warn(`[OpenWAAdapter] ensureWebhookRegistered warning for ${targetId}:`, err.message || err);
    }
  }

  async getSessions(): Promise<WhatsAppSession[]> {
    try {
      const data = await this.fetchApi('/api/sessions');
      const sessionsList = Array.isArray(data) ? data : data.result || [];

      return sessionsList.map((s: any) => {
        const rawStatus = (s.status || s.state || 'disconnected').toLowerCase();
        let state = 'DISCONNECTED';
        let ready = false;

        if (rawStatus === 'ready' || rawStatus === 'authenticated') {
          state = 'CONNECTED';
          ready = true;
        } else if (rawStatus === 'qr_ready') {
          state = 'QR_READY';
        } else if (rawStatus === 'initializing') {
          state = 'INITIALIZING';
        } else if (rawStatus === 'authenticating') {
          state = 'AUTHENTICATING';
        } else if (rawStatus === 'action_required') {
          state = 'ACTION_REQUIRED';
        } else if (rawStatus === 'failed') {
          state = 'FAILED';
        }

        // Auto-ensure per-session unique UUID webhook is registered with OpenWA
        this.ensureWebhookRegistered(s.id);

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
    const result = await this.fetchApi(`/api/sessions/${targetId}/start`, { method: 'POST' });
    this.ensureWebhookRegistered(targetId);
    return result;
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
      const isReady = rawStatus === 'ready' || rawStatus === 'authenticated';
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
        timestamp: c.timestamp || c.lastMessageTimestamp || c.lastMessage?.timestamp,
        lastMessage: c.lastMessage ? {
          body: c.lastMessage.body || c.lastMessage.text || c.lastMessage.caption || '',
          hasMedia: Boolean(c.lastMessage.hasMedia || c.lastMessage.mediaUrl || c.lastMessage.mimetype),
          timestamp: c.lastMessage.timestamp || c.timestamp,
        } : (c.lastMessageBody ? { body: c.lastMessageBody, timestamp: c.timestamp } : null),
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

      return list.map((m: any) => {
        const mediaObj = m.media || (m.hasMedia || m.mimetype ? {
          mimetype: m.mimetype,
          filename: m.filename,
          sizeBytes: m.sizeBytes,
          data: m.mediaData || m.data,
        } : undefined);

        const reactionsObj = m.reactions || m.metadata?.reactions || {};

        return {
          id: { _serialized: m.id?._serialized || m.id },
          waMessageId: m.id?._serialized || m.id,
          from: m.from || m.sender?.id || m.sender,
          to: m.to || m.recipient,
          fromMe: Boolean(m.fromMe || m.isFromMe),
          body: m.body || m.text || m.caption || '',
          type: m.type || (mediaObj ? (mediaObj.mimetype?.startsWith('image/') ? 'image' : mediaObj.mimetype?.startsWith('video/') ? 'video' : mediaObj.mimetype?.startsWith('audio/') ? 'audio' : 'document') : 'text'),
          timestamp: m.timestamp || m.t || Math.floor(Date.now() / 1000),
          status: m.status || (m.fromMe ? 'sent' : 'delivered'),
          isGroup: Boolean(m.isGroup || (m.chatId && m.chatId.endsWith('@g.us'))),
          hasMedia: Boolean(m.hasMedia || m.mediaUrl || m.mimetype || mediaObj),
          mediaUrl: m.mediaUrl || (mediaObj?.data ? (mediaObj.data.startsWith('data:') ? mediaObj.data : `data:${mediaObj.mimetype || 'image/jpeg'};base64,${mediaObj.data}`) : undefined),
          media: mediaObj,
          reactions: reactionsObj,
          metadata: {
            reactions: reactionsObj,
            media: mediaObj,
            quotedMessage: m.quotedMsg || m.quotedMessage ? {
              id: m.quotedMsg?.id || m.quotedMessage?.id,
              body: m.quotedMsg?.body || m.quotedMessage?.body || m.quotedMsg?.text || '',
              sender: m.quotedMsg?.from || m.quotedMessage?.from || 'Replied Message',
            } : undefined,
          },
          quotedMsg: m.quotedMsg || m.quotedMessage ? {
            id: m.quotedMsg?.id || m.quotedMessage?.id,
            body: m.quotedMsg?.body || m.quotedMessage?.body || m.quotedMsg?.text || '',
            sender: m.quotedMsg?.from || m.quotedMessage?.from || 'Replied Message',
          } : null,
          chatName: m.chatName || m.pushName || m.contact?.name || m.contact?.pushName || undefined,
          author: m.author || m.sender || undefined,
        };
      });
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
    const isDocument = !mediaUrl.match(/\.(jpeg|jpg|png|gif|webp)$/i) && !mediaUrl.startsWith('data:image');
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

  async sendMedia(
    sessionId: string,
    chatId: string,
    mediaType: 'image' | 'video' | 'audio' | 'document' | 'sticker',
    payload: { base64?: string; url?: string; mimetype: string; filename?: string; caption?: string; quotedMessageId?: string }
  ): Promise<any> {
    const targetId = await this.resolveSessionId(sessionId);
    return await this.fetchApi(`/api/sessions/${targetId}/messages/send-${mediaType}`, {
      method: 'POST',
      body: JSON.stringify({
        chatId,
        ...payload,
      }),
    });
  }

  async reactMessage(sessionId: string, chatId: string, messageId: string, emoji: string): Promise<any> {
    const targetId = await this.resolveSessionId(sessionId);
    return await this.fetchApi(`/api/sessions/${targetId}/messages/react`, {
      method: 'POST',
      body: JSON.stringify({
        chatId,
        messageId,
        emoji,
      }),
    });
  }

  async deleteMessage(sessionId: string, chatId: string, messageId: string, forEveryone = true): Promise<any> {
    const targetId = await this.resolveSessionId(sessionId);
    return await this.fetchApi(`/api/sessions/${targetId}/messages/delete`, {
      method: 'POST',
      body: JSON.stringify({
        chatId,
        messageId,
        forEveryone,
      }),
    });
  }

  async replyMessage(sessionId: string, chatId: string, quotedMessageId: string, text: string): Promise<any> {
    const targetId = await this.resolveSessionId(sessionId);
    return await this.fetchApi(`/api/sessions/${targetId}/messages/reply`, {
      method: 'POST',
      body: JSON.stringify({
        chatId,
        quotedMessageId,
        text,
      }),
    });
  }

  async getProfilePicture(sessionId: string, contactId: string): Promise<string | null> {
    try {
      const targetId = await this.resolveSessionId(sessionId);
      const data = await this.fetchApi(`/api/sessions/${targetId}/contacts/${encodeURIComponent(contactId)}/profile-picture`);
      return data.url || null;
    } catch {
      return null;
    }
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

  async downloadMessageMedia(sessionId: string, chatId: string, messageId: string): Promise<{ buffer: Buffer; mimetype: string } | null> {
    try {
      const targetId = await this.resolveSessionId(sessionId);
      const url = `${this.baseUrl}/api/sessions/${targetId}/messages/${encodeURIComponent(chatId)}/${encodeURIComponent(messageId)}/media`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[OpenWAAdapter] downloadMessageMedia HTTP ${res.status} for ${messageId}`);
        return null;
      }
      const arrayBuffer = await res.arrayBuffer();
      const mimetype = res.headers.get('content-type') || 'audio/ogg';
      return { buffer: Buffer.from(arrayBuffer), mimetype };
    } catch (err: any) {
      console.warn('[OpenWAAdapter] downloadMessageMedia error:', err.message);
      return null;
    }
  }

  parseWebhookPayload(body: any, overrideSessionId?: string): NormalizedWebhookEvent | null {
    if (!body) return null;

    const eventName = body.event || body.eventType || body.dataType || body.type;
    const sessionId = overrideSessionId || body.sessionId || body.session || body.id || 'default';
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
          hasMedia: Boolean(msg.hasMedia || msg.mediaUrl || msg.media || (msg.type && msg.type !== 'text' && msg.type !== 'chat')),
          mediaUrl: msg.mediaUrl || msg.media?.url,
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
