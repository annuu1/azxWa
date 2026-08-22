'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { 
  Send, User, Users, Search, Sparkles, Bot, Clock, ToggleLeft, ToggleRight, 
  FileText, Check, CheckCheck, X, Save, RefreshCw, Paperclip, Reply, Copy, Image as ImageIcon,
  ChevronDown, Phone, MessageSquare, Filter, ShieldCheck, CornerDownLeft, AlertCircle, UploadCloud, File
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { getWhatsAppChats, getWhatsAppMessages, sendWhatsAppMessage, sendWhatsAppMediaMessage } from '../../actions/whatsapp-actions';
import { 
  getContactAIStatus, 
  toggleContactAI, 
  getAISuggestedReplyAction, 
  getConversationSummaryAction, 
  getQualifiedLeadAction, 
  saveQualifiedLeadDetails 
} from '@/features/ai/actions/ai-actions';

interface UnifiedInboxProps {
  availableSessions: string[];
}

interface StagedFile {
  name: string;
  size: string;
  type: string;
  dataUrl: string;
}

export default function UnifiedInbox({ availableSessions }: UnifiedInboxProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string>(availableSessions[0] || '');
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [chatTab, setChatTab] = useState<'all' | 'direct' | 'groups'>('all');

  // Reply & File Upload States
  const [replyingToMessage, setReplyingToMessage] = useState<any | null>(null);
  const [stagedFile, setStagedFile] = useState<StagedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Helper to re-order chat list when new message arrives
  const updateChatListWithIncoming = useCallback((incomingMsg: any) => {
    const msgChatId = incomingMsg.chatId || incomingMsg.from;
    if (!msgChatId) return;

    setChats(prevChats => {
      const idx = prevChats.findIndex(c => (c.id?._serialized || c.id) === msgChatId);
      const isCurrentActive = selectedChat && (selectedChat.id?._serialized || selectedChat.id) === msgChatId;
      const snippetText = typeof incomingMsg.body === 'string' ? incomingMsg.body : (incomingMsg.hasMedia ? '📷 Attachment' : 'Message');
      const timestampNum = incomingMsg.timestamp || Math.floor(Date.now() / 1000);

      if (idx === -1) {
        const newChatEntry = {
          id: { _serialized: msgChatId },
          name: incomingMsg.pushName || incomingMsg.contact?.name || msgChatId.split('@')[0],
          isGroup: Boolean(msgChatId.endsWith('@g.us')),
          unreadCount: isCurrentActive || incomingMsg.fromMe ? 0 : 1,
          timestamp: timestampNum,
          lastMessage: {
            body: snippetText,
            timestamp: timestampNum,
          },
        };
        return [newChatEntry, ...prevChats];
      }

      const updatedList = [...prevChats];
      const targetChat = { ...updatedList[idx] };
      targetChat.lastMessage = {
        body: snippetText,
        timestamp: timestampNum,
      };
      targetChat.timestamp = timestampNum;

      if (!incomingMsg.fromMe && !isCurrentActive) {
        targetChat.unreadCount = (targetChat.unreadCount || 0) + 1;
      }

      updatedList.splice(idx, 1);
      updatedList.unshift(targetChat);
      return updatedList;
    });
  }, [selectedChat]);

  // Fetch Chat List
  const fetchChats = useCallback(async (silent = false) => {
    if (!selectedSessionId) return;
    if (!silent) setLoadingChats(true);
    try {
      const data = await getWhatsAppChats(selectedSessionId);
      if (data.success && data.chats) {
        setChats(data.chats);
      } else {
        if (!silent) setChats([]);
      }
    } catch (err) {
      console.error('Failed to fetch chats', err);
    } finally {
      if (!silent) setLoadingChats(false);
    }
  }, [selectedSessionId]);

  // Fetch Messages for active chat
  const fetchMessages = useCallback(async (chatId: string, silent = false) => {
    if (!selectedSessionId || !chatId) return;
    if (!silent) setLoadingMessages(true);
    try {
      const data = await getWhatsAppMessages(selectedSessionId, chatId, 40);
      if (data.success && data.messages) {
        setMessages(prev => {
          if (JSON.stringify(prev.map(m => m.id?._serialized || m.id)) === JSON.stringify(data.messages.map((m: any) => m.id?._serialized || m.id))) {
            return prev;
          }
          return data.messages;
        });
      }
    } catch (err) {
      console.error('Failed to fetch messages', err);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, [selectedSessionId]);

  const fetchAIStatus = useCallback(async (whatsappId: string) => {
    try {
      const res = await getContactAIStatus(whatsappId);
      if (res.success) {
        setAiEnabled(!!res.aiEnabled);
        setContactId(res.contactId || null);
      }
    } catch (err) {
      console.error('Failed to fetch contact AI status', err);
    }
  }, []);

  // Fetch chats on session change
  useEffect(() => {
    fetchChats();
    setSelectedChat(null);
  }, [selectedSessionId, fetchChats]);

  // Fetch messages and AI status on selected chat change
  useEffect(() => {
    if (selectedChat) {
      const chatId = selectedChat.id?._serialized || selectedChat.id;
      fetchMessages(chatId, false);
      fetchAIStatus(chatId);
      
      setReplyingToMessage(null);
      setStagedFile(null);
      setSummary('');
      setQualifiedData(null);
      setLeadSaved(false);
    }
  }, [selectedChat, fetchMessages, fetchAIStatus]);

  // OpenWA Native Protocol Socket.IO Real-Time Connection
  useEffect(() => {
    let socketUrl = process.env.NEXT_PUBLIC_WHATSAPP_ENGINE_URL;
    if (!socketUrl && typeof window !== 'undefined') {
      const proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const host = window.location.hostname;
      socketUrl = `${proto}//${host}:2785`;
    }
    socketUrl = socketUrl || 'http://localhost:2785';

    const apiKey = 'anurag-dev-api-key';

    let socket: Socket | null = null;
    try {
      socket = io(`${socketUrl.replace(/\/+$/, '')}/events`, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        auth: { apiKey },
        extraHeaders: { 'X-API-Key': apiKey },
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('[UnifiedInbox] Socket.IO Connected to OpenWA events gateway');
        // OpenWA protocol requires sending a subscribe request on the message channel
        socket?.emit('message', {
          type: 'subscribe',
          sessionId: '*',
          events: ['*'],
        });
      });

      socket.on('connect_error', (err) => {
        console.warn('[UnifiedInbox] Socket.IO connection warning:', err.message);
      });

      // Handle OpenWA ServerEventEnvelope on message channel
      socket.on('message', (msgEnvelope: any) => {
        if (!msgEnvelope || msgEnvelope.type !== 'event' || !msgEnvelope.payload) return;

        const { event, sessionId: eventSessionId, data } = msgEnvelope.payload;

        if (event === 'message.received' || event === 'message.sent' || event === 'message') {
          const rawMsg: any = data;
          if (!rawMsg) return;

          const chatId = rawMsg.chatId || rawMsg.from;
          const formattedMsg = {
            id: { _serialized: rawMsg.id?._serialized || rawMsg.id },
            from: rawMsg.from,
            to: rawMsg.to,
            fromMe: Boolean(rawMsg.fromMe || rawMsg.isFromMe || event === 'message.sent'),
            body: typeof rawMsg.body === 'string' ? rawMsg.body : (rawMsg.text || rawMsg.caption || ''),
            timestamp: rawMsg.timestamp || rawMsg.t || Math.floor(Date.now() / 1000),
            hasMedia: Boolean(rawMsg.hasMedia || rawMsg.mediaUrl),
            mediaUrl: rawMsg.mediaUrl,
            quotedMsg: rawMsg.quotedMsg || rawMsg.quotedMessage ? {
              id: rawMsg.quotedMsg?.id || rawMsg.quotedMessage?.id,
              body: rawMsg.quotedMsg?.body || rawMsg.quotedMessage?.body || rawMsg.quotedMsg?.text || '',
              sender: rawMsg.quotedMsg?.from || rawMsg.quotedMessage?.from || 'Replied Message',
            } : null,
          };

          // 1. Promote chat in sidebar with updated snippet
          updateChatListWithIncoming({
            chatId,
            body: formattedMsg.body,
            fromMe: formattedMsg.fromMe,
            timestamp: formattedMsg.timestamp,
            hasMedia: formattedMsg.hasMedia,
          });

          // 2. Append to current active thread if chat is selected
          if (selectedChat) {
            const activeChatId = selectedChat.id?._serialized || selectedChat.id;
            if (activeChatId === chatId) {
              setMessages(prev => {
                const exists = prev.some(m => (m.id?._serialized || m.id) === (formattedMsg.id._serialized || formattedMsg.id));
                if (exists) return prev;
                return [...prev, formattedMsg];
              });
            }
          }
        }
      });
    } catch (err) {
      console.warn('[UnifiedInbox] Socket.IO initialization error:', err);
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [selectedSessionId, selectedChat, updateChatListWithIncoming]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Filtered Chats
  const filteredChats = useMemo(() => {
    return chats.filter(chat => {
      const nameMatch = (chat.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (chat.id?._serialized || '').toLowerCase().includes(searchQuery.toLowerCase());
      if (!nameMatch) return false;

      if (chatTab === 'direct') return !chat.isGroup;
      if (chatTab === 'groups') return chat.isGroup;
      return true;
    });
  }, [chats, searchQuery, chatTab]);

  // Native File Select Handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('File size exceeds 15MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = reader.result as string;
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setStagedFile({
        name: file.name,
        size: `${sizeMb} MB`,
        type: file.type,
        dataUrl: resultStr,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Send Message Handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !stagedFile) || !selectedChat || sendingMsg) return;

    const chatId = selectedChat.id?._serialized || selectedChat.id;
    const textToSend = newMessage.trim();
    const currentStagedFile = stagedFile;
    const currentReplyingMsg = replyingToMessage;

    setSendingMsg(true);

    // Optimistic Insertion into UI thread
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: any = {
      id: { _serialized: tempId, id: tempId },
      fromMe: true,
      body: currentStagedFile ? `[Attachment: ${currentStagedFile.name}] ${textToSend}` : textToSend,
      timestamp: Math.floor(Date.now() / 1000),
      hasMedia: Boolean(currentStagedFile),
      mediaUrl: currentStagedFile?.type.startsWith('image') ? currentStagedFile.dataUrl : undefined,
      quotedMsg: currentReplyingMsg ? {
        id: currentReplyingMsg.id?._serialized || currentReplyingMsg.id,
        body: currentReplyingMsg.body,
        sender: currentReplyingMsg.fromMe ? 'You' : (selectedChat.name || chatId.split('@')[0]),
      } : null,
      pending: true,
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    setStagedFile(null);
    setReplyingToMessage(null);

    // Promote in sidebar
    updateChatListWithIncoming({
      chatId,
      body: optimisticMessage.body,
      fromMe: true,
      timestamp: optimisticMessage.timestamp,
    });

    try {
      let data: any;
      if (currentStagedFile) {
        data = await sendWhatsAppMediaMessage(selectedSessionId, chatId, currentStagedFile.dataUrl, textToSend);
      } else {
        const fullText = currentReplyingMsg 
          ? `> ${currentReplyingMsg.body.substring(0, 80)}\n${textToSend}`
          : textToSend;
        data = await sendWhatsAppMessage(selectedSessionId, chatId, fullText);
      }

      if (data.success) {
        await fetchMessages(chatId, true);
        await fetchChats(true);
      } else {
        alert(data.error || 'Failed to send message');
        setMessages(prev => prev.filter(m => m.id?._serialized !== tempId));
      }
    } catch (err: any) {
      alert('Error sending message: ' + err.message);
      setMessages(prev => prev.filter(m => m.id?._serialized !== tempId));
    } finally {
      setSendingMsg(false);
    }
  };

  const handleToggleAI = async () => {
    if (!selectedChat || togglingAI) return;
    const chatId = selectedChat.id?._serialized || selectedChat.id;
    setTogglingAI(true);
    const newStatus = !aiEnabled;
    setAiEnabled(newStatus);

    try {
      const res = await toggleContactAI(contactId || chatId, newStatus);
      if (!res.success) {
        setAiEnabled(!newStatus);
        alert(res.error || 'Failed to toggle AI settings.');
      } else {
        await fetchAIStatus(chatId);
      }
    } catch (err) {
      console.error('Failed to toggle AI', err);
      setAiEnabled(!newStatus);
    } finally {
      setTogglingAI(false);
    }
  };

  const handleGetAISuggestion = async () => {
    if (!selectedChat || suggesting) return;
    const chatId = selectedChat.id?._serialized || selectedChat.id;
    setSuggesting(true);

    try {
      const res = await getAISuggestedReplyAction(selectedSessionId, chatId);
      if (res.success && res.suggestion) {
        setNewMessage(res.suggestion);
      } else {
        alert(res.error || 'Failed to generate AI suggested reply.');
      }
    } catch (err: any) {
      alert('Error fetching AI suggestion: ' + err.message);
    } finally {
      setSuggesting(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!selectedChat || generatingSummary) return;
    const chatId = selectedChat.id?._serialized || selectedChat.id;
    setGeneratingSummary(true);
    setSummary('');

    try {
      const res = await getConversationSummaryAction(selectedSessionId, chatId);
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
    const chatId = selectedChat.id?._serialized || selectedChat.id;
    setQualifying(true);
    setQualifiedData(null);
    setLeadSaved(false);

    try {
      const res = await getQualifiedLeadAction(selectedSessionId, chatId);
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

  const formatChatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] border border-gray-200 rounded-xl overflow-hidden bg-white shadow-xs">
      
      {/* Hidden Native File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" 
        className="hidden" 
      />

      {/* Sidebar - Sessions & Chat List */}
      <div className="w-full lg:w-80 border-r border-gray-200 flex flex-col shrink-0 bg-white">
        
        {/* Session Picker Header */}
        <div className="p-3 border-b border-gray-200 bg-gray-50/70 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Active WhatsApp Session</span>
            <div className="flex items-center space-x-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                ● Live Event Gateway
              </span>
              <button 
                onClick={() => fetchChats(false)} 
                className="p-1 text-gray-400 hover:text-gray-600 rounded-md"
                title="Refresh Chats"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="w-full text-xs font-semibold bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            {availableSessions.map((sess) => (
              <option key={sess} value={sess}>
                📱 {sess}
              </option>
            ))}
          </select>
        </div>

        {/* Sidebar Search Bar */}
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input 
              placeholder="Search conversations..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-gray-50/60 border-gray-200 text-xs focus:bg-white h-8" 
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex p-0.5 bg-gray-100 rounded-lg mt-2 text-[11px] font-medium">
            <button 
              onClick={() => setChatTab('all')}
              className={`flex-1 py-1 text-center rounded-md transition-all ${chatTab === 'all' ? 'bg-white shadow-xs font-bold text-blue-700' : 'text-gray-600 hover:text-gray-900'}`}
            >
              All ({chats.length})
            </button>
            <button 
              onClick={() => setChatTab('direct')}
              className={`flex-1 py-1 text-center rounded-md transition-all ${chatTab === 'direct' ? 'bg-white shadow-xs font-bold text-blue-700' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Direct
            </button>
            <button 
              onClick={() => setChatTab('groups')}
              className={`flex-1 py-1 text-center rounded-md transition-all ${chatTab === 'groups' ? 'bg-white shadow-xs font-bold text-blue-700' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Groups
            </button>
          </div>
        </div>

        {/* Chat List Column */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {loadingChats ? (
            <div className="p-8 text-center text-xs text-gray-400 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 mr-2 animate-spin text-blue-500" /> Loading chats...
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">
              No chat threads found.
            </div>
          ) : (
            filteredChats.map((chat) => {
              const chatId = chat.id?._serialized || chat.id;
              const isSelected = selectedChat?.id?._serialized === chatId || selectedChat?.id === chatId;
              const lastMsgText = typeof chat.lastMessage === 'string'
                ? chat.lastMessage
                : (typeof chat.lastMessage?.body === 'string' ? chat.lastMessage.body : '');
              const lastMsgTime = chat.lastMessage?.timestamp || chat.timestamp;

              return (
                <div 
                  key={chatId}
                  onClick={() => setSelectedChat(chat)}
                  className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors flex items-center space-x-3 ${
                    isSelected ? 'bg-blue-50/50 border-l-4 border-l-blue-600' : ''
                  }`}
                >
                  <div className="h-10 w-10 rounded-full bg-blue-100/70 text-blue-700 flex items-center justify-center shrink-0 font-bold text-sm shadow-2xs">
                    {chat.isGroup ? <Users className="h-5 w-5" /> : <User className="h-5 w-5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <p className="font-bold text-xs text-gray-900 truncate">{chat.name || chatId}</p>
                      {lastMsgTime && (
                        <span className="text-[10px] text-gray-400 shrink-0 ml-1 font-medium">
                          {formatChatTime(lastMsgTime)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-gray-500 truncate flex items-center">
                        {chat.lastMessage?.hasMedia && <ImageIcon className="w-3 h-3 mr-1 text-gray-400 shrink-0" />}
                        {lastMsgText || 'Click to view conversation'}
                      </p>
                      {chat.unreadCount > 0 && (
                        <span className="ml-1 bg-blue-600 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center shrink-0">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Container - Message Thread */}
      <div className="flex-1 flex flex-col bg-gray-50/40 overflow-hidden relative">
        {selectedChat ? (
          <>
            {/* Thread Top Bar Header */}
            <div className="p-3.5 border-b border-gray-200 bg-white flex items-center justify-between shadow-2xs shrink-0">
              <div className="flex items-center space-x-3">
                <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                  {selectedChat.isGroup ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900">{selectedChat.name || (selectedChat.id?._serialized || selectedChat.id)}</p>
                  <p className="text-[11px] text-gray-400 font-mono">
                    {selectedChat.id?._serialized || selectedChat.id}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2.5">
                {/* AI Chatbot Handoff Switch */}
                <div className="flex items-center space-x-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full text-xs">
                  <Bot className={`w-3.5 h-3.5 ${aiEnabled ? 'text-emerald-500 animate-pulse' : 'text-gray-400'}`} />
                  <span className="font-semibold text-[11px] text-gray-600">AI Auto-Reply</span>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleToggleAI();
                    }}
                    disabled={togglingAI}
                    className="focus:outline-hidden transition-all text-gray-500 cursor-pointer"
                    title={aiEnabled ? "Pause AI Chatbot (Human Agent Handoff)" : "Resume AI Chatbot"}
                  >
                    {aiEnabled ? (
                      <ToggleRight className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </div>

                {/* AI Copilot Sidepanel Toggle Button */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowRightPanel(!showRightPanel)}
                  className={`text-xs font-semibold ${showRightPanel ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200'}`}
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-blue-600" /> AI Copilot
                </Button>
              </div>
            </div>

            {/* Message Thread Scroll View */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {loadingMessages ? (
                <div className="text-center py-12 text-xs text-gray-400 flex items-center justify-center">
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin text-blue-500" /> Loading messages...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-16 text-xs text-gray-400">
                  No previous message history found for this chat thread.
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isFromMe = Boolean(msg.fromMe);
                  const quoted = msg.quotedMsg || msg.quotedMessage;

                  return (
                    <div 
                      key={msg.id?._serialized || msg.id || index}
                      className={`flex flex-col ${isFromMe ? 'items-end' : 'items-start'} group`}
                    >
                      <div className={`max-w-[75%] sm:max-w-[65%] rounded-2xl p-3 shadow-2xs relative ${
                        isFromMe 
                          ? 'bg-blue-600 text-white rounded-br-xs' 
                          : 'bg-white border border-gray-200 text-gray-900 rounded-bl-xs'
                      }`}>
                        
                        {/* Quoted Message Box inside Bubble */}
                        {quoted && (
                          <div className={`mb-2 p-2 rounded-r-md border-l-4 text-xs ${
                            isFromMe ? 'bg-blue-700/60 border-l-blue-200 text-blue-50' : 'bg-gray-100 border-l-blue-600 text-gray-700'
                          }`}>
                            <span className="font-bold text-[10px] block opacity-80 uppercase">
                              {quoted.sender || 'Quoted Message'}
                            </span>
                            <p className="line-clamp-2 italic">{quoted.body}</p>
                          </div>
                        )}

                        {/* Media image preview if available */}
                        {msg.hasMedia && (msg.mediaUrl || msg.mimetype?.startsWith('image') || (typeof msg.body === 'string' && msg.body.startsWith('data:image'))) && (
                          <div className="mb-2 rounded-lg overflow-hidden border border-gray-100">
                            <img 
                              src={msg.mediaUrl || (typeof msg.body === 'string' && msg.body.startsWith('data:image') ? msg.body : '')} 
                              alt="Media Attachment" 
                              className="max-h-56 object-cover w-full rounded"
                              onError={(e) => (e.target as HTMLElement).style.display = 'none'} 
                            />
                          </div>
                        )}

                        {/* Text Body */}
                        <p className="text-xs leading-relaxed whitespace-pre-line break-words font-medium">
                          {typeof msg.body === 'string' ? msg.body : ''}
                        </p>

                        {/* Bubble Timestamp & Status Ticks */}
                        <div className={`flex items-center justify-end space-x-1 mt-1 text-[10px] ${isFromMe ? 'text-blue-100' : 'text-gray-400'}`}>
                          <span>
                            {msg.timestamp ? new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                          {isFromMe && (
                            <CheckCheck className="w-3.5 h-3.5 text-blue-200" />
                          )}
                        </div>

                        {/* Hover Action Buttons */}
                        <div className={`absolute top-1 ${isFromMe ? '-left-12' : '-right-12'} opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1 bg-white border border-gray-200 shadow-xs rounded-lg p-0.5 z-10`}>
                          <button 
                            onClick={() => setReplyingToMessage(msg)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600"
                            title="Reply to message"
                          >
                            <Reply className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Footer Input Area */}
            <div className="bg-white border-t border-gray-200 p-3 space-y-2 shrink-0 shadow-xs">
              
              {/* Quoted Message Bar if Replying */}
              {replyingToMessage && (
                <div className="bg-blue-50/70 border-l-4 border-l-blue-600 p-2 rounded-r-lg flex justify-between items-center text-xs animate-in fade-in">
                  <div>
                    <span className="font-bold text-blue-800 text-[10px] uppercase block">Replying to message</span>
                    <p className="text-gray-700 line-clamp-1 italic">{typeof replyingToMessage.body === 'string' ? replyingToMessage.body : ''}</p>
                  </div>
                  <button onClick={() => setReplyingToMessage(null)} className="text-gray-400 hover:text-gray-600 p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Staged File Attachment Preview Box */}
              {stagedFile && (
                <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-lg flex items-center justify-between text-xs animate-in fade-in">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    {stagedFile.type.startsWith('image/') ? (
                      <img src={stagedFile.dataUrl} alt="Preview" className="w-10 h-10 object-cover rounded-md border shrink-0" />
                    ) : (
                      <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-md flex items-center justify-center shrink-0">
                        <File className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-gray-800 truncate text-xs">{stagedFile.name}</p>
                      <p className="text-[10px] text-gray-400">{stagedFile.size}</p>
                    </div>
                  </div>
                  <button onClick={() => setStagedFile(null)} className="text-gray-400 hover:text-red-600 p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Message Input Form */}
              <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                
                {/* Native File Upload Trigger */}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-9 w-9 text-gray-600 border-gray-200 hover:bg-gray-50 shrink-0"
                  title="Upload image or file from device"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>

                {/* 1-Click AI Suggested Reply Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleGetAISuggestion}
                  disabled={suggesting}
                  className="h-9 w-9 border-blue-200 text-blue-600 hover:bg-blue-50 shrink-0"
                  title="Generate 1-Click AI Suggested Reply"
                >
                  {suggesting ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
                
                <Input 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={stagedFile ? `Add caption for ${stagedFile.name}...` : "Type a WhatsApp message..."} 
                  className="flex-1 bg-gray-50/50 border-gray-200 text-xs focus:bg-white h-9"
                />
                
                <Button 
                  type="submit" 
                  disabled={sendingMsg || (!newMessage.trim() && !stagedFile)}
                  className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shrink-0"
                >
                  {sendingMsg ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
            <div className="p-4 bg-gray-100 rounded-full mb-3 text-gray-400">
              <MessageSquare className="w-10 h-10" />
            </div>
            <h3 className="text-base font-bold text-gray-800">No Chat Selected</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-xs">
              Select a WhatsApp conversation from the left sidebar to view message history and use AI Copilot features.
            </p>
          </div>
        )}
      </div>

      {/* Right Column - AI Copilot Sidepanel */}
      {selectedChat && showRightPanel && (
        <div className="w-full lg:w-80 border-l border-gray-200 bg-white flex flex-col shrink-0 animate-in slide-in-from-right duration-200">
          <div className="p-3.5 border-b border-gray-200 flex justify-between items-center bg-gray-50/70">
            <h3 className="font-bold text-xs flex items-center text-gray-900">
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> AI Copilot Workspace
            </h3>
            <button onClick={() => setShowRightPanel(false)} className="text-gray-400 hover:text-gray-600 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {/* Sidepanel Tabs */}
          <div className="flex border-b border-gray-200 text-xs font-bold bg-gray-50/30">
            <button
              onClick={() => setActiveRightTab('summary')}
              className={`flex-1 py-2.5 text-center border-b-2 transition-all ${
                activeRightTab === 'summary' ? 'border-b-blue-600 text-blue-700 bg-white font-bold' : 'border-b-transparent text-gray-500 hover:bg-gray-50'
              }`}
            >
              <FileText className="w-3.5 h-3.5 inline mr-1" /> Summary
            </button>
            <button
              onClick={() => setActiveRightTab('qualify')}
              className={`flex-1 py-2.5 text-center border-b-2 transition-all ${
                activeRightTab === 'qualify' ? 'border-b-blue-600 text-blue-700 bg-white font-bold' : 'border-b-transparent text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Users className="w-3.5 h-3.5 inline mr-1" /> Qualify CRM Lead
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeRightTab === 'summary' ? (
              <div className="space-y-3">
                <Button
                  onClick={handleGenerateSummary}
                  disabled={generatingSummary}
                  className="w-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                  size="sm"
                >
                  {generatingSummary ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Clock className="w-3.5 h-3.5 mr-1.5" />}
                  Generate AI Summary
                </Button>
                {summary && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs leading-relaxed text-gray-700 whitespace-pre-line shadow-2xs">
                    {summary}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Button
                  onClick={handleQualifyLead}
                  disabled={qualifying}
                  className="w-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                  size="sm"
                >
                  {qualifying ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Bot className="w-3.5 h-3.5 mr-1.5" />}
                  Qualify Lead (Extract Info)
                </Button>
                
                {qualifiedData && (
                  <div className="space-y-3 bg-gray-50/70 border border-gray-200 rounded-xl p-3.5 text-xs shadow-2xs">
                    <div className="space-y-1">
                      <span className="font-bold text-gray-400 block uppercase text-[9px]">Full Name</span>
                      <Input
                        type="text"
                        value={qualifiedData.name || ''}
                        onChange={(e) => setQualifiedData({ ...qualifiedData, name: e.target.value })}
                        className="bg-white text-xs h-8"
                        placeholder="No name detected"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="font-bold text-gray-400 block uppercase text-[9px]">Email Address</span>
                      <Input
                        type="text"
                        value={qualifiedData.email || ''}
                        onChange={(e) => setQualifiedData({ ...qualifiedData, email: e.target.value })}
                        className="bg-white text-xs h-8"
                        placeholder="No email detected"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="font-bold text-gray-400 block uppercase text-[9px]">Preferences & Notes</span>
                      <textarea
                        value={qualifiedData.notes || ''}
                        onChange={(e) => setQualifiedData({ ...qualifiedData, notes: e.target.value })}
                        className="w-full h-24 bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500 leading-normal resize-none font-medium text-gray-800"
                        placeholder="No preferences detected"
                      />
                    </div>

                    <Button
                      onClick={handleSaveLeadDetails}
                      disabled={savingLead || leadSaved}
                      className={`w-full text-xs font-semibold shadow-xs ${
                        leadSaved 
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                      size="sm"
                    >
                      {savingLead ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
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
