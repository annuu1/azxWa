import { EventEmitter } from 'events';

export interface RealtimeMessageEvent {
  event: 'message.received' | 'message.sent';
  sessionId: string;
  orgId: string;
  data: {
    id: { _serialized: string };
    from: string;
    to: string;
    fromMe: boolean;
    body: string;
    timestamp: number;
    hasMedia?: boolean;
    mediaUrl?: string;
    quotedMsg?: any;
    pushName?: string;
  };
  timestamp: number;
}

class RealtimeEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(1000);
  }

  emitMessageReceived(orgId: string, sessionId: string, messageData: any) {
    const payload: RealtimeMessageEvent = {
      event: 'message.received',
      sessionId,
      orgId,
      data: messageData,
      timestamp: Math.floor(Date.now() / 1000),
    };
    this.emit(`event:${orgId}:${sessionId}`, payload);
    this.emit(`event:${orgId}:*`, payload);
  }

  emitMessageSent(orgId: string, sessionId: string, messageData: any) {
    const payload: RealtimeMessageEvent = {
      event: 'message.sent',
      sessionId,
      orgId,
      data: messageData,
      timestamp: Math.floor(Date.now() / 1000),
    };
    this.emit(`event:${orgId}:${sessionId}`, payload);
    this.emit(`event:${orgId}:*`, payload);
  }
}

const globalForBus = global as unknown as { realtimeBus: RealtimeEventBus };
export const realtimeBus = globalForBus.realtimeBus || new RealtimeEventBus();
if (process.env.NODE_ENV !== 'production') globalForBus.realtimeBus = realtimeBus;
