'use client';
 
import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Send, User, Users, Search } from 'lucide-react';
import { getWhatsAppChats, getWhatsAppMessages, sendWhatsAppMessage } from '../../actions/whatsapp-actions';
 
export default function UnifiedInbox({ sessionId }: { sessionId: string }) {
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
 
  useEffect(() => {
    fetchChats();
  }, [sessionId]);
 
  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id._serialized);
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
 
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;
 
    try {
      const data = await sendWhatsAppMessage(sessionId, selectedChat.id._serialized, newMessage);
      if (data.success) {
        setNewMessage('');
        fetchMessages(selectedChat.id._serialized);
      } else {
        console.error('Failed to send message:', data.error);
      }
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] border rounded-lg overflow-hidden bg-white">
      {/* Sidebar - Chat List */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search chats..." className="pl-8" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.map((chat) => (
            <div 
              key={chat.id._serialized}
              onClick={() => setSelectedChat(chat)}
              className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${selectedChat?.id._serialized === chat.id._serialized ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
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
      <div className="flex-1 flex flex-col bg-gray-50/50">
        {selectedChat ? (
          <>
            <div className="p-4 border-b bg-white flex items-center space-x-3">
              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                {selectedChat.isGroup ? <Users className="h-4 w-4 text-gray-500" /> : <User className="h-4 w-4 text-gray-500" />}
              </div>
              <p className="font-bold">{selectedChat.name}</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div 
                  key={msg.id.id}
                  className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] p-3 rounded-lg text-sm ${msg.fromMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border rounded-bl-none shadow-sm'}`}>
                    <p>{msg.body}</p>
                    <p className={`text-[10px] mt-1 opacity-70 ${msg.fromMe ? 'text-right' : ''}`}>
                      {new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t flex space-x-2">
              <Input 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..." 
                className="flex-1"
              />
              <Button type="submit" size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <p>Select a chat to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}
