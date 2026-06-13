import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { startQueueWorker } from '@/features/campaigns/lib/queue-worker';

const client = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
});

export const db = drizzle(client, { schema });

// Start background broadcast engine
startQueueWorker();

