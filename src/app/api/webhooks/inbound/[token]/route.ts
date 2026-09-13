import { NextRequest, NextResponse } from 'next/server';
import { processInboundLeadWebhook } from '@/features/crm/lib/inbound-webhook-service';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Missing webhook token in URL path.' },
        { status: 400 }
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
      // Fallback parse
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
    console.error('[InboundWebhook Route] Error handling request:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  return NextResponse.json({
    status: 'online',
    message: 'AutoZoneX Inbound Lead Webhook endpoint is active and ready to receive POST requests.',
    endpoint: `/api/webhooks/inbound/${token}`,
    acceptedMethods: ['POST'],
  });
}
