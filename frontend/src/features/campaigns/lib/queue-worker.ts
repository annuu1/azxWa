import { db } from '@/shared/database';
import { queueJobs, campaigns, activities, contacts } from '@/shared/database/schema';
import { sendMessage as engineSendMessage } from '@/features/whatsapp/lib/whatsapp-service';
import { eq, and, lte, sql } from 'drizzle-orm';

let workerRunning = false;

export function startQueueWorker() {
  if (typeof window !== 'undefined') return;

  const globalRef = globalThis as any;
  if (globalRef.queueWorkerStarted) return;
  globalRef.queueWorkerStarted = true;

  console.log('🚀 Broadcast Queue Worker Initialized.');

  setInterval(async () => {
    if (workerRunning) return;
    workerRunning = true;

    try {
      await processQueueJobs();
    } catch (err) {
      console.error('Error in Queue Worker loop:', err);
    } finally {
      workerRunning = false;
    }
  }, 10000); // Check every 10 seconds
}

async function processQueueJobs() {
  const now = new Date();
  
  // Find up to 5 pending jobs scheduled for now or earlier, belonging to active or no campaigns
  const results = await db.select({
    job: queueJobs
  })
  .from(queueJobs)
  .leftJoin(campaigns, eq(queueJobs.campaignId, campaigns.id))
  .where(
    and(
      eq(queueJobs.status, 'PENDING'),
      lte(queueJobs.scheduledFor, now),
      sql`(${queueJobs.campaignId} IS NULL OR ${campaigns.status} NOT IN ('PAUSED', 'FAILED', 'CANCELLED'))`
    )
  )
  .limit(5);

  const pendingJobs = results.map(r => r.job);

  if (pendingJobs.length === 0) return;

  console.log(`[Queue Worker] Found ${pendingJobs.length} pending jobs. Processing...`);

  for (const job of pendingJobs) {
    // Mark as processing
    await db.update(queueJobs)
      .set({ status: 'PROCESSING', updatedAt: new Date() })
      .where(eq(queueJobs.id, job.id));

    try {
      console.log(`[Queue Worker] Sending message to ${job.recipientWhatsappId} via session ${job.sessionId}...`);
      
      // Call WhatsApp Engine
      await engineSendMessage(job.sessionId, job.recipientWhatsappId, job.message);

      // Mark as sent
      await db.update(queueJobs)
        .set({ status: 'SENT', updatedAt: new Date() })
        .where(eq(queueJobs.id, job.id));

      // Log activity in CRM if contact exists
      const [contact] = await db.select().from(contacts).where(
        and(
          eq(contacts.whatsappId, job.recipientWhatsappId),
          eq(contacts.organizationId, job.organizationId)
        )
      ).limit(1);

      if (contact) {
        await db.insert(activities).values({
          organizationId: job.organizationId,
          contactId: contact.id,
          type: 'MESSAGE_SENT',
          description: `Campaign broadcast message sent: "${job.message.substring(0, 60)}${job.message.length > 60 ? '...' : ''}"`,
        });
      }

      console.log(`[Queue Worker] Job ${job.id} completed successfully.`);
    } catch (error: any) {
      console.error(`[Queue Worker] Job ${job.id} failed:`, error.message);
      
      const newAttempts = job.attempts + 1;
      const isFailedPermanently = newAttempts >= job.maxAttempts;

      await db.update(queueJobs)
        .set({
          status: isFailedPermanently ? 'FAILED' : 'PENDING',
          attempts: newAttempts,
          error: error.message || 'Unknown error',
          scheduledFor: isFailedPermanently ? job.scheduledFor : new Date(Date.now() + 1000 * 60 * 2), // retry in 2 min
          updatedAt: new Date(),
        })
        .where(eq(queueJobs.id, job.id));
    }
  }
}
