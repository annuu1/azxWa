'use server';

import { db } from '@/shared/database';
import { knowledgeSources, knowledgeChunks } from '@/shared/database/schema';
import { getSession } from '@/features/auth/lib/auth-utils';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { extractTextFromURL, chunkText } from '../lib/kb-service';

/**
 * Fetch all knowledge sources for the organization
 */
export async function getKnowledgeSourcesAction() {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const sources = await db
      .select()
      .from(knowledgeSources)
      .where(eq(knowledgeSources.organizationId, orgId))
      .orderBy(knowledgeSources.createdAt);

    return { success: true, sources };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch all chunks (e.g. FAQ entries or doc segments) for a specific source
 */
export async function getKnowledgeChunksAction(sourceId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    const chunks = await db
      .select()
      .from(knowledgeChunks)
      .where(
        and(
          eq(knowledgeChunks.sourceId, sourceId),
          eq(knowledgeChunks.organizationId, orgId)
        )
      );

    return { success: true, chunks };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Create a new FAQ entry (adds a Q&A chunk to the global FAQ source)
 */
export async function createFAQEntryAction(question: string, answer: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    // 1. Find or create the global FAQ source for this organization
    let [faqSource] = await db
      .select()
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.organizationId, orgId),
          eq(knowledgeSources.type, 'FAQ')
        )
      )
      .limit(1);

    if (!faqSource) {
      [faqSource] = await db
        .insert(knowledgeSources)
        .values({
          organizationId: orgId,
          name: 'Frequently Asked Questions (FAQs)',
          type: 'FAQ',
          status: 'COMPLETED',
        })
        .returning();
    }

    // 2. Add the FAQ entry as a knowledge chunk
    await db.insert(knowledgeChunks).values({
      organizationId: orgId,
      sourceId: faqSource.id,
      title: question,
      content: answer,
    });

    revalidatePath('/dashboard/knowledge-base');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a knowledge source (will cascade delete all its chunks)
 */
export async function deleteKnowledgeSourceAction(sourceId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    await db
      .delete(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.id, sourceId),
          eq(knowledgeSources.organizationId, orgId)
        )
      );

    revalidatePath('/dashboard/knowledge-base');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a single knowledge chunk (e.g. a single FAQ entry)
 */
export async function deleteKnowledgeChunkAction(chunkId: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    await db
      .delete(knowledgeChunks)
      .where(
        and(
          eq(knowledgeChunks.id, chunkId),
          eq(knowledgeChunks.organizationId, orgId)
        )
      );

    revalidatePath('/dashboard/knowledge-base');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Scrape a URL, chunk its body text, and save it as a knowledge source
 */
export async function addURLSourceAction(url: string) {
  const userSession = await getSession();
  if (!userSession) throw new Error('Unauthorized');
  const orgId = userSession.organizationId as string;

  try {
    // 1. Scrape URL content
    const scraped = await extractTextFromURL(url);

    // 2. Create the source record
    const [source] = await db
      .insert(knowledgeSources)
      .values({
        organizationId: orgId,
        name: url,
        type: 'URL',
        status: 'PROCESSING',
      })
      .returning();

    // 3. Chunk the text
    const chunks = chunkText(scraped.text, 800, 100);

    // 4. Save the chunks to the database
    if (chunks.length > 0) {
      await db.insert(knowledgeChunks).values(
        chunks.map(chunkContent => ({
          organizationId: orgId,
          sourceId: source.id,
          title: scraped.title || url,
          content: chunkContent,
        }))
      );
    }

    // Update status to completed
    await db
      .update(knowledgeSources)
      .set({ status: 'COMPLETED', name: scraped.title || url })
      .where(eq(knowledgeSources.id, source.id));

    revalidatePath('/dashboard/knowledge-base');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
