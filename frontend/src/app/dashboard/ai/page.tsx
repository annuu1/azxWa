import AISettingsPanel from "@/features/ai/components/ai-settings-panel";

export default function AISettingsPage() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">AI Chatbot Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Configure your AI Auto-Responder models and templates.</p>
        </div>
      </div>
      
      <AISettingsPanel />
    </div>
  );
}
