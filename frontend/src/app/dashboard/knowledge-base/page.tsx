import KBPanel from "@/features/knowledge-base/components/kb-panel";

export default function KnowledgeBasePage() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Knowledge Base & RAG</h1>
          <p className="text-gray-500 text-sm mt-1">
            Feed documents, scrape websites, or add FAQs to inject real-time context into your AI Auto-Responder replies.
          </p>
        </div>
      </div>
      
      <KBPanel />
    </div>
  );
}
