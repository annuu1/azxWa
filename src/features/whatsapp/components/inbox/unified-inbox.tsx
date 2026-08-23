'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { 
  Send, User, Users, Search, Sparkles, Bot, Clock, ToggleLeft, ToggleRight, 
  FileText, Check, CheckCheck, X, Save, RefreshCw, Paperclip, Reply, Copy, Image as ImageIcon,
  ChevronDown, MessageSquare, ArrowLeft, Smile, Trash2, CornerUpLeft, Download, Maximize2,
  File, Video, Music, MapPin, PhoneCall, AlertCircle
} from 'lucide-react';
import { 
  getWhatsAppChats, 
  getWhatsAppMessages, 
  sendWhatsAppMessage, 
  sendWhatsAppRichMedia,
  reactToWhatsAppMessage,
  deleteWhatsAppMessage,
  replyToWhatsAppMessage,
  getContactProfilePictureAction
} from '../../actions/whatsapp-actions';
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
  base64: string;
  dataUrl: string;
  mediaType: 'image' | 'video' | 'audio' | 'document';
}

const POPULAR_EMOJIS = [
  '😀', '😂', '👍', '❤️', '🔥', '👏', '🙏', '🎉',
  '💡', '🤔', '😍', '😭', '😎', '🚀', '✨', '💯',
  '💪', '🤝', '🙌', '👌', '⭐', '✅', '📞', '📍'
];

const QUICK_REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const SENDER_COLORS = ['#d1416f', '#7c5cff', '#0a86c4', '#1a8f5c', '#c26a00', '#c0392b', '#0e7c86', '#8e44ad'];
const getSenderColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
};

export default function UnifiedInbox({ availableSessions }: UnifiedInboxProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string>(availableSessions[0] || '');
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [chatTab, setChatTab] = useState<'all' | 'direct' | 'groups'>('all');

  const [replyingToMessage, setReplyingToMessage] = useState<any | null>(null);
  const [stagedFile, setStagedFile] = useState<StagedFile | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeReactionMenuMsgId, setActiveReactionMenuMsgId] = useState<string | null>(null);
  const [selectedActionMsgId, setSelectedActionMsgId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lightboxImage, setLightboxImage] = useState<{ src: string; title: string } | null>(null);

  const [aiEnabled, setAiEnabled] = useState(true);
  const [contactId, setContactId] = useState<string | null>(null);
  const [togglingAI, setTogglingAI] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'summary' | 'qualify'>('summary');
  
  const [summary, setSummary] = useState('');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [qualifying, setQualifying] = useState(false);
  const [qualifiedData, setQualifiedData] = useState<{ name?: string; email?: string; notes?: string } | null>(null);
  const [savingLead, setSavingLead] = useState(false);
  const [leadSaved, setLeadSaved] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);

  const updateChatListWithIncoming = useCallback((incomingMsg: any) => {
    const msgChatId = incomingMsg.chatId || incomingMsg.from;
    if (!msgChatId) return;
    const msgClean = msgChatId.split('@')[0];
    setChats(prevChats => {
      const idx = prevChats.findIndex(c => {
        const cId = c.id?._serialized || c.id || '';
        return cId === msgChatId || (msgClean && cId.split('@')[0] === msgClean);
      });
      const activeId = selectedChat ? (selectedChat.id?._serialized || selectedChat.id || '') : '';
      const isCurrentActive = Boolean(activeId && (activeId === msgChatId || (msgClean && activeId.split('@')[0] === msgClean)));
      const snippetText = typeof incomingMsg.body === 'string' ? incomingMsg.body : (incomingMsg.hasMedia ? '📷 Attachment' : 'Message');
      const timestampNum = incomingMsg.timestamp || Math.floor(Date.now() / 1000);
      if (idx === -1) {
        const newChatEntry = {
          id: { _serialized: msgChatId },
          name: incomingMsg.pushName || incomingMsg.contact?.name || msgClean,
          isGroup: Boolean(msgChatId.endsWith('@g.us')),
          unreadCount: isCurrentActive || incomingMsg.fromMe ? 0 : 1,
          timestamp: timestampNum,
          lastMessage: { body: snippetText, timestamp: timestampNum },
        };
        return [newChatEntry, ...prevChats];
      }
      const updatedList = [...prevChats];
      const targetChat = { ...updatedList[idx] };
      targetChat.lastMessage = { body: snippetText, timestamp: timestampNum };
      targetChat.timestamp = timestampNum;
      if (!incomingMsg.fromMe && !isCurrentActive) targetChat.unreadCount = (targetChat.unreadCount || 0) + 1;
      updatedList.splice(idx, 1);
      updatedList.unshift(targetChat);
      return updatedList;
    });
  }, [selectedChat]);

  const fetchChats = useCallback(async (silent = false) => {
    if (!selectedSessionId) return;
    if (!silent) setLoadingChats(true);
    try {
      const data = await getWhatsAppChats(selectedSessionId);
      if (data.success && data.chats) setChats(data.chats);
      else if (!silent) setChats([]);
    } catch (err) { console.error('Failed to fetch chats', err); }
    finally { if (!silent) setLoadingChats(false); }
  }, [selectedSessionId]);

  const fetchMessages = useCallback(async (chatId: string, silent = false) => {
    if (!selectedSessionId || !chatId) return;
    if (!silent) setLoadingMessages(true);
    try {
      const data = await getWhatsAppMessages(selectedSessionId, chatId, 50);
      if (data.success && data.messages) setMessages(data.messages);
    } catch (err) { console.error('Failed to fetch messages', err); }
    finally { if (!silent) setLoadingMessages(false); }
  }, [selectedSessionId]);

  const fetchAIStatus = useCallback(async (whatsappId: string) => {
    try {
      const res = await getContactAIStatus(whatsappId);
      if (res.success) {
        setAiEnabled(!!res.aiEnabled);
        setContactId(res.contactId || null);
      }
    } catch (err) { console.error('Failed to fetch contact AI status', err); }
  }, []);

  useEffect(() => {
    fetchChats();
    setSelectedChat(null);
  }, [selectedSessionId, fetchChats]);

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
      setShowEmojiPicker(false);
    }
  }, [selectedChat, fetchMessages, fetchAIStatus]);

  useEffect(() => {
    if (!selectedSessionId) return;
    const sseUrl = `/api/whatsapp/events?sessionId=${encodeURIComponent(selectedSessionId)}`;
    const eventSource = new EventSource(sseUrl);
    eventSource.onmessage = (e) => {
      if (!e.data || e.data.trim().startsWith(':')) return;
      try {
        const payload = JSON.parse(e.data);
        const { sessionId: eventSessionId, data: rawMsg } = payload;
        if (eventSessionId && selectedSessionId && eventSessionId !== selectedSessionId) return;
        if (!rawMsg) return;
        const chatId = rawMsg.chatId || (rawMsg.fromMe ? rawMsg.to : rawMsg.from);
        const formattedMsg = {
          id: { _serialized: rawMsg.id?._serialized || rawMsg.id || `msg-${Date.now()}` },
          waMessageId: rawMsg.waMessageId || rawMsg.id?._serialized || rawMsg.id,
          from: rawMsg.from,
          to: rawMsg.to,
          fromMe: Boolean(rawMsg.fromMe),
          body: typeof rawMsg.body === 'string' ? rawMsg.body : (rawMsg.text || rawMsg.caption || ''),
          timestamp: rawMsg.timestamp || Math.floor(Date.now() / 1000),
          status: rawMsg.status || (rawMsg.fromMe ? 'sent' : 'delivered'),
          type: rawMsg.type || (rawMsg.hasMedia ? 'image' : 'text'),
          hasMedia: Boolean(rawMsg.hasMedia || rawMsg.mediaUrl || rawMsg.media),
          mediaUrl: rawMsg.mediaUrl || (rawMsg.media?.data ? (rawMsg.media.data.startsWith('data:') ? rawMsg.media.data : `data:${rawMsg.media.mimetype};base64,${rawMsg.media.data}`) : undefined),
          media: rawMsg.media,
          reactions: rawMsg.reactions || {},
          quotedMsg: rawMsg.quotedMsg || rawMsg.quotedMessage || null,
        };
        updateChatListWithIncoming({
          chatId,
          body: formattedMsg.body,
          fromMe: formattedMsg.fromMe,
          timestamp: formattedMsg.timestamp,
        });
        if (selectedChat) {
          const activeChatId = selectedChat.id?._serialized || selectedChat.id || '';
          if (activeChatId === chatId || activeChatId.split('@')[0] === chatId.split('@')[0]) {
            setMessages(prev => {
              const exists = prev.some(m => (m.id?._serialized || m.id) === (formattedMsg.id._serialized || formattedMsg.id));
              if (exists) return prev;
              return [...prev, formattedMsg];
            });
          }
        }
      } catch (err) { console.error('[UnifiedInbox] Failed to parse SSE event:', err); }
    };
    return () => eventSource.close();
  }, [selectedSessionId, selectedChat, updateChatListWithIncoming]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      setShowJumpToBottom(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 18 * 1024 * 1024) { alert('File size exceeds 18MB limit.'); return; }
    let mediaType: 'image' | 'video' | 'audio' | 'document' = 'document';
    if (file.type.startsWith('image/')) mediaType = 'image';
    else if (file.type.startsWith('video/')) mediaType = 'video';
    else if (file.type.startsWith('audio/')) mediaType = 'audio';
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setStagedFile({ name: file.name, size: `${sizeMb} MB`, type: file.type, base64, dataUrl, mediaType });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !stagedFile) || !selectedChat || sendingMsg) return;
    const chatId = selectedChat.id?._serialized || selectedChat.id;
    const textToSend = newMessage.trim();
    const currentStagedFile = stagedFile;
    const currentReplyingMsg = replyingToMessage;
    const quotedId = currentReplyingMsg?.waMessageId || currentReplyingMsg?.id?._serialized || currentReplyingMsg?.id;
    setSendingMsg(true);
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: any = {
      id: { _serialized: tempId, id: tempId },
      waMessageId: tempId,
      fromMe: true,
      body: currentStagedFile ? (textToSend || currentStagedFile.name) : textToSend,
      type: currentStagedFile ? currentStagedFile.mediaType : 'text',
      timestamp: Math.floor(Date.now() / 1000),
      status: 'pending',
      hasMedia: Boolean(currentStagedFile),
      mediaUrl: currentStagedFile?.dataUrl,
      media: currentStagedFile ? { filename: currentStagedFile.name, mimetype: currentStagedFile.type } : undefined,
      quotedMsg: currentReplyingMsg ? { id: quotedId, body: currentReplyingMsg.body, sender: currentReplyingMsg.fromMe ? 'You' : (selectedChat.name || chatId.split('@')[0]) } : null,
    };
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    setStagedFile(null);
    setReplyingToMessage(null);
    setShowEmojiPicker(false);
    updateChatListWithIncoming({ chatId, body: optimisticMessage.body, fromMe: true, timestamp: optimisticMessage.timestamp });
    try {
      let res: any;
      if (currentStagedFile) {
        res = await sendWhatsAppRichMedia(selectedSessionId, chatId, currentStagedFile.mediaType, {
          base64: currentStagedFile.base64, mimetype: currentStagedFile.type, filename: currentStagedFile.name, caption: textToSend || undefined, quotedMessageId: quotedId || undefined,
        });
      } else if (quotedId) {
        res = await replyToWhatsAppMessage(selectedSessionId, chatId, quotedId, textToSend);
      } else {
        res = await sendWhatsAppMessage(selectedSessionId, chatId, textToSend);
      }
      if (res.success) {
        setMessages(prev => prev.map(m => m.id?._serialized === tempId ? { ...m, status: 'sent', id: { _serialized: res.messageId || tempId } } : m));
      } else {
        alert(res.error || 'Failed to send message');
        setMessages(prev => prev.filter(m => m.id?._serialized !== tempId));
      }
    } catch (err: any) { alert('Error sending message: ' + err.message); setMessages(prev => prev.filter(m => m.id?._serialized !== tempId)); }
    finally { setSendingMsg(false); }
  };

  const handleReact = async (msg: any, emoji: string) => {
    if (!selectedChat) return;
    const chatId = selectedChat.id?._serialized || selectedChat.id;
    const messageId = msg.waMessageId || msg.id?._serialized || msg.id;
    if (!messageId) return;
    setActiveReactionMenuMsgId(null);
    setMessages(prev => prev.map(m => {
      const curId = m.waMessageId || m.id?._serialized || m.id;
      if (curId === messageId) {
        const reactions = { ...(m.reactions || m.metadata?.reactions || {}) };
        reactions['me'] = emoji;
        return { ...m, reactions };
      }
      return m;
    }));
    try { await reactToWhatsAppMessage(selectedSessionId, chatId, messageId, emoji); }
    catch (err) { console.error('Failed to send reaction:', err); }
  };

  const handleDeleteMessage = async (msg: any) => {
    if (!selectedChat) return;
    const chatId = selectedChat.id?._serialized || selectedChat.id;
    const messageId = msg.waMessageId || msg.id?._serialized || msg.id;
    if (!messageId) return;
    if (!confirm('Are you sure you want to delete this message for everyone?')) return;
    setMessages(prev => prev.map(m => {
      const curId = m.waMessageId || m.id?._serialized || m.id;
      if (curId === messageId) return { ...m, type: 'revoked', body: '🗑️ This message was deleted' };
      return m;
    }));
    try { await deleteWhatsAppMessage(selectedSessionId, chatId, messageId, true); }
    catch (err) { console.error('Failed to delete message:', err); }
  };

  const handleCopyText = (msg: any) => {
    const text = typeof msg.body === 'string' ? msg.body : '';
    if (text) {
      navigator.clipboard.writeText(text);
      const mId = msg.id?._serialized || msg.id;
      setCopiedMsgId(mId);
      setTimeout(() => setCopiedMsgId(null), 1500);
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
      if (!res.success) { setAiEnabled(!newStatus); alert(res.error || 'Failed to toggle AI settings.'); }
      else { await fetchAIStatus(chatId); }
    } catch (err) { console.error('Failed to toggle AI', err); setAiEnabled(!newStatus); }
    finally { setTogglingAI(false); }
  };

  const handleGetAISuggestion = async () => {
    if (!selectedChat || suggesting) return;
    const chatId = selectedChat.id?._serialized || selectedChat.id;
    setSuggesting(true);
    try {
      const res = await getAISuggestedReplyAction(selectedSessionId, chatId);
      if (res.success && res.suggestion) setNewMessage(res.suggestion);
      else alert(res.error || 'Failed to generate AI suggested reply.');
    } catch (err: any) { alert('Error fetching AI suggestion: ' + err.message); }
    finally { setSuggesting(false); }
  };

  const handleGenerateSummary = async () => {
    if (!selectedChat || generatingSummary) return;
    const chatId = selectedChat.id?._serialized || selectedChat.id;
    setGeneratingSummary(true);
    setSummary('');
    try {
      const res = await getConversationSummaryAction(selectedSessionId, chatId);
      if (res.success && res.summary) setSummary(res.summary);
      else setSummary('Failed to generate summary: ' + (res.error || 'Unknown error'));
    } catch (err: any) { setSummary('Error generating summary: ' + err.message); }
    finally { setGeneratingSummary(false); }
  };

  const handleQualifyLead = async () => {
    if (!selectedChat || qualifying) return;
    const chatId = selectedChat.id?._serialized || selectedChat.id;
    setQualifying(true);
    setQualifiedData(null);
    setLeadSaved(false);
    try {
      const res = await getQualifiedLeadAction(selectedSessionId, chatId);
      if (res.success && res.leadData) setQualifiedData(res.leadData);
      else alert(res.error || 'Failed to qualify lead details.');
    } catch (err: any) { alert('Error qualifying lead: ' + err.message); }
    finally { setQualifying(false); }
  };

  const handleSaveLeadDetails = async () => {
    if (!contactId || !qualifiedData || savingLead) return;
    setSavingLead(true);
    try {
      const res = await saveQualifiedLeadDetails(contactId, qualifiedData.name || '', qualifiedData.email || '', qualifiedData.notes || '');
      if (res.success) setLeadSaved(true);
      else alert(res.error || 'Failed to save lead details.');
    } catch (err: any) { alert('Error applying lead details: ' + err.message); }
    finally { setSavingLead(false); }
  };

  const formatChatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full border border-gray-200 rounded-xl sm:rounded-2xl overflow-hidden bg-white shadow-xs">
      <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" />
      <div className={`w-full lg:w-80 border-r border-gray-200 flex-col shrink-0 bg-white h-full ${selectedChat ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-3 border-b border-gray-200 bg-gray-50/70 space-y-2 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Active WhatsApp Session</span>
            <div className="flex items-center space-x-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">● Live Gateway</span>
              <button onClick={() => fetchChats(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-md transition-colors" title="Refresh Chats">
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>
          <select value={selectedSessionId} onChange={(e) => setSelectedSessionId(e.target.value)} className="w-full text-xs font-semibold bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500">
            {availableSessions.map((sess) => <option key={sess} value={sess}>📱 {sess}</option>)}
          </select>
        </div>
        <div className="p-3 border-b border-gray-100 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input placeholder="Search conversations..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 bg-gray-50/60 border-gray-200 text-xs focus:bg-white h-8" />
          </div>
          <div className="flex p-0.5 bg-gray-100 rounded-lg mt-2 text-[11px] font-medium">
            <button onClick={() => setChatTab('all')} className={`flex-1 py-1 text-center rounded-md transition-all ${chatTab === 'all' ? 'bg-white shadow-xs font-bold text-blue-700' : 'text-gray-600 hover:text-gray-900'}`}>All</button>
            <button onClick={() => setChatTab('direct')} className={`flex-1 py-1 text-center rounded-md transition-all ${chatTab === 'direct' ? 'bg-white shadow-xs font-bold text-blue-700' : 'text-gray-600 hover:text-gray-900'}`}>Direct</button>
            <button onClick={() => setChatTab('groups')} className={`flex-1 py-1 text-center rounded-md transition-all ${chatTab === 'groups' ? 'bg-white shadow-xs font-bold text-blue-700' : 'text-gray-600 hover:text-gray-900'}`}>Groups</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 min-h-0">
          {loadingChats ? <div className="p-8 text-center text-xs text-gray-400">Loading chats...</div> : filteredChats.map((chat) => {
            const chatId = chat.id?._serialized || chat.id;
            const isSelected = selectedChat?.id?._serialized === chatId || selectedChat?.id === chatId;
            return (
              <div key={chatId} onClick={() => setSelectedChat(chat)} className={`p-3 cursor-pointer hover:bg-gray-50 flex items-center space-x-3 ${isSelected ? 'bg-blue-50/50 border-l-4 border-l-blue-600' : ''}`}>
                <div className="h-10 w-10 rounded-full bg-blue-100/70 text-blue-700 flex items-center justify-center shrink-0 font-bold text-sm shadow-2xs">
                  {chat.isGroup ? <Users className="h-5 w-5" /> : <User className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <p className="font-bold text-xs text-gray-900 truncate">{chat.name || chatId}</p>
                    <span className="text-[10px] text-gray-400 shrink-0 ml-1 font-medium">{formatChatTime(chat.lastMessage?.timestamp || chat.timestamp)}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 truncate">{chat.lastMessage?.body || 'No messages yet'}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className={`flex-1 flex-col bg-gray-50/40 overflow-hidden relative h-full ${selectedChat ? 'flex' : 'hidden lg:flex'}`}>
        {selectedChat ? (
          <>
            <div className="p-2.5 sm:p-3.5 border-b border-gray-200 bg-white flex items-center justify-between shadow-2xs shrink-0 gap-2">
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                <Button variant="ghost" size="icon" onClick={() => setSelectedChat(null)} className="lg:hidden h-8 w-8 -ml-1 text-gray-700 hover:bg-gray-100 shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                  {selectedChat.isGroup ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-xs sm:text-sm text-gray-900 truncate">{selectedChat.name || (selectedChat.id?._serialized || selectedChat.id)}</p>
                </div>
              </div>
              <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0">
                <div className="flex items-center space-x-1 bg-gray-50 border border-gray-200 px-2 py-1 rounded-full text-xs">
                  <Bot className={`w-3.5 h-3.5 ${aiEnabled ? 'text-emerald-500 animate-pulse' : 'text-gray-400'}`} />
                  <button onClick={handleToggleAI} className="focus:outline-hidden transition-all text-gray-500 cursor-pointer ml-1">
                    {aiEnabled ? <ToggleRight className="w-5 h-5 text-emerald-600" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                  </button>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowRightPanel(!showRightPanel)} className={`text-[11px] font-semibold h-8 ${showRightPanel ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}>
                  <Sparkles className="w-3.5 h-3.5 sm:mr-1 text-blue-600" /> <span className="hidden sm:inline">AI Copilot</span>
                </Button>
              </div>
            </div>
            {/* Message Thread Scroll View */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 relative" ref={messagesContainerRef}>
              {showJumpToBottom && (
                <button 
                  type="button" 
                  onClick={scrollToBottom} 
                  className="fixed bottom-20 right-6 sm:right-8 z-30 bg-white border border-gray-200 text-gray-600 hover:text-blue-600 p-2 rounded-full shadow-lg transition-all" 
                  title="Scroll to bottom"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              )}

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
                  const msgId = msg.id?._serialized || msg.id || `msg-${index}`;
                  const isRevoked = msg.type === 'revoked';
                  const reactions = msg.reactions || msg.metadata?.reactions || {};
                  const reactionEntries = Object.entries(reactions);
                  const showSender = Boolean(selectedChat?.isGroup && !isFromMe && (msg.author || msg.from) && (!messages[index - 1] || messages[index - 1].fromMe || messages[index - 1].from !== msg.from));
                  const senderDisplayName = msg.author?.split('@')[0] || msg.from?.split('@')[0];
                  const isReactionOpen = activeReactionMenuMsgId === msgId;

                  return (
                    <div key={msgId} className={`flex flex-col ${isFromMe ? 'items-end' : 'items-start'} group relative`}>
                      {showSender && (
                        <span className="text-[10px] font-bold mb-1 ml-1" style={{ color: getSenderColor(senderDisplayName) }}>
                          {senderDisplayName}
                        </span>
                      )}

                      {/* Quick Emoji Reaction Popover (Floats above bubble) */}
                      {isReactionOpen && (
                        <div className={`mb-1.5 flex items-center space-x-1 bg-white border border-gray-200 shadow-xl rounded-full px-2 py-1 z-30 animate-in fade-in zoom-in-95`}>
                          {QUICK_REACTION_EMOJIS.map(emoji => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleReact(msg, emoji)}
                              className="p-1 hover:scale-130 transition-transform text-base"
                            >
                              {emoji}
                            </button>
                          ))}
                          <button 
                            type="button"
                            onClick={() => setActiveReactionMenuMsgId(null)}
                            className="text-gray-400 hover:text-gray-600 p-0.5 ml-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <div className={`flex items-center space-x-1.5 max-w-[90%] sm:max-w-[75%] relative`}>
                        {/* Action buttons on hover/touch for OUTGOING message (placed on LEFT side of bubble) */}
                        {isFromMe && !isRevoked && (
                          <div className={`${selectedActionMsgId === msgId ? 'opacity-100 flex' : 'opacity-0 group-hover:opacity-100 hidden sm:flex'} transition-opacity items-center space-x-0.5 bg-white border border-gray-200 shadow-md rounded-full p-0.5 shrink-0 z-20`}>
                            <button 
                              type="button" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveReactionMenuMsgId(isReactionOpen ? null : msgId);
                              }} 
                              className="p-1 hover:bg-gray-100 rounded-full text-gray-500 hover:text-amber-500" 
                              title="React"
                            >
                              <Smile className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              type="button" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setReplyingToMessage(msg);
                              }} 
                              className="p-1 hover:bg-gray-100 rounded-full text-gray-500 hover:text-blue-600" 
                              title="Reply"
                            >
                              <CornerUpLeft className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              type="button" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyText(msg);
                              }} 
                              className="p-1 hover:bg-gray-100 rounded-full text-gray-500 hover:text-blue-600" 
                              title="Copy text"
                            >
                              {copiedMsgId === msgId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <button 
                              type="button" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMessage(msg);
                              }} 
                              className="p-1 hover:bg-red-50 rounded-full text-gray-400 hover:text-red-600" 
                              title="Delete for everyone"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Message Bubble Body */}
                        <div 
                          onClick={() => setSelectedActionMsgId(selectedActionMsgId === msgId ? null : msgId)}
                          className={`rounded-2xl p-3 shadow-2xs relative cursor-pointer select-text ${
                            isFromMe 
                              ? 'bg-blue-600 text-white rounded-br-xs' 
                              : 'bg-white border border-gray-200 text-gray-900 rounded-bl-xs'
                          }`}
                        >
                          {/* Quoted Message Box inside Bubble */}
                          {quoted && (
                            <div className={`mb-2 p-2 rounded-r-md border-l-4 text-xs ${
                              isFromMe ? 'bg-blue-700/60 border-l-blue-200 text-blue-50' : 'bg-gray-100 border-l-blue-600 text-gray-700'
                            }`}>
                              <span className="font-bold text-[10px] block opacity-80 uppercase">
                                {quoted.sender || 'Quoted Message'}
                              </span>
                              <p className="line-clamp-2 italic">{typeof quoted.body === 'string' ? quoted.body : ''}</p>
                            </div>
                          )}

                          {/* Image Media Render */}
                          {msg.hasMedia && (msg.type === 'image' || msg.type === 'sticker' || msg.mediaUrl?.startsWith('data:image') || msg.media?.mimetype?.startsWith('image/')) && (
                            <div 
                              className="mb-2 rounded-lg overflow-hidden border border-gray-100 cursor-pointer relative group/img" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxImage({ src: msg.mediaUrl || msg.body, title: msg.media?.filename || 'Photo' });
                              }}
                            >
                              <img src={msg.mediaUrl || msg.body} alt="Media" className="max-h-64 object-cover w-full rounded hover:opacity-95 transition-opacity" />
                              <div className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover/img:opacity-100">
                                <Maximize2 className="w-3.5 h-3.5" />
                              </div>
                            </div>
                          )}

                          {/* Video Media Render */}
                          {msg.hasMedia && (msg.type === 'video' || msg.media?.mimetype?.startsWith('video/')) && (
                            <video src={msg.mediaUrl || msg.body} controls className="max-h-64 w-full rounded mb-2" onClick={(e) => e.stopPropagation()} />
                          )}

                          {/* Audio / Voice Note Media Render */}
                          {msg.hasMedia && (msg.type === 'audio' || msg.type === 'voice' || msg.media?.mimetype?.startsWith('audio/')) && (
                            <div className="mb-2 p-1.5 bg-black/5 rounded-lg flex items-center" onClick={(e) => e.stopPropagation()}>
                              <audio src={msg.mediaUrl || msg.body} controls className="w-full h-8" />
                            </div>
                          )}

                          {/* Document Media Render */}
                          {msg.hasMedia && (msg.type === 'document' || msg.media?.filename) && (
                            <a 
                              href={msg.mediaUrl || msg.body} 
                              download={msg.media?.filename || 'document'} 
                              onClick={(e) => e.stopPropagation()}
                              className={`mb-2 p-2.5 rounded-lg flex items-center space-x-2.5 border ${
                                isFromMe ? 'bg-blue-700/50 border-blue-400/40 text-white' : 'bg-gray-50 border-gray-200 text-gray-800'
                              }`}
                            >
                              <File className="w-6 h-6 text-blue-400 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-xs truncate">{msg.media?.filename || msg.body || 'Document'}</p>
                                <span className="text-[10px] opacity-75">Click to download</span>
                              </div>
                              <Download className="w-4 h-4 shrink-0 opacity-80" />
                            </a>
                          )}

                          {/* Text Body */}
                          {isRevoked ? (
                            <p className="text-xs italic opacity-75">🗑️ This message was deleted</p>
                          ) : (
                            msg.body && !msg.hasMedia && (
                              <p className="text-xs leading-relaxed font-medium whitespace-pre-line break-words">
                                {typeof msg.body === 'string' ? msg.body : ''}
                              </p>
                            )
                          )}

                          {/* Bubble Timestamp & Status */}
                          <div className={`flex items-center justify-end space-x-1 mt-1 text-[10px] ${isFromMe ? 'text-blue-100' : 'text-gray-400'}`}>
                            <span>{msg.timestamp ? new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                            {isFromMe && (
                              msg.status === 'pending' ? <Clock className="w-3 h-3 text-blue-200" /> : <CheckCheck className="w-3.5 h-3.5 text-blue-200" />
                            )}
                          </div>

                          {/* Reaction Badge at bottom of bubble */}
                          {reactionEntries.length > 0 && (
                            <div className="absolute -bottom-2.5 right-2 bg-white border border-gray-200 rounded-full px-1.5 py-0.5 text-xs z-10 shadow-sm flex items-center space-x-0.5">
                              {reactionEntries.slice(0, 3).map(([k, emoji]: any, i) => <span key={i}>{emoji}</span>)}
                              {reactionEntries.length > 1 && <span className="text-[9px] font-bold text-gray-500 ml-0.5">{reactionEntries.length}</span>}
                            </div>
                          )}
                        </div>

                        {/* Action buttons on hover/touch for INCOMING message (placed on RIGHT side of bubble) */}
                        {!isFromMe && !isRevoked && (
                          <div className={`${selectedActionMsgId === msgId ? 'opacity-100 flex' : 'opacity-0 group-hover:opacity-100 hidden sm:flex'} transition-opacity items-center space-x-0.5 bg-white border border-gray-200 shadow-md rounded-full p-0.5 shrink-0 z-20`}>
                            <button 
                              type="button" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveReactionMenuMsgId(isReactionOpen ? null : msgId);
                              }} 
                              className="p-1 hover:bg-gray-100 rounded-full text-gray-500 hover:text-amber-500" 
                              title="React"
                            >
                              <Smile className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              type="button" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setReplyingToMessage(msg);
                              }} 
                              className="p-1 hover:bg-gray-100 rounded-full text-gray-500 hover:text-blue-600" 
                              title="Reply"
                            >
                              <CornerUpLeft className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              type="button" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyText(msg);
                              }} 
                              className="p-1 hover:bg-gray-100 rounded-full text-gray-500 hover:text-blue-600" 
                              title="Copy text"
                            >
                              {copiedMsgId === msgId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Footer Input Area with Emojis, AI Suggestions & File Attachments */}
            <div className="bg-white border-t border-gray-200 p-2 sm:p-3 space-y-2 shrink-0 relative">
              {/* Quoted Message Preview Bar */}
              {replyingToMessage && (
                <div className="bg-blue-50/80 border-l-4 border-l-blue-600 p-2 rounded-r-lg flex justify-between items-center text-xs animate-in fade-in">
                  <div className="min-w-0 flex-1 pr-2">
                    <span className="font-bold text-blue-800 text-[10px] uppercase block">
                      Replying to {replyingToMessage.fromMe ? 'yourself' : (selectedChat.name || 'contact')}
                    </span>
                    <p className="text-gray-700 line-clamp-1 italic text-xs">
                      {typeof replyingToMessage.body === 'string' ? replyingToMessage.body : (replyingToMessage.hasMedia ? '📷 Attachment' : '')}
                    </p>
                  </div>
                  <button onClick={() => setReplyingToMessage(null)} className="text-gray-400 hover:text-gray-600 p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Staged File Preview */}
              {stagedFile && (
                <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-lg flex items-center justify-between text-xs animate-in fade-in">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    {stagedFile.mediaType === 'image' ? (
                      <img src={stagedFile.dataUrl} alt="Preview" className="w-9 h-9 object-cover rounded-md border shrink-0" />
                    ) : (
                      <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-md flex items-center justify-center shrink-0">
                        <File className="w-4 h-4" />
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

              {/* Emoji Picker Popover */}
              {showEmojiPicker && (
                <div className="absolute bottom-full mb-2 left-2 bg-white border border-gray-200 rounded-xl shadow-2xl p-2.5 z-40 w-72 animate-in fade-in zoom-in-95">
                  <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-gray-100">
                    <span className="text-[11px] font-bold text-gray-600">Emojis</span>
                    <button onClick={() => setShowEmojiPicker(false)} className="text-gray-400 hover:text-gray-600 p-0.5">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-8 gap-1">
                    {POPULAR_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewMessage(p => p + emoji)}
                        className="h-7 w-7 text-base hover:bg-gray-100 rounded flex items-center justify-center transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Composer Form with All Actions */}
              <form onSubmit={handleSendMessage} className="flex items-center space-x-1.5 sm:space-x-2">
                {/* File Attachment Button */}
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon" 
                  onClick={() => fileInputRef.current?.click()} 
                  className="h-8 w-8 sm:h-9 sm:w-9 text-gray-600 border-gray-200 hover:bg-gray-50 shrink-0"
                  title="Upload Image, Video, Audio or Document"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>

                {/* Emoji Picker Button */}
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                  className={`h-8 w-8 sm:h-9 sm:w-9 border-gray-200 hover:bg-gray-50 shrink-0 ${showEmojiPicker ? 'bg-gray-100 text-blue-600' : 'text-gray-600'}`}
                  title="Insert Emoji"
                >
                  <Smile className="h-4 w-4" />
                </Button>

                {/* 1-Click AI Suggested Reply Button (Sparkles) */}
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon" 
                  onClick={handleGetAISuggestion} 
                  disabled={suggesting}
                  className="h-8 w-8 sm:h-9 sm:w-9 border-blue-200 text-blue-600 hover:bg-blue-50 shrink-0 bg-blue-50/40"
                  title="Generate AI Suggested Reply"
                >
                  {suggesting ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-blue-600" />
                  )}
                </Button>

                {/* Message Input Field */}
                <Input 
                  value={newMessage} 
                  onChange={(e) => setNewMessage(e.target.value)} 
                  placeholder={stagedFile ? `Add caption for ${stagedFile.name}...` : "Type a WhatsApp message..."} 
                  className="flex-1 bg-gray-50/50 border-gray-200 text-xs focus:bg-white h-8 sm:h-9" 
                />

                {/* Send Button */}
                <Button 
                  type="submit" 
                  disabled={sendingMsg || (!newMessage.trim() && !stagedFile)} 
                  className="h-8 sm:h-9 px-3 sm:px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shrink-0"
                >
                  {sendingMsg ? <RefreshCw className="animate-spin w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
            <MessageSquare className="w-10 h-10 mb-3" />
            <h3 className="font-bold text-gray-800">No Chat Selected</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-xs">
              Select a conversation to view message history, react with emojis, reply, and use AI features.
            </p>
          </div>
        )}
      </div>

      {/* AI Copilot Sidepanel */}
      {selectedChat && showRightPanel && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs lg:static lg:bg-transparent lg:inset-auto">
          <div className="w-full max-w-xs sm:max-w-sm lg:w-80 border-l border-gray-200 bg-white flex flex-col shrink-0 h-full shadow-2xl lg:shadow-none animate-in slide-in-from-right duration-200">
            <div className="p-3.5 border-b border-gray-200 flex justify-between items-center bg-gray-50/70">
              <h3 className="font-bold text-xs flex items-center text-gray-900">
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> AI Copilot Workspace
              </h3>
              <button onClick={() => setShowRightPanel(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <Button 
                onClick={handleGenerateSummary} 
                disabled={generatingSummary}
                className="w-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs" 
                size="sm"
              >
                {generatingSummary ? <RefreshCw className="animate-spin mr-1.5 w-3.5 h-3.5" /> : <Clock className="mr-1.5 w-3.5 h-3.5" />} Generate AI Summary
              </Button>
              {summary && <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs leading-relaxed text-gray-700 whitespace-pre-line">{summary}</div>}
              
              <Button 
                onClick={handleQualifyLead} 
                disabled={qualifying}
                className="w-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs" 
                size="sm"
              >
                {qualifying ? <RefreshCw className="animate-spin mr-1.5 w-3.5 h-3.5" /> : <Bot className="mr-1.5 w-3.5 h-3.5" />} Qualify Lead
              </Button>
              
              {qualifiedData && (
                <div className="space-y-3 bg-gray-50/70 border border-gray-200 rounded-xl p-3.5 text-xs">
                  <Input 
                    type="text" 
                    value={qualifiedData.name || ''} 
                    onChange={(e) => setQualifiedData({ ...qualifiedData, name: e.target.value })} 
                    className="bg-white text-xs h-8" 
                    placeholder="Full Name" 
                  />
                  <Input 
                    type="text" 
                    value={qualifiedData.email || ''} 
                    onChange={(e) => setQualifiedData({ ...qualifiedData, email: e.target.value })} 
                    className="bg-white text-xs h-8" 
                    placeholder="Email Address" 
                  />
                  <textarea 
                    value={qualifiedData.notes || ''} 
                    onChange={(e) => setQualifiedData({ ...qualifiedData, notes: e.target.value })} 
                    className="w-full h-20 bg-white border border-gray-200 rounded-lg p-2 text-xs resize-none" 
                    placeholder="Preferences / Notes" 
                  />
                  <Button 
                    onClick={handleSaveLeadDetails} 
                    disabled={savingLead || leadSaved} 
                    className="w-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white" 
                    size="sm"
                  >
                    {savingLead ? <RefreshCw className="animate-spin mr-1.5 w-3.5 h-3.5" /> : leadSaved ? <Check className="mr-1.5 w-3.5 h-3.5" /> : <Save className="mr-1.5 w-3.5 h-3.5" />}
                    {leadSaved ? 'Applied to CRM!' : 'Apply to CRM'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh] bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 bg-neutral-800 text-white flex items-center justify-between border-b border-neutral-700">
              <span className="text-xs font-medium truncate">{lightboxImage.title}</span>
              <div className="flex items-center space-x-2">
                <a href={lightboxImage.src} download={lightboxImage.title} className="p-1 hover:bg-neutral-700 rounded text-neutral-300 hover:text-white"><Download className="w-4 h-4" /></a>
                <button onClick={() => setLightboxImage(null)} className="p-1 hover:bg-neutral-700 rounded text-neutral-300 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="p-2 flex items-center justify-center bg-black">
              <img src={lightboxImage.src} alt={lightboxImage.title} className="max-h-[75vh] max-w-full object-contain rounded" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
