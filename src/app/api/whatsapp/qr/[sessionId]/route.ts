import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/features/auth/lib/auth-utils';
import { getWhatsAppEngine } from '@/features/whatsapp/lib/engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const userSession = await getSession();
  if (!userSession) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { sessionId } = await params;
  try {
    const engine = getWhatsAppEngine();
    const imageBuffer = await engine.getQrImageBuffer(sessionId);

    if (!imageBuffer) {
      return new NextResponse('QR code not ready or session authenticated', { status: 400 });
    }

    return new NextResponse(imageBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error fetching QR image:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
