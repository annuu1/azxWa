import { db } from '@/shared/database';
import { knowledgeSources, knowledgeChunks } from '@/shared/database/schema';
import { eq, and } from 'drizzle-orm';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Extract text from PDF buffer
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text || '';
  } catch (err: any) {
    throw new Error(`Failed to parse PDF: ${err.message}`);
  }
}

/**
 * Extract text from DOCX buffer
 */
export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const data = await mammoth.extractRawText({ buffer });
    return data.value || '';
  } catch (err: any) {
    throw new Error(`Failed to parse Word Document: ${err.message}`);
  }
}

/**
 * Extract text from text or markdown buffer
 */
export function extractTextFromTXT(buffer: Buffer): string {
  return buffer.toString('utf-8');
}

/**
 * Fetch and extract clean text from a web page
 */
export async function extractTextFromURL(url: string): Promise<{ title: string; text: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch URL: HTTP ${res.status} ${res.statusText}`);
    }

    const html = await res.text();

    // Extract title
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Scraped URL Page';

    // Remove scripts, styles, and strip HTML tags to get raw clean text
    const cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return { title, text: cleanText };
  } catch (err: any) {
    throw new Error(`Scraping failed: ${err.message}`);
  }
}

/**
 * Split text into chunks with overlaps to keep context intact
 */
export function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
  const chunks: string[] = [];
  if (!text) return chunks;

  let index = 0;
  while (index < text.length) {
    const chunk = text.substring(index, index + chunkSize);
    chunks.push(chunk.trim());
    index += (chunkSize - overlap);
    
    // Avoid creating a tiny chunk at the very end
    if (index >= text.length - overlap) break;
  }
  return chunks;
}

/**
 * Retrieve the most relevant knowledge base chunks for a given query (Deduplicated RAG)
 */
export async function queryKnowledgeBase(
  organizationId: string,
  query: string,
  limit = 4
): Promise<{ title: string | null; content: string }[]> {
  try {
    // 1. Fetch all chunks belonging to this organization
    const chunks = await db
      .select({
        id: knowledgeChunks.id,
        title: knowledgeChunks.title,
        content: knowledgeChunks.content,
      })
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.organizationId, organizationId));

    if (chunks.length === 0) return [];

    // 2. Extract keywords from the query
    const stopwords = new Set(['the', 'and', 'for', 'you', 'this', 'that', 'with', 'what', 'how', 'are', 'was', 'were', 'have', 'has']);
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopwords.has(word));

    if (keywords.length === 0) {
      keywords.push(query.toLowerCase().substring(0, 30));
    }

    // 3. Score chunks based on keyword matches
    const scoredChunks = chunks.map(chunk => {
      let score = 0;
      const contentLower = chunk.content.toLowerCase();
      const titleLower = chunk.title ? chunk.title.toLowerCase() : '';

      for (const kw of keywords) {
        if (contentLower.includes(kw)) {
          score += 1;
        }
        if (titleLower && titleLower.includes(kw)) {
          // Give higher weight to matches in the FAQ question or document title
          score += 3;
        }
      }
      return { chunk, score };
    });

    // 4. Filter, sort, and return top results
    return scoredChunks
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => ({
        title: item.chunk.title,
        content: item.chunk.content,
      }));
  } catch (err: any) {
    console.error('[KB Service] Query failed:', err.message);
    return [];
  }
}
