export interface WhatsAppSession {
  id: string;
  state: string;
  ready: boolean;
}

export interface NormalizedWebhookEvent {
  eventType: 'message' | 'message_create' | 'status' | 'unknown';
  sessionId: string;
  data: {
    id?: string;
    from: string;
    to?: string;
    fromMe: boolean;
    body: string;
    isGroup: boolean;
    timestamp?: number;
    hasMedia?: boolean;
    mediaUrl?: string;
    raw?: any;
  };
}

export interface IWhatsAppEngineAdapter {
  name: string;
  getSessions(): Promise<WhatsAppSession[]>;
  startSession(sessionId: string): Promise<any>;
  stopSession(sessionId: string): Promise<any>;
  terminateSession(sessionId: string): Promise<any>;
  getSessionStatus(sessionId: string): Promise<{ success: boolean; state: string }>;
  requestPairingCode(sessionId: string, phoneNumber: string): Promise<{ code: string }>;
  getQrImageBuffer(sessionId: string): Promise<Buffer | null>;
  getChats(sessionId: string): Promise<any[]>;
  fetchMessages(sessionId: string, chatId: string, limit?: number): Promise<any[]>;
  sendMessage(sessionId: string, chatId: string, text: string): Promise<any>;
  sendMediaMessage(sessionId: string, chatId: string, mediaUrl: string, caption?: string): Promise<any>;
  sendStateTyping(sessionId: string, chatId: string): Promise<any>;
  clearState(sessionId: string, chatId: string): Promise<any>;
  parseWebhookPayload(body: any): NormalizedWebhookEvent | null;
}
