'use client';
 
import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { 
  Send, 
  User, 
  Users, 
  Search, 
  Sparkles, 
  Bot, 
  Clock, 
  ToggleLeft, 
  ToggleRight, 
  FileText, 
  Check, 
  X, 
  Save, 
  RefreshCw 
} from 'lucide-react';
import { getWhatsAppChats, getWhatsAppMessages, sendWhatsAppMessage } from '../../actions/whatsapp-actions';
import { 
  getContactAIStatus, 
  toggleContactAI, 
  getAISuggestedReplyAction, 
  getConversationSummaryAction, 
  getQualifiedLeadAction, 
  saveQualifiedLeadDetails 
} from '@/features/ai/actions/ai-actions';
 
export default function UnifiedInbox({ sessionId }: { sessionId: string }) {
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // AI Copilot States
  const [aiEnabled, setAiEnabled] = useState(true);
  const [contactId, setContactId] = useState<string | null>(null);
  const [togglingAI, setTogglingAI] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'summary' | 'qualify'>('summary');
  
  // Summary Panel States
  const [summary, setSummary] = useState('');
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // Qualification Panel States
  const [qualifying, setQualifying] = useState(false);
  const [qualifiedData, setQualifiedData] = useState<{ name?: string; email?: string; notes?: string } | null>(null);
  const [savingLead, setSavingLead] = useState(false);
  const [leadSaved, setLeadSaved] = useState(false);
 
  useEffect(() => {
    fetchChats();
  }, [sessionId]);
 
  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id._serialized);
      fetchAIStatus(selectedChat.id._serialized);
      
      // Reset AI panel inputs on chat switch
      setSummary('');
      setQualifiedData(null);
      setLeadSaved(false);
    }
  }, [selectedChat]);
 
  const fetchChats = async () => {
    try {
      const data = await getWhatsAppChats(sessionId);
      if (data.success && data.chats) {
        setChats(data.chats);
      } else {
        setChats([]);
      }
    } catch (err) {
      console.error('Failed to fetch chats', err);
      setChats([]);
    }
  };
 
  const fetchMessages = async (chatId: string) => {
    try {
      const data = await getWhatsAppMessages(sessionId, chatId, 20);
      if (data.success && data.messages) {
        setMessages(data.messages);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to fetch messages', err);
      setMessages([]);
    }
  };

  const fetchAIStatus = async (whatsappId: string) => {
    try {
      const res = await getContactAIStatus(whatsappId);
      if (res.success) {
        setAiEnabled(res.aiEnabled);
        setContactId(res.contactId || null);
      }
    } catch (err) {
      console.error('Failed to fetch contact AI status', err);
    }
  };
 
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;
 
    try {
      const data = await sendWhatsAppMessage(sessionId, selectedChat.id._serialized, newMessage);
      if (data.success) {
        setNewMessage('');
        // When human manual message is sent, CRM auto-turns off AI (Handoff trigger)
        setAiEnabled(false);
        fetchMessages(selectedChat.id._serialized);
      } else {
        console.error('Failed to send message:', data.error);
      }
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  const handleToggleAI = async () => {
    if (!contactId || togglingAI) return;
    setTogglingAI(true);
    const newStatus = !aiEnabled;
    setAiEnabled(newStatus);

    try {
      const res = await toggleContactAI(contactId, newStatus);
      if (!res.success) {
        setAiEnabled(!newStatus); // revert
        alert(res.error || 'Failed to toggle AI settings.');
      }
    } catch (err) {
      console.error('Failed to toggle AI', err);
      setAiEnabled(!newStatus); // revert
    } finally {
      setTogglingAI(false);
    }
  };

  const handleGetAISuggestion = async () => {
    if (!selectedChat || suggesting) return;
    setSuggesting(true);

    try {
      const res = await getAISuggestedReplyAction(sessionId, selectedChat.id._serialized);
      if (res.success && res.suggestion) {
        setNewMessage(res.suggestion);
      } else {
        alert(res.error || 'Failed to generate suggested reply.');
      }
    } catch (err: any) {
      alert('Error fetching AI suggestion: ' + err.message);
    } finally {
      setSuggesting(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!selectedChat || generatingSummary) return;
    setGeneratingSummary(true);
    setSummary('');

    try {
      const res = await getConversationSummaryAction(sessionId, selectedChat.id._serialized);
      if (res.success && res.summary) {
        setSummary(res.summary);
      } else {
        setSummary('Failed to generate summary: ' + (res.error || 'Unknown error'));
      }
    } catch (err: any) {
      setSummary('Error generating summary: ' + err.message);
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleQualifyLead = async () => {
    if (!selectedChat || qualifying) return;
    setQualifying(true);
    setQualifiedData(null);
    setLeadSaved(false);

    try {
      const res = await getQualifiedLeadAction(sessionId, selectedChat.id._serialized);
      if (res.success && res.leadData) {
        setQualifiedData(res.leadData);
      } else {
        alert(res.error || 'Failed to qualify lead details.');
      }
    } catch (err: any) {
      alert('Error qualifying lead: ' + err.message);
    } finally {
      setQualifying(false);
    }
  };

  const handleSaveLeadDetails = async () => {
    if (!contactId || !qualifiedData || savingLead) return;
    setSavingLead(true);

    try {
      const res = await saveQualifiedLeadDetails(
        contactId,
        qualifiedData.name || '',
        qualifiedData.email || '',
        qualifiedData.notes || ''
      );

      if (res.success) {
        setLeadSaved(true);
      } else {
        alert(res.error || 'Failed to save lead details.');
      }
    } catch (err: any) {
      alert('Error applying lead details: ' + err.message);
    } finally {
      setSavingLead(false);
    }
  };
 
  return (
    <div className="flex h-[calc(100vh-120px)] border rounded-lg overflow-hidden bg-white shadow-sm">
      {/* Sidebar - Chat List */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search chats..." className="pl-8 bg-gray-50/50" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.map((chat) => (
            <div 
              key={chat.id._serialized}
              onClick={() => setSelectedChat(chat)}
              className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${selectedChat?.id._serialized === chat.id._serialized ? 'bg-blue-50/40 border-l-4 border-l-blue-500' : ''}`}
            >
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                  {chat.isGroup ? <Users className="h-5 w-5 text-gray-500" /> : <User className="h-5 w-5 text-gray-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{chat.name}</p>
                  <p className="text-xs text-gray-500 truncate">{chat.lastMessage?.body || 'No messages'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
 
      {/* Main - Message Thread */}
      <div className="flex-1 flex bg-gray-50/50 overflow-hidden">
        {selectedChat ? (
          <div className="flex-1 flex flex-col h-full relative overflow-hidden">
            {/* Thread Header */}
            <div className="p-4 border-b bg-white flex items-center justify-between shadow-sm shrink-0">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                  {selectedChat.isGroup ? <Users className="h-4 w-4 text-gray-500" /> : <User className="h-4 w-4 text-gray-500" />}
                </div>
                <p className="font-bold text-gray-800">{selectedChat.name}</p>
              </div>

              <div className="flex items-center space-x-3">
                {/* AI Chatbot Handoff Switch */}
                <div className="flex items-center space-x-2 bg-gray-50 border px-3 py-1 rounded-full text-xs">
                  <Bot className={`w-3.5 h-3.5 ${aiEnabled ? 'text-green-500 animate-pulse' : 'text-gray-400'}`} />
                  <span className="font-semibold text-gray-600">AI Auto-Reply</span>
                  <button 
                    onClick={handleToggleAI}
                    className={`focus:outline-none transition-all ${togglingAI ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={togglingAI}
                    title={aiEnabled ? "Pause AI Chatbot (Handoff)" : "Resume AI Chatbot"}
                  >
                    {aiEnabled ? (
                      <ToggleRight className="w-6 h-6 text-green-500 hover:text-green-600" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-gray-400 hover:text-gray-500" />
                    )}
                  </button>
                </div>

                {/* AI Copilot Sidepanel Trigger */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowRightPanel(!showRightPanel)}
                  className={`text-xs font-semibold ${showRightPanel ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`}
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" /> AI Copilot
                </Button>
              </div>
            </div>
            
            {/* Message Thread Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div 
                  key={msg.id.id}
                  className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] p-3 rounded-lg text-sm ${msg.fromMe ? 'bg-blue-600 text-white rounded-br-none shadow-sm' : 'bg-white border rounded-bl-none shadow-sm text-gray-800'}`}>
                    <p className="whitespace-pre-line leading-relaxed">{msg.body}</p>
                    <p className={`text-[10px] mt-1.5 opacity-70 ${msg.fromMe ? 'text-right text-blue-100' : 'text-gray-400'}`}>
                      {new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
 
            {/* Footer Input Form */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t flex space-x-2 items-center shrink-0 shadow-sm">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleGetAISuggestion}
                disabled={suggesting}
                title="AI suggested reply"
                className="border-gray-200 text-blue-600 hover:bg-blue-50/50 hover:text-blue-700 shrink-0"
              >
                {suggesting ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
              
              <Input 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..." 
                className="flex-1 bg-gray-50/50"
              />
              
              <Button type="submit" size="icon" className="shrink-0 bg-blue-600 hover:bg-blue-700">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <Bot className="w-12 h-12 text-gray-200 mb-3" />
            <p className="font-medium text-sm">Select a conversation thread to start messaging</p>
          </div>
        )}
      </div>

      {/* AI Copilot Sidepanel Column */}
      {selectedChat && showRightPanel && (
        <div className="w-80 border-l bg-white flex flex-col shrink-0 animate-in slide-in-from-right duration-250">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
            <h3 className="font-bold text-sm flex items-center text-gray-800">
              <Sparkles className="w-4 h-4 mr-1.5 text-blue-500" /> AI Copilot Panel
            </h3>
            <button onClick={() => setShowRightPanel(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {/* Panel Tabs */}
          <div className="flex border-b text-xs font-bold">
            <button
              onClick={() => setActiveRightTab('summary')}
              className={`flex-1 py-2.5 text-center border-b-2 transition-all ${activeRightTab === 'summary' ? 'border-b-blue-500 text-blue-600 bg-blue-50/10' : 'border-b-transparent text-gray-500 hover:bg-gray-50'}`}
            >
              <FileText className="w-3.5 h-3.5 inline mr-1" /> Chat Summary
            </button>
            <button
              onClick={() => setActiveRightTab('qualify')}
              className={`flex-1 py-2.5 text-center border-b-2 transition-all ${activeRightTab === 'qualify' ? 'border-b-blue-500 text-blue-600 bg-blue-50/10' : 'border-b-transparent text-gray-500 hover:bg-gray-50'}`}
            >
              <Users className="w-3.5 h-3.5 inline mr-1" /> Qualify CRM Lead
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeRightTab === 'summary' ? (
              <div className="space-y-4">
                <Button
                  onClick={handleGenerateSummary}
                  disabled={generatingSummary}
                  className="w-full text-xs font-semibold bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  {generatingSummary ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Clock className="w-3.5 h-3.5 mr-1.5" />}
                  Generate Chat Summary
                </Button>
                {summary && (
                  <div className="p-3 bg-gray-50 border rounded-lg text-xs leading-relaxed text-gray-700 whitespace-pre-line shadow-sm">
                    {summary}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Button
                  onClick={handleQualifyLead}
                  disabled={qualifying}
                  className="w-full text-xs font-semibold bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  {qualifying ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Bot className="w-3.5 h-3.5 mr-1.5" />}
                  Qualify Lead (Extract Details)
                </Button>
                
                {qualifiedData && (
                  <div className="space-y-3 bg-gray-50 border border-gray-150 rounded-lg p-3 text-xs shadow-sm">
                    <div className="space-y-1">
                      <span className="font-bold text-gray-500 block uppercase text-[9px]">Full Name</span>
                      <input
                        type="text"
                        value={qualifiedData.name || ''}
                        onChange={(e) => setQualifiedData({ ...qualifiedData, name: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-gray-800"
                        placeholder="No name detected"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="font-bold text-gray-500 block uppercase text-[9px]">Email Address</span>
                      <input
                        type="text"
                        value={qualifiedData.email || ''}
                        onChange={(e) => setQualifiedData({ ...qualifiedData, email: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-gray-800"
                        placeholder="No email detected"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="font-bold text-gray-500 block uppercase text-[9px]">Preferences & Notes</span>
                      <textarea
                        value={qualifiedData.notes || ''}
                        onChange={(e) => setQualifiedData({ ...qualifiedData, notes: e.target.value })}
                        className="w-full h-24 bg-white border border-gray-200 rounded p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 leading-normal resize-none font-medium text-gray-800"
                        placeholder="No preferences/timeline details detected"
                      />
                    </div>

                    <Button
                      onClick={handleSaveLeadDetails}
                      disabled={savingLead || leadSaved}
                      className={`w-full text-xs font-semibold transition-all ${
                        leadSaved 
                          ? 'bg-green-600 hover:bg-green-700 text-white cursor-default' 
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                      size="sm"
                    >
                      {savingLead ? (
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : leadSaved ? (
                        <Check className="w-3.5 h-3.5 mr-1.5" />
                      ) : (
                        <Save className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      {leadSaved ? 'Applied to CRM!' : 'Apply to CRM'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
