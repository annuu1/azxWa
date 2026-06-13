'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { X, RefreshCw, Megaphone, Calendar, HelpCircle, Eye } from 'lucide-react';
import { createCampaign } from '../actions/campaign-actions';

interface CreateCampaignModalProps {
  onClose: () => void;
  onSuccess: () => void;
  sessions: any[];
  tags: any[];
}

export default function CreateCampaignModal({ 
  onClose, 
  onSuccess, 
  sessions, 
  tags 
}: CreateCampaignModalProps) {
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [targetTagId, setTargetTagId] = useState<string>('all');
  const [sessionId, setSessionId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [sendType, setSendType] = useState<'immediate' | 'scheduled'>('immediate');

  // Live compile mockup
  const [compiledPreview, setCompiledPreview] = useState('');

  const mockupContact = {
    name: 'John Doe',
    pushName: 'JohnD',
    whatsappId: '12025550108@c.us',
  };

  useEffect(() => {
    let preview = messageTemplate;
    preview = preview.replace(/{{name}}/gi, mockupContact.name);
    preview = preview.replace(/{{firstName}}/gi, mockupContact.name.split(' ')[0]);
    preview = preview.replace(/{{pushName}}/gi, mockupContact.pushName);
    preview = preview.replace(/{{phone}}/gi, mockupContact.whatsappId.split('@')[0]);
    setCompiledPreview(preview || 'Your message preview will appear here...');
  }, [messageTemplate]);

  // Set default session on mount if sessions exist
  useEffect(() => {
    const readySession = sessions.find(s => s.ready);
    if (readySession) {
      setSessionId(readySession.sessionId);
    } else if (sessions.length > 0) {
      setSessionId(sessions[0].sessionId);
    }
  }, [sessions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !messageTemplate.trim() || !sessionId) {
      alert('Please fill out all required fields.');
      return;
    }

    setLoading(true);
    try {
      const targetTag = targetTagId === 'all' ? null : targetTagId;
      const parsedSchedule = sendType === 'scheduled' && scheduledAt ? scheduledAt : null;

      const result = await createCampaign(name, messageTemplate, targetTag, sessionId, parsedSchedule);
      if (result.success) {
        onSuccess();
      } else {
        alert(result.error || 'Failed to create campaign');
      }
    } catch (err: any) {
      alert(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <Card className="w-full max-w-4xl bg-white shadow-2xl border flex flex-col md:flex-row max-h-[90vh] overflow-hidden rounded-xl">
        {/* Left Side: Campaign Configuration Form */}
        <form onSubmit={handleSubmit} className="w-full md:w-3/5 p-6 flex flex-col justify-between overflow-y-auto border-r border-gray-100">
          <div className="space-y-5">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl font-bold">Create Broadcast Campaign</CardTitle>
                <CardDescription>Target segments and schedule custom messaging</CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                type="button"
                onClick={onClose}
                className="h-8 w-8 text-gray-400 hover:text-gray-600 md:hidden"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Campaign Name */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Campaign Name</label>
              <Input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Black Friday Launch"
                required
              />
            </div>

            {/* Session Selector & Audience Selector */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Sender WhatsApp Session</label>
                <select
                  className="w-full bg-white border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  required
                >
                  <option value="" disabled>Select session...</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.sessionId}>
                      {s.sessionId} {s.ready ? '(Ready)' : '(Offline)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Target Segment Tag</label>
                <select
                  className="w-full bg-white border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={targetTagId}
                  onChange={(e) => setTargetTagId(e.target.value)}
                >
                  <option value="all">All Contacts</option>
                  {tags.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Message Template Textarea */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-gray-600">Message Template</label>
                <div className="group relative">
                  <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
                  <div className="hidden group-hover:block absolute right-0 top-6 z-10 w-64 bg-gray-950 text-white text-[10px] rounded p-2 shadow-lg space-y-1 leading-normal font-sans">
                    <p className="font-bold">Supported Variables:</p>
                    <p><code className="text-blue-400">{"{{name}}"}</code>: Contact Name</p>
                    <p><code className="text-blue-400">{"{{firstName}}"}</code>: Contact First Name</p>
                    <p><code className="text-blue-400">{"{{pushName}}"}</code>: WhatsApp Push Name</p>
                    <p><code className="text-blue-400">{"{{phone}}"}</code>: Recipient Phone Number</p>
                  </div>
                </div>
              </div>
              <textarea
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Hello {{firstName}}, check out our new arrivals! {{name}}"
                className="w-full bg-white border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] resize-none font-mono"
                required
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {['{{name}}', '{{firstName}}', '{{pushName}}', '{{phone}}'].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setMessageTemplate(prev => prev + v)}
                    className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 font-mono px-2 py-0.5 rounded border border-gray-200/50"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Schedule configuration */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-semibold text-gray-600 block">Dispatch Schedule</label>
              <div className="flex space-x-4">
                <label className="flex items-center space-x-2 text-xs font-medium cursor-pointer text-gray-700">
                  <input 
                    type="radio" 
                    name="sendType" 
                    checked={sendType === 'immediate'}
                    onChange={() => setSendType('immediate')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>Send Immediately</span>
                </label>
                <label className="flex items-center space-x-2 text-xs font-medium cursor-pointer text-gray-700">
                  <input 
                    type="radio" 
                    name="sendType" 
                    checked={sendType === 'scheduled'}
                    onChange={() => setSendType('scheduled')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>Schedule for later</span>
                </label>
              </div>

              {sendType === 'scheduled' && (
                <div className="flex items-center space-x-2 pt-1">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    required
                    className="bg-white border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
            <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={loading}>
              {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Megaphone className="w-4 h-4 mr-2" />}
              Launch Campaign
            </Button>
          </div>
        </form>

        {/* Right Side: Live WhatsApp Message Simulator Preview */}
        <div className="hidden md:flex w-2/5 bg-gray-50/50 p-6 flex-col justify-between overflow-y-auto">
          <div className="space-y-4">
            <div>
              <CardTitle className="text-lg font-bold flex items-center">
                <Eye className="w-4 h-4 mr-2 text-blue-600" /> Preview Message
              </CardTitle>
              <CardDescription>Simulates live WhatsApp text compilation</CardDescription>
            </div>

            {/* WhatsApp Mock Mobile Frame */}
            <div className="border rounded-2xl bg-gray-150 aspect-[9/16] max-w-[280px] mx-auto overflow-hidden shadow-inner flex flex-col relative bg-[url('https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=2670')] bg-cover bg-center">
              {/* Phone Header */}
              <div className="bg-gray-900/90 text-white p-2.5 flex items-center space-x-2 text-[10px] shrink-0">
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center font-bold text-[8px]">JD</div>
                <div>
                  <p className="font-bold leading-none">{mockupContact.name}</p>
                  <span className="text-[7px] text-gray-300">Online</span>
                </div>
              </div>

              {/* Chat Message Box */}
              <div className="flex-1 p-3 flex flex-col justify-end">
                <div className="bg-white text-gray-800 text-xs p-2.5 rounded-lg rounded-tl-none shadow max-w-[85%] self-start relative border border-gray-100">
                  <p className="whitespace-pre-wrap leading-relaxed">{compiledPreview}</p>
                  <span className="block text-[8px] text-gray-400 text-right mt-1">10:00 AM</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-200/50 text-center">
            <Button variant="outline" className="w-full" type="button" onClick={onClose}>Close Builder</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
