import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/shared/database';
import { knowledgeSources, knowledgeChunks } from '@/shared/database/schema';
import { getSession } from '@/features/auth/lib/auth-utils';
import { eq } from 'drizzle-orm';
import { 
  extractTextFromPDF, 
  extractTextFromDOCX, 
  extractTextFromTXT, 
  chunkText 
} from '@/features/knowledge-base/lib/kb-service';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const orgId = session.organizationId as string;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const fileName = file.name;
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    
    // Create the source record as PROCESSING
    const [source] = await db
      .insert(knowledgeSources)
      .values({
        organizationId: orgId,
        name: fileName,
        type: 'FILE',
        status: 'PROCESSING',
      })
      .returning();

    let extractedText = '';
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    try {
      if (fileExtension === 'pdf') {
        extractedText = await extractTextFromPDF(buffer);
      } else if (fileExtension === 'docx') {
        extractedText = await extractTextFromDOCX(buffer);
      } else if (fileExtension === 'txt' || fileExtension === 'md') {
        extractedText = extractTextFromTXT(buffer);
      } else {
        throw new Error('Unsupported file format. Please upload PDF, DOCX, TXT, or MD files.');
      }

      if (!extractedText.trim()) {
        throw new Error('No readable text content found in the file.');
      }

      // Chunk the text
      const chunks = chunkText(extractedText, 800, 100);

      // Save chunks to the database
      if (chunks.length > 0) {
        await db.insert(knowledgeChunks).values(
          chunks.map(chunkContent => ({
            organizationId: orgId,
            sourceId: source.id,
            title: fileName,
            content: chunkContent,
          }))
        );
      }

      // Mark source as COMPLETED
      await db
        .update(knowledgeSources)
        .set({ status: 'COMPLETED' })
        .where(eq(knowledgeSources.id, source.id));

      return NextResponse.json({ success: true, sourceId: source.id });
    } catch (parseErr: any) {
      // Mark source as FAILED
      await db
        .update(knowledgeSources)
        .set({ status: 'FAILED' })
        .where(eq(knowledgeSources.id, source.id));
      
      throw parseErr;
    }
  } catch (err: any) {
    console.error('[KB Upload Route] Failed to process upload:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
