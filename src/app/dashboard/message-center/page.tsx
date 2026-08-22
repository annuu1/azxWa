import MessageCenterPanel from "@/features/message-center/components/message-center-panel";

export default function MessageCenterPage() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Message Center</h1>
          <p className="text-gray-500 text-sm mt-1">
            Send bulk WhatsApp broadcasts to raw phone numbers staggered with antiban delays, without clogging your CRM records unless requested.
          </p>
        </div>
      </div>
      
      <MessageCenterPanel />
    </div>
  );
}
