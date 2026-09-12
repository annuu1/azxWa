import AIActivityCenter from "@/features/ai/components/ai-activity-center";

export const metadata = {
  title: "AI Activity & Lead Command Center | Autozonex",
  description: "Monitor, orchestrate and control AI multi-agent activities, action proposals and automated follow-ups",
};

export default function AIAssistantPage() {
  return (
    <div className="p-4 sm:p-8 space-y-6">
      <AIActivityCenter />
    </div>
  );
}
