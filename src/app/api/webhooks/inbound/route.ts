import { NextRequest, NextResponse } from 'next/server';
import { processInboundLeadWebhook } from '@/features/crm/lib/inbound-webhook-service';

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const queryToken = url.searchParams.get('token') || url.searchParams.get('key') || url.searchParams.get('orgId');
    const headerToken = 
      req.headers.get('x-api-key') || 
      req.headers.get('x-webhook-token') || 
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    const token = queryToken || headerToken;

    if (!token) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing organization identifier. Provide via ?token=..., header x-api-key, or path /api/webhooks/inbound/[token].' 
        },
        { status: 401 }
      );
    }

    let payload: any = {};
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      payload = await req.json().catch(() => ({}));
    } else if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        payload[key] = value.toString();
      });
    } else {
      const text = await req.text();
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { message: text };
      }
    }

    const result = await processInboundLeadWebhook(token, payload);
    return NextResponse.json(result, { status: result.status });
  } catch (err: any) {
    console.error('[InboundWebhook Generic Route] Error handling request:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'online',
    message: 'AutoZoneX Generic Inbound Lead Webhook endpoint is active.',
    instructions: 'Pass token via query parameter (?token=...) or header (x-api-key: ...).',
    acceptedMethods: ['POST'],
  });
}
