import { IWhatsAppEngineAdapter } from './types';
import { OpenWAAdapter } from './openwa-adapter';
import { WWebJSAdapter } from './wwebjs-adapter';

const adapters: Record<string, IWhatsAppEngineAdapter> = {
  openwa: new OpenWAAdapter(),
  wwebjs: new WWebJSAdapter(),
};

/**
 * Register a custom engine adapter dynamically
 */
export function registerEngineAdapter(adapter: IWhatsAppEngineAdapter) {
  adapters[adapter.name.toLowerCase()] = adapter;
}

/**
 * Retrieve the active WhatsApp engine adapter.
 * Controlled via environment variable `WHATSAPP_ENGINE_PROVIDER`.
 * Defaults to 'openwa'.
 */
export function getWhatsAppEngine(): IWhatsAppEngineAdapter {
  const provider = (process.env.WHATSAPP_ENGINE_PROVIDER || 'openwa').toLowerCase();
  const adapter = adapters[provider];

  if (!adapter) {
    console.warn(`[EngineFactory] Provider "${provider}" not found. Falling back to openwa.`);
    return adapters.openwa;
  }

  return adapter;
}

export * from './types';
export * from './openwa-adapter';
export * from './wwebjs-adapter';
