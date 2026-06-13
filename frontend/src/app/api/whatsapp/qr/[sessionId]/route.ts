import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/features/auth/lib/auth-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const userSession = await getSession();
  if (!userSession) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { sessionId } = await params;
  const ENGINE_URL = process.env.WHATSAPP_ENGINE_URL || 'http://localhost:3000';
  const API_KEY = process.env.API_KEY || '';

  try {
    const response = await fetch(`${ENGINE_URL}/session/qr/${sessionId}/image`, {
      headers: {
        'x-api-key': API_KEY,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return new NextResponse('QR code not ready or session authenticated', { status: response.status });
    }

    const imageBuffer = await response.arrayBuffer();

    return new NextResponse(imageBuffer, {
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
