import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/features/auth/lib/auth-utils';
import { db } from '@/shared/database';
import { whatsappSessions } from '@/shared/database/schema';
import { eq, and, or } from 'drizzle-orm';
import { realtimeBus, RealtimeMessageEvent } from '@/features/whatsapp/lib/realtime-bus';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const userSession = await getSession();
  if (!userSession) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const orgId = userSession.organizationId as string;
  const sessionId = req.nextUrl.searchParams.get('sessionId') || '*';
  let targetSessionId = sessionId;

  // Strict Multi-Tenant Check: Verify session belongs to user's organization if a specific sessionId is requested
  if (sessionId !== '*') {
    const [validSession] = await db
      .select()
      .from(whatsappSessions)
      .where(
        and(
          or(
            eq(whatsappSessions.sessionId, sessionId),
            eq(whatsappSessions.id, sessionId)
          ),
          eq(whatsappSessions.organizationId, orgId)
        )
      )
      .limit(1);

    if (!validSession) {
      return new NextResponse('Forbidden: Session does not belong to your organization', { status: 403 });
    }
    targetSessionId = validSession.sessionId;
  }

  const channel = `event:${orgId}:${targetSessionId}`;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial heartbeat
      controller.enqueue(encoder.encode(`: ping\n\n`));

      const onMessageEvent = (eventData: RealtimeMessageEvent) => {
        try {
          const sseChunk = `data: ${JSON.stringify(eventData)}\n\n`;
          controller.enqueue(encoder.encode(sseChunk));
        } catch (err) {
          console.error('[SSE Route] Failed to enqueue event:', err);
        }
      };

      realtimeBus.on(channel, onMessageEvent);

      // Keepalive ping interval every 15s to keep connection alive
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch (e) {
          clearInterval(pingInterval);
        }
      }, 15000);

      // Cleanup listener when client disconnects
      req.signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
        realtimeBus.off(channel, onMessageEvent);
        try {
          controller.close();
        } catch (e) {}
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering in Nginx
    },
  });
}
