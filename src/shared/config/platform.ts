export const PLATFORM_INFO = {
  name: process.env.NEXT_PUBLIC_APP_NAME || process.env.APP_NAME || 'AutoZoneX Connect',
  shortName: (process.env.NEXT_PUBLIC_APP_NAME || process.env.APP_NAME || 'AutoZoneX Connect').charAt(0).toUpperCase(),
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'AI-Powered WhatsApp CRM, Campaign Automation & Customer Engagement Platform',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:9091',
};
