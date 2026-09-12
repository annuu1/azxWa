const defaultPort = process.env.PORT || process.env.NEXT_PUBLIC_PORT || '3001';
const defaultHost = process.env.HOSTNAME || 'localhost';
const defaultProtocol =
  process.env.NODE_ENV === 'production' && !defaultHost.includes('localhost')
    ? 'https'
    : 'http';

const defaultAppUrl = `${defaultProtocol}://${defaultHost}:${defaultPort}`;
const rawAppUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  defaultAppUrl;

export const PLATFORM_INFO = {
  name: process.env.NEXT_PUBLIC_APP_NAME || process.env.APP_NAME || 'AutoZoneX Connect',
  shortName: (process.env.NEXT_PUBLIC_APP_NAME || process.env.APP_NAME || 'AutoZoneX Connect').charAt(0).toUpperCase(),
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'AI-Powered WhatsApp CRM, Campaign Automation & Customer Engagement Platform',
  port: defaultPort,
  appUrl: rawAppUrl.replace(/\/+$/, ''),
};

/**
 * Returns the normalized application base URL.
 * Dynamically resolves from APP_URL, NEXT_PUBLIC_APP_URL, or http://localhost:${PORT}.
 */
export function getAppUrl(): string {
  return PLATFORM_INFO.appUrl;
}

/**
 * Returns the normalized WhatsApp Engine URL.
 */
export function getWhatsAppEngineUrl(fallbackPort = '2785'): string {
  const engineUrl = process.env.WHATSAPP_ENGINE_URL || `http://localhost:${fallbackPort}`;
  return engineUrl.replace(/\/+$/, '');
}

