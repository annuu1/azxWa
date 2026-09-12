'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { 
  X, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Tag, 
  Calendar, 
  User, 
  FileText, 
  CheckCircle2, 
  MessageSquare, 
  ArrowRight,
  Sparkles,
  Flame,
  Clock,
  Check,
  Send,
  ShieldCheck,
  AlertCircle,
  TrendingUp,
  BrainCircuit,
  Bot
} from 'lucide-react';
import { 
  getContactDetails, 
  addContactNote, 
  addTagToContact, 
  removeTagFromContact, 
  createOrgTag,
  assignLeadAgent,
  updateLeadStage
} from '../actions/crm-actions';
import {
  analyzeLeadWithAi,
  addHumanNoteAndReanalyze,
  approveProposalAction,
  rejectProposalAction
} from '@/features/ai/actions/multi-agent-actions';

interface ContactDetailsModalProps {
  contactId: string;
  onClose: () => void;
  onUpdate: () => void;
  agents: any[];
  allTags: any[];
}

export default function ContactDetailsModal({ 
  contactId, 
  onClose, 
  onUpdate, 
  agents,
  allTags 
}: ContactDetailsModalProps) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'intelligence' | 'notes' | 'tags'>('intelligence');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [approvingProposal, setApprovingProposal] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [noteContent, setNoteContent] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [addingTag, setAddingTag] = useState(false);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const data = await getContactDetails(contactId);
      if (data.success) {
        setDetails(data);
      }
    } catch (err) {
      console.error('Error fetching contact details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [contactId]);

  const handleAddNoteWithAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    setSubmittingNote(true);
    try {
      const leadId = details?.lead?.id;
      const result = await addHumanNoteAndReanalyze(contactId, leadId, noteContent);
      if (result.success) {
        setNoteContent('');
        await fetchDetails();
        onUpdate();
      }
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleRunAiAnalysis = async () => {
    const leadId = details?.lead?.id;
    if (!leadId) return;

    setAnalyzingAi(true);
    try {
      const res = await analyzeLeadWithAi(leadId);
      if (res.success) {
        await fetchDetails();
        onUpdate();
      }
    } finally {
      setAnalyzingAi(false);
    }
  };

  const handleApproveProposal = async (proposalId: string) => {
    setApprovingProposal(true);
    try {
      const res = await approveProposalAction(proposalId);
      if (res.success) {
        await fetchDetails();
        onUpdate();
      }
    } finally {
      setApprovingProposal(false);
    }
  };

  const handleAddTag = async (tagId: string) => {
    try {
      const result = await addTagToContact(contactId, tagId);
      if (result.success) {
        await fetchDetails();
        onUpdate();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      const result = await removeTagFromContact(contactId, tagId);
      if (result.success) {
        await fetchDetails();
        onUpdate();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateAndAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    setAddingTag(true);
    try {
      const res = await createOrgTag(newTagName, newTagColor);
      if (res.success && res.tag) {
        await addTagToContact(contactId, res.tag.id);
        setNewTagName('');
        await fetchDetails();
        onUpdate();
      }
    } finally {
      setAddingTag(false);
    }
  };

  if (loading && !details) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 flex flex-col items-center space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <p className="text-xs text-gray-500 font-medium">Loading client details & intelligence...</p>
        </div>
      </div>
    );
  }

  const contact = details?.contact;
  const lead = details?.lead;
  const intel = details?.intelligence;
  const proposals = details?.proposals || [];
  const notesList = details?.notes || [];
  const activitiesList = details?.activities || [];
  const appliedTags = details?.tags || [];

  // Parse pain points & objections JSON
  let painPoints: string[] = [];
  let objections: string[] = [];
  if (intel) {
    try { painPoints = typeof intel.painPoints === 'string' ? JSON.parse(intel.painPoints) : []; } catch (e) {}
    try { objections = typeof intel.objections === 'string' ? JSON.parse(intel.objections) : []; } catch (e) {}
  }

  const nextFollowup = intel?.nextFollowupAt ? new Date(intel.nextFollowupAt) : null;
  const score = intel?.leadScore ?? 50;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-gray-100 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-base shrink-0">
              {(contact?.name || contact?.pushName || 'W')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-gray-900 text-base truncate">
                  {contact?.name || contact?.pushName || 'WhatsApp Contact'}
                </h3>
                {lead && (
                  <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Active Lead
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-gray-500">{contact?.whatsappId}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {lead && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunAiAnalysis}
                disabled={analyzingAi}
                className="text-xs h-8 bg-blue-50/50 text-blue-600 border-blue-200 hover:bg-blue-100/60 font-semibold"
              >
                {analyzingAi ? <RefreshCw className="animate-spin w-3.5 h-3.5 mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                Run AI Analysis
              </Button>
            )}
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-100 px-5 bg-white text-xs font-semibold">
          <button
            onClick={() => setActiveTab('intelligence')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'intelligence'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <BrainCircuit className="w-4 h-4" />
            <span>AI Lead Intelligence & Strategy</span>
          </button>

          <button
            onClick={() => setActiveTab('notes')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'notes'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Human Notes & Activity ({notesList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tags')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'tags'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Tags & Labels ({appliedTags.length})</span>
          </button>
        </div>

        {/* Tab Contents Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* TAB 1: AI LEAD INTELLIGENCE & STRATEGY */}
          {activeTab === 'intelligence' && (
            <div className="space-y-4">
              {intel ? (
                <>
                  {/* Lead Score & Intent Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3 flex flex-col justify-between">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">AI Lead Score</span>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`text-xl font-black ${
                          score >= 75 ? 'text-orange-600' : score >= 50 ? 'text-amber-600' : 'text-blue-600'
                        }`}>
                          {score}/100
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          score >= 75 ? 'bg-orange-100 text-orange-700' : score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {score >= 75 ? '🔥 Hot' : score >= 50 ? '🟡 Warm' : '❄️ Cold'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3 flex flex-col justify-between">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Buying Intent</span>
                      <div className="mt-1">
                        <span className="font-bold text-sm text-gray-900">{intel.buyingIntent || 'MEDIUM'} INTENT</span>
                        <span className="text-[10px] text-gray-500 block capitalize">{intel.sentiment.toLowerCase()} Sentiment</span>
                      </div>
                    </div>

                    <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3 flex flex-col justify-between">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Buyer Persona</span>
                      <div className="mt-1">
                        <span className="font-bold text-xs text-gray-900 leading-tight block truncate">
                          {intel.buyerPersona || 'Decision Maker'}
                        </span>
                        <span className="text-[10px] text-gray-400 block">State: {intel.conversationState}</span>
                      </div>
                    </div>
                  </div>

                  {/* Client Summary */}
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-1">
                    <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
                      Executive Client Profile
                    </span>
                    <p className="text-xs text-gray-800 leading-relaxed font-medium">
                      {intel.summary}
                    </p>
                  </div>

                  {/* BANT Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg">
                      <span className="text-[10px] font-bold text-gray-400 block uppercase">💰 Budget</span>
                      <span className="font-semibold text-gray-800 text-xs mt-0.5 block">{intel.budget || 'Not stated'}</span>
                    </div>

                    <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg">
                      <span className="text-[10px] font-bold text-gray-400 block uppercase">👤 Authority</span>
                      <span className="font-semibold text-gray-800 text-xs mt-0.5 block">{intel.authority || 'Unknown'}</span>
                    </div>

                    <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg">
                      <span className="text-[10px] font-bold text-gray-400 block uppercase">🎯 Primary Need</span>
                      <span className="font-semibold text-gray-800 text-xs mt-0.5 block truncate">{intel.need || 'Inquiry'}</span>
                    </div>

                    <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg">
                      <span className="text-[10px] font-bold text-gray-400 block uppercase">⏱️ Timeline</span>
                      <span className="font-semibold text-gray-800 text-xs mt-0.5 block">{intel.timeline || 'Flexible'}</span>
                    </div>
                  </div>

                  {/* Pain Points & Objections */}
                  {(painPoints.length > 0 || objections.length > 0) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {painPoints.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Identified Pain Points</span>
                          <div className="flex flex-wrap gap-1">
                            {painPoints.map((p, i) => (
                              <span key={i} className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-md text-[11px]">
                                • {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {objections.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Potential Hesitations / Objections</span>
                          <div className="flex flex-wrap gap-1">
                            {objections.map((o, i) => (
                              <span key={i} className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md text-[11px]">
                                ⚠️ {o}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Next Strategic Follow-up & Suggested WhatsApp Message */}
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-900 flex items-center text-xs">
                        <Clock className="w-3.5 h-3.5 mr-1.5 text-emerald-700" />
                        Next Recommended Follow-Up: {nextFollowup ? `${nextFollowup.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${nextFollowup.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Within 24 hours'}
                      </span>
                    </div>

                    <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                      <strong>Strategy:</strong> {intel.nextFollowupReason}
                    </p>

                    {intel.nextSuggestedMessage && (
                      <div className="bg-white border border-emerald-200 rounded-lg p-3 space-y-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Draft WhatsApp Message</span>
                        <p className="text-xs text-gray-800 italic bg-gray-50/80 p-2.5 rounded border border-gray-100">
                          "{intel.nextSuggestedMessage}"
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 space-y-3 bg-gray-50/60 border border-dashed rounded-xl border-gray-200">
                  <Bot className="w-10 h-10 text-gray-400 mx-auto" />
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm">No AI Intelligence Profile Yet</h4>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                      Run the Multi-Agent engine to analyze human notes and conversation history to generate BANT facts, lead score, and follow-up strategy.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleRunAiAnalysis}
                    disabled={analyzingAi}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                  >
                    {analyzingAi ? <RefreshCw className="animate-spin w-3.5 h-3.5 mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                    Analyze Lead Now
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: HUMAN NOTES & TIMELINE */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              {/* Add Note Form */}
              <form onSubmit={handleAddNoteWithAi} className="space-y-2 bg-gray-50/70 border border-gray-200 rounded-xl p-3.5">
                <label className="text-xs font-bold text-gray-700 block">
                  Add Human Sales Note (AI will use this to re-strategize):
                </label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="e.g. Spoke on phone, client interested in annual plan but wants 10% discount approved by Monday..."
                  className="w-full h-20 p-2.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={submittingNote || !noteContent.trim()}
                    className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    {submittingNote ? (
                      <>
                        <RefreshCw className="animate-spin w-3.5 h-3.5 mr-1.5" />
                        Saving & Re-analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                        Save Note & Ask AI to Re-strategize
                      </>
                    )}
                  </Button>
                </div>
              </form>

              {/* Notes List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Previous Notes</h4>
                {notesList.length > 0 ? (
                  notesList.map((n: any) => (
                    <div key={n.id} className="p-3 bg-white border border-gray-100 rounded-xl shadow-2xs space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-gray-400 font-medium">
                        <span>By {n.user?.email ? n.user.email.split('@')[0] : 'Sales Rep'}</span>
                        <span>{new Date(n.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                      <p className="text-xs text-gray-800 leading-relaxed">{n.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 italic text-center py-4">No notes recorded yet.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TAGS & LABELS */}
          {activeTab === 'tags' && (
            <div className="space-y-4">
              {/* Applied Tags */}
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-2">Applied Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {appliedTags.map((t: any) => (
                    <span 
                      key={t.id} 
                      style={{ backgroundColor: `${t.color}15`, color: t.color, borderColor: `${t.color}30` }}
                      className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border"
                    >
                      {t.name}
                      <button 
                        onClick={() => handleRemoveTag(t.id)} 
                        className="ml-1.5 hover:opacity-75 focus:outline-none"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {appliedTags.length === 0 && (
                    <span className="text-xs text-gray-400 italic">No tags assigned.</span>
                  )}
                </div>
              </div>

              {/* Available Tags to Add */}
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-2">Add Existing Tag</label>
                <div className="flex flex-wrap gap-1.5">
                  {allTags
                    .filter((tag: any) => !appliedTags.some((at: any) => at.id === tag.id))
                    .map((tag: any) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleAddTag(tag.id)}
                        style={{ borderColor: `${tag.color}40`, color: tag.color }}
                        className="text-xs font-medium border px-2.5 py-1 rounded-full hover:bg-gray-50 flex items-center space-x-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{tag.name}</span>
                      </button>
                    ))}
                </div>
              </div>

              {/* Create New Tag */}
              <form onSubmit={handleCreateAndAddTag} className="pt-3 border-t border-gray-100 flex items-center space-x-2">
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Create new tag name..."
                  className="h-8 text-xs flex-1"
                />
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5"
                />
                <Button type="submit" disabled={addingTag || !newTagName.trim()} size="sm" className="h-8 text-xs">
                  Create
                </Button>
              </form>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
