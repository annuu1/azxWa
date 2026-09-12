import { db } from "@/shared/database";
import { 
  leads, 
  contacts, 
  notes, 
  tags, 
  contactTags, 
  pipelineStages, 
  pipelines, 
  leadIntelligence, 
  users, 
  whatsappSessions 
} from "@/shared/database/schema";
import { eq, desc, asc, and } from "drizzle-orm";
import { fetchMessages } from "@/features/whatsapp/lib/whatsapp-service";
import { queryKnowledgeBase } from "@/features/knowledge-base/lib/kb-service";
import { LeadMemoryContext, HumanNoteContext, ChatMessageContext } from "./types";

export async function aggregateLeadMemory(orgId: string, leadId: string): Promise<LeadMemoryContext | null> {
  const [leadRecord] = await db.select().from(leads).where(and(eq(leads.id, leadId), eq(leads.organizationId, orgId))).limit(1);
  if (!leadRecord) return null;

  const [contactRecord] = await db.select().from(contacts).where(eq(contacts.id, leadRecord.contactId)).limit(1);
  if (!contactRecord) return null;

  const rawNotes = await db
    .select({
      id: notes.id,
      content: notes.content,
      createdAt: notes.createdAt,
      userEmail: users.email,
    })
    .from(notes)
    .leftJoin(users, eq(notes.userId, users.id))
    .where(and(eq(notes.contactId, contactRecord.id), eq(notes.organizationId, orgId)))
    .orderBy(desc(notes.createdAt));

  const humanNotes: HumanNoteContext[] = rawNotes.map(n => ({
    id: n.id,
    content: n.content,
    authorName: n.userEmail ? n.userEmail.split("@")[0] : "Sales Rep",
    createdAt: n.createdAt || new Date(),
  }));

  let currentStageName = "New";
  const stagesList = await db
    .select({
      id: pipelineStages.id,
      name: pipelineStages.name,
      position: pipelineStages.position,
    })
    .from(pipelineStages)
    .innerJoin(pipelines, eq(pipelineStages.pipelineId, pipelines.id))
    .where(eq(pipelines.organizationId, orgId))
    .orderBy(asc(pipelineStages.position));

  if (leadRecord.stageId) {
    const matched = stagesList.find(s => s.id === leadRecord.stageId);
    if (matched) currentStageName = matched.name;
  }

  const appliedTags = await db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(contactTags)
    .innerJoin(tags, eq(contactTags.tagId, tags.id))
    .where(eq(contactTags.contactId, contactRecord.id));

  const chatHistory: ChatMessageContext[] = [];
  try {
    const [activeSession] = await db
      .select()
      .from(whatsappSessions)
      .where(and(eq(whatsappSessions.organizationId, orgId), eq(whatsappSessions.status, "CONNECTED")))
      .limit(1);

    if (activeSession) {
      const messagesRes: any = await fetchMessages(activeSession.sessionId, contactRecord.whatsappId, 20);
      const msgList = Array.isArray(messagesRes) ? messagesRes : (messagesRes && Array.isArray(messagesRes.messages) ? messagesRes.messages : []);
      for (const msg of msgList) {
        if (!msg.body && !msg.hasMedia) continue;
        chatHistory.push({
          role: msg.fromMe ? "agent" : "customer",
          sender: msg.fromMe ? "Sales Rep / AI" : (contactRecord.name || contactRecord.pushName || "Customer"),
          body: typeof msg.body === "string" ? msg.body : (msg.hasMedia ? "[Attachment / Media]" : ""),
          timestamp: msg.timestamp,
        });
      }
    }
  } catch (e) {
    console.warn("[MemoryAggregator] Error fetching live WhatsApp history:", e);
  }

  const [existingIntel] = await db
    .select()
    .from(leadIntelligence)
    .where(eq(leadIntelligence.leadId, leadId))
    .limit(1);

  let relevantKnowledgeContext = "";
  try {
    const lastCustomerMsg = chatHistory.filter(m => m.role === "customer").pop();
    const queryPhrases = [
      lastCustomerMsg?.body || '',
      humanNotes[0]?.content || '',
      contactRecord.name || ''
    ].filter(Boolean).join(' ');

    if (queryPhrases.trim()) {
      const kbResults = await queryKnowledgeBase(orgId, queryPhrases, 3);
      if (kbResults && kbResults.length > 0) {
        relevantKnowledgeContext = kbResults.map(k => `[${k.title || 'Knowledge Base Document'}]: ${k.content}`).join("\n\n");
      }
    }
  } catch (e) {
    console.warn("[MemoryAggregator] RAG knowledge retrieval skipped/failed:", e);
  }

  return {
    leadId: leadRecord.id,
    contactId: contactRecord.id,
    contactName: contactRecord.name || contactRecord.pushName || contactRecord.whatsappId,
    whatsappId: contactRecord.whatsappId,
    currentStageId: leadRecord.stageId,
    currentStageName,
    pipelineStages: stagesList,
    assignedTags: appliedTags,
    humanNotes,
    chatHistory,
    existingSummary: existingIntel ? existingIntel.summary : undefined,
    existingState: (existingIntel && existingIntel.conversationState as any) || "NEW",
    relevantKnowledgeContext,
  };
}
