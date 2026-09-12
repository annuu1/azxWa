'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { 
  Bot, 
  Sparkles, 
  Brain, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Send, 
  Edit3, 
  Trash2, 
  Calendar, 
  User, 
  Phone, 
  Zap, 
  ShieldCheck, 
  ArrowRight, 
  Play, 
  Eye, 
  Filter, 
  Search, 
  Activity, 
  Cpu, 
  Sliders, 
  CheckSquare, 
  MessageSquare, 
  Flame,
  Check,
  X,
  Target,
  FileText,
  TrendingUp,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import {
  getAiDashboardOverview,
  approveProposalAction,
  rejectProposalAction,
  editAndApproveProposalAction,
  batchApproveAllProposalsAction,
  updateScheduledFollowupAction,
  cancelScheduledFollowupAction,
  executeFollowupNowAction,
  updateLeadIntelligenceAction,
  deleteLeadIntelligenceAction,
  triggerFollowupWorkerAction,
  analyzeLeadWithAi,
  analyzeAllPipelineLeadsAction,
  toggleAiExecutionModeAction
} from '../actions/multi-agent-actions';
import AISettingsPanel from './ai-settings-panel';

export default function AIActivityCenter() {
  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'proposals' | 'followups' | 'profiles' | 'settings'>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isPending, startTransition] = useTransition();

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [intentFilter, setIntentFilter] = useState('ALL');
  const [proposalStatusFilter, setProposalStatusFilter] = useState('ALL');
  const [activityTypeFilter, setActivityTypeFilter] = useState('ALL');

  // Modal States
  const [selectedProposal, setSelectedProposal] = useState<any>(null);
  const [editProposalMsg, setEditProposalMsg] = useState('');
  const [editProposalStage, setEditProposalStage] = useState('');

  const [selectedFollowup, setSelectedFollowup] = useState<any>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleMessage, setRescheduleMessage] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');

  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [editProfileScore, setEditProfileScore] = useState<number>(50);
  const [editProfileIntent, setEditProfileIntent] = useState<string>('MEDIUM');
  const [editProfileSentiment, setEditProfileSentiment] = useState<string>('NEUTRAL');
  const [editProfileSummary, setEditProfileSummary] = useState('');
  const [editProfileNeed, setEditProfileNeed] = useState('');
  const [editProfileBudget, setEditProfileBudget] = useState('');

  const [viewingProfileDetail, setViewingProfileDetail] = useState<any>(null);

  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await getAiDashboardOverview();
      if (res.success) {
        setData(res);
      } else {
        setErrorMsg(res.error || 'Failed to load AI Dashboard data');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 5000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 5000);
    }
  };

  // Handlers for Proposals
  const handleApproveProposal = async (proposalId: string) => {
    startTransition(async () => {
      const res = await approveProposalAction(proposalId);
      if (res.success) {
        showNotification('AI Action Proposal approved and executed successfully!');
        loadData(true);
      } else {
        showNotification(res.error || 'Failed to approve proposal', true);
      }
    });
  };

  const handleRejectProposal = async (proposalId: string) => {
    startTransition(async () => {
      const res = await rejectProposalAction(proposalId);
      if (res.success) {
        showNotification('Proposal rejected.');
        loadData(true);
      } else {
        showNotification(res.error || 'Failed to reject proposal', true);
      }
    });
  };

  const handleEditAndApproveProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProposal) return;
    startTransition(async () => {
      const res = await editAndApproveProposalAction(
        selectedProposal.id, 
        editProposalMsg, 
        editProposalStage || undefined
      );
      if (res.success) {
        showNotification('Modified action proposal approved & executed!');
        setSelectedProposal(null);
        loadData(true);
      } else {
        showNotification(res.error || 'Execution failed', true);
      }
    });
  };

  const handleBatchApprove = async () => {
    if (!confirm('Are you sure you want to approve and execute all pending AI proposals now?')) return;
    startTransition(async () => {
      const res = await batchApproveAllProposalsAction();
      if (res.success) {
        showNotification(`Batch processed ${res.count} pending proposals!`);
        loadData(true);
      } else {
        showNotification(res.error || 'Batch approval failed', true);
      }
    });
  };

  // Handlers for Followups
  const handleExecuteFollowupNow = async (leadId: string) => {
    startTransition(async () => {
      const res = await executeFollowupNowAction(leadId);
      if (res.success) {
        showNotification('Follow-up message dispatched immediately!');
        loadData(true);
      } else {
        showNotification(res.error || 'Failed to dispatch message', true);
      }
    });
  };

  const handleCancelFollowup = async (leadId: string) => {
    if (!confirm('Cancel this scheduled follow-up?')) return;
    startTransition(async () => {
      const res = await cancelScheduledFollowupAction(leadId);
      if (res.success) {
        showNotification('Scheduled follow-up cancelled.');
        loadData(true);
      } else {
        showNotification(res.error || 'Failed to cancel follow-up', true);
      }
    });
  };

  const handleSaveReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFollowup) return;
    startTransition(async () => {
      const res = await updateScheduledFollowupAction(selectedFollowup.leadId, {
        nextFollowupAt: rescheduleDate || null,
        nextSuggestedMessage: rescheduleMessage,
        nextFollowupReason: rescheduleReason,
      });
      if (res.success) {
        showNotification('Follow-up schedule and message updated!');
        setSelectedFollowup(null);
        loadData(true);
      } else {
        showNotification(res.error || 'Update failed', true);
      }
    });
  };

  const handleTriggerWorker = async () => {
    startTransition(async () => {
      const res = await triggerFollowupWorkerAction();
      if (res.success) {
        showNotification('Follow-up worker executed. Due tasks processed!');
        loadData(true);
      } else {
        showNotification(res.error || 'Worker execution failed', true);
      }
    });
  };

  // Handlers for Lead Intelligence
  const handleReanalyzeLead = async (leadId: string) => {
    startTransition(async () => {
      const res = await analyzeLeadWithAi(leadId);
      if (res.success) {
        showNotification('Lead re-analyzed by AI Agents successfully!');
        loadData(true);
      } else {
        showNotification(res.error || 'Analysis failed', true);
      }
    });
  };

  const handleAnalyzeAllLeads = async () => {
    startTransition(async () => {
      const res = await analyzeAllPipelineLeadsAction();
      if (res.success) {
        showNotification(`Batch analysis complete for ${res.analyzedCount} leads!`);
        loadData(true);
      } else {
        showNotification(res.error || 'Batch analysis failed', true);
      }
    });
  };

  const handleSaveProfileEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) return;
    startTransition(async () => {
      const res = await updateLeadIntelligenceAction(selectedProfile.leadId, {
        leadScore: Number(editProfileScore),
        buyingIntent: editProfileIntent as any,
        sentiment: editProfileSentiment as any,
        summary: editProfileSummary,
        need: editProfileNeed,
        budget: editProfileBudget,
      });
      if (res.success) {
        showNotification('Lead Intelligence profile updated!');
        setSelectedProfile(null);
        loadData(true);
      } else {
        showNotification(res.error || 'Update failed', true);
      }
    });
  };

  const handleDeleteProfile = async (leadId: string) => {
    if (!confirm('Are you sure you want to delete this AI profile data?')) return;
    startTransition(async () => {
      const res = await deleteLeadIntelligenceAction(leadId);
      if (res.success) {
        showNotification('AI Profile deleted.');
        loadData(true);
      } else {
        showNotification(res.error || 'Delete failed', true);
      }
    });
  };

  const handleToggleMode = async (newMode: 'AUTONOMOUS' | 'APPROVAL_REQUIRED') => {
    startTransition(async () => {
      const res = await toggleAiExecutionModeAction(newMode);
      if (res.success) {
        showNotification(`AI Execution Mode switched to ${newMode === 'AUTONOMOUS' ? 'Full Autonomous' : 'Co-Pilot Approval Required'}`);
        loadData(true);
      } else {
        showNotification(res.error || 'Failed to update mode', true);
      }
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <div className="p-4 bg-blue-50 text-blue-600 rounded-full animate-bounce">
          <Brain className="w-10 h-10 animate-spin" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-gray-900">Loading AI Multi-Agent Command Center</h3>
          <p className="text-sm text-gray-500">Aggregating lead intelligence, action proposals & autonomous schedules...</p>
        </div>
      </div>
    );
  }

  const stats = data?.stats || {
    totalAnalyzed: 0,
    avgScore: 0,
    pendingProposalsCount: 0,
    autoExecutedCount: 0,
    dueFollowupsCount: 0,
    scheduledFollowupsCount: 0
  };

  const proposals = (data?.proposals || []).filter((p: any) => {
    if (proposalStatusFilter === 'ALL') return true;
    return p.status === proposalStatusFilter;
  });

  const scheduledFollowups = (data?.scheduledFollowups || []).filter((f: any) => {
    if (!searchQuery) return true;
    const name = f.contact?.name || f.contact?.pushName || '';
    const phone = f.contact?.whatsappId || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase()) || phone.includes(searchQuery);
  });

  const leadProfiles = (data?.leadProfiles || []).filter((p: any) => {
    const matchesSearch = !searchQuery || 
      (p.contact?.name || p.contact?.pushName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.contact?.whatsappId || '').includes(searchQuery) ||
      (p.summary || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesIntent = intentFilter === 'ALL' || p.buyingIntent === intentFilter;
    return matchesSearch && matchesIntent;
  });

  const aiActivities = (data?.aiActivities || []).filter((a: any) => {
    if (activityTypeFilter === 'ALL') return true;
    return a.type === activityTypeFilter;
  });

  const stages = data?.stages || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast / Notification Banner */}
      {successMsg && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm shadow-sm animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-green-600 hover:text-green-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm shadow-sm animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="font-medium">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <span className="p-2 bg-blue-500/20 border border-blue-400/30 rounded-xl text-blue-300">
                <Brain className="w-6 h-6" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-300 bg-blue-950/60 px-3 py-1 rounded-full border border-blue-800/60">
                Multi-Agent Intelligence System
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">AI Activity & Lead Command Center</h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Observe, orchestrate, and control the 5-Agent AI ecosystem (Auditor, Profiler, Strategist, Copywriter, Safety Gate) 
              as they analyze leads, schedule follow-ups, and auto-pilot customer engagement.
            </p>
          </div>

          {/* Quick Actions & AI Mode Switch */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white/5 backdrop-blur-md p-3 rounded-xl border border-white/10">
            <div className="text-left sm:text-right pr-2">
              <div className="text-xs text-slate-300 font-medium">Current Operational Mode</div>
              <div className="text-sm font-bold flex items-center gap-1.5 mt-0.5">
                {data?.aiMode === 'AUTONOMOUS' ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Zap className="w-4 h-4 fill-emerald-400" /> Fully Autonomous
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4" /> Co-Pilot (Approval Required)
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={data?.aiMode === 'AUTONOMOUS' ? 'secondary' : 'default'}
                onClick={() => handleToggleMode(data?.aiMode === 'AUTONOMOUS' ? 'APPROVAL_REQUIRED' : 'AUTONOMOUS')}
                disabled={isPending}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold"
              >
                Switch to {data?.aiMode === 'AUTONOMOUS' ? 'Co-Pilot' : 'Autonomous'}
              </Button>

              <Button
                size="sm"
                onClick={() => loadData(true)}
                disabled={refreshing || isPending}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Real-time Metric Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-8 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3.5 border border-white/10">
            <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-400" /> Profiled Leads
            </div>
            <div className="text-2xl font-bold mt-1 text-white">{stats.totalAnalyzed}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Across CRM Pipeline</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3.5 border border-white/10">
            <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" /> Pending Approvals
            </div>
            <div className="text-2xl font-bold mt-1 text-amber-300">{stats.pendingProposalsCount}</div>
            <div className="text-[10px] text-amber-400/80 mt-0.5">Awaiting Co-Pilot signoff</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3.5 border border-white/10">
            <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" /> Executed Actions
            </div>
            <div className="text-2xl font-bold mt-1 text-emerald-400">{stats.autoExecutedCount}</div>
            <div className="text-[10px] text-emerald-400/80 mt-0.5">Dispatched to WhatsApp</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3.5 border border-white/10">
            <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-purple-400" /> Scheduled Followups
            </div>
            <div className="text-2xl font-bold mt-1 text-purple-300">{stats.scheduledFollowupsCount}</div>
            <div className="text-[10px] text-purple-400/80 mt-0.5">
              {stats.dueFollowupsCount > 0 ? `${stats.dueFollowupsCount} Due right now!` : 'Queued by deadline'}
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3.5 border border-white/10 col-span-2 md:col-span-1">
            <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" /> Avg Lead Score
            </div>
            <div className="text-2xl font-bold mt-1 text-cyan-300">{stats.avgScore}<span className="text-xs text-slate-400 font-normal">/100</span></div>
            <div className="text-[10px] text-cyan-400/80 mt-0.5">AI Opportunity Rating</div>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'overview'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Activity className="w-4 h-4" /> Live AI Hub
        </button>

        <button
          onClick={() => setActiveTab('proposals')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all relative ${
            activeTab === 'proposals'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <CheckSquare className="w-4 h-4" /> Action Proposals Queue
          {stats.pendingProposalsCount > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'proposals' ? 'bg-white text-blue-700' : 'bg-amber-100 text-amber-800'
            }`}>
              {stats.pendingProposalsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('followups')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'followups'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Clock className="w-4 h-4" /> Follow-Up Scheduler
          {stats.dueFollowupsCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 animate-pulse">
              {stats.dueFollowupsCount} Due
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('profiles')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'profiles'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Target className="w-4 h-4" /> Lead Intelligence Directory ({leadProfiles.length})
        </button>

        <button
          onClick={() => setActiveTab('activities')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'activities'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <FileText className="w-4 h-4" /> AI Execution Audit Log
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'settings'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Sliders className="w-4 h-4" /> Model & System Prompts
        </button>
      </div>

      {/* TAB 1: OVERVIEW / LIVE AI HUB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left 2 Cols: Action Proposals & Due Followups */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Pending Action Proposals Card */}
              <Card className="shadow-sm border-gray-200">
                <CardHeader className="bg-slate-50/70 border-b pb-4 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-gray-900">
                      <Sparkles className="w-4 h-4 text-blue-600" /> Pending Action Proposals
                    </CardTitle>
                    <CardDescription className="text-xs">
                      High-impact decisions drafted by the multi-agent system waiting for review.
                    </CardDescription>
                  </div>
                  {stats.pendingProposalsCount > 0 && (
                    <Button
                      size="sm"
                      onClick={handleBatchApprove}
                      disabled={isPending}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" /> Approve All ({stats.pendingProposalsCount})
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-4 divide-y divide-gray-100">
                  {data?.proposals?.filter((p: any) => p.status === 'PENDING_APPROVAL').length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-green-500 mb-2 opacity-80" />
                      No pending proposals! All AI recommendations are up to date.
                    </div>
                  ) : (
                    data?.proposals
                      ?.filter((p: any) => p.status === 'PENDING_APPROVAL')
                      .slice(0, 5)
                      .map((p: any) => {
                        const payload = JSON.parse(p.proposedPayload || '{}');
                        return (
                          <div key={p.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-gray-900">
                                    {p.contact?.name || p.contact?.pushName || p.contact?.whatsappId}
                                  </span>
                                  <span className="text-xs text-gray-400">({p.contact?.whatsappId})</span>
                                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[11px] font-semibold">
                                    {p.actionType}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 italic">
                                  "{p.reasoning}"
                                </p>
                              </div>
                              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                                {Math.round((p.confidence || 0.8) * 100)}% Conf
                              </span>
                            </div>

                            {payload.message && (
                              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 font-mono">
                                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Proposed WhatsApp Message:</div>
                                {payload.message}
                              </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRejectProposal(p.id)}
                                disabled={isPending}
                                className="text-xs text-red-600 hover:bg-red-50 border-red-200"
                              >
                                <X className="w-3.5 h-3.5 mr-1" /> Dismiss
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedProposal(p);
                                  setEditProposalMsg(payload.message || '');
                                  setEditProposalStage(payload.targetStageId || '');
                                }}
                                className="text-xs text-blue-600 hover:bg-blue-50 border-blue-200"
                              >
                                <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit Message
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleApproveProposal(p.id)}
                                disabled={isPending}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                              >
                                <Send className="w-3.5 h-3.5 mr-1" /> Approve & Send
                              </Button>
                            </div>
                          </div>
                        );
                      })
                  )}
                </CardContent>
              </Card>

              {/* Scheduled Follow-ups Queue */}
              <Card className="shadow-sm border-gray-200">
                <CardHeader className="bg-slate-50/70 border-b pb-4 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-gray-900">
                      <Clock className="w-4 h-4 text-purple-600" /> Upcoming Autonomous Follow-ups
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Leads with scheduled communication deadlines determined by the AI Strategist.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTriggerWorker}
                    disabled={isPending}
                    className="text-xs font-semibold text-purple-700 border-purple-200 hover:bg-purple-50"
                  >
                    <Play className="w-3.5 h-3.5 mr-1" /> Scan & Dispatch Due
                  </Button>
                </CardHeader>
                <CardContent className="p-4 divide-y divide-gray-100">
                  {data?.scheduledFollowups?.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm">
                      No follow-ups currently scheduled. Run AI Analysis on leads to generate follow-up dates!
                    </div>
                  ) : (
                    data?.scheduledFollowups?.slice(0, 5).map((f: any) => {
                      const isOverdue = f.nextFollowupAt && new Date(f.nextFollowupAt) <= new Date();
                      return (
                        <div key={f.leadId} className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-gray-900">
                                {f.contact?.name || f.contact?.pushName || f.contact?.whatsappId}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                f.buyingIntent === 'HIGH' ? 'bg-emerald-100 text-emerald-800' :
                                f.buyingIntent === 'MEDIUM' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {f.buyingIntent} INTENT ({f.leadScore}/100)
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 line-clamp-1">
                              {f.nextSuggestedMessage ? `Msg: "${f.nextSuggestedMessage}"` : f.nextFollowupReason || 'Scheduled Followup'}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right mr-1">
                              <span className={`text-xs font-semibold block ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-700'}`}>
                                {f.nextFollowupAt ? new Date(f.nextFollowupAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'No date'}
                              </span>
                              {isOverdue && <span className="text-[10px] text-red-500 font-semibold">DUE NOW</span>}
                            </div>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedFollowup(f);
                                setRescheduleDate(f.nextFollowupAt ? new Date(f.nextFollowupAt).toISOString().slice(0, 16) : '');
                                setRescheduleMessage(f.nextSuggestedMessage || '');
                                setRescheduleReason(f.nextFollowupReason || '');
                              }}
                              className="text-xs text-gray-700 hover:bg-gray-100 h-8"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => handleExecuteFollowupNow(f.leadId)}
                              disabled={isPending}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold h-8"
                            >
                              <Send className="w-3.5 h-3.5 mr-1" /> Send Now
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

            </div>

            {/* Right 1 Col: Agent Ecosystem Status & Quick Controls */}
            <div className="space-y-6">
              
              {/* Agent Team Status */}
              <Card className="shadow-sm border-gray-200">
                <CardHeader className="bg-slate-50/70 border-b pb-3">
                  <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-blue-600" /> 5-Agent Multi-Agent Team
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3.5 text-xs">
                  <div className="flex items-start gap-3 p-2.5 bg-blue-50/50 rounded-lg border border-blue-100">
                    <div className="p-1.5 bg-blue-600 text-white rounded-md mt-0.5">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">Lead Auditor Agent</div>
                      <p className="text-gray-500 text-[11px]">Aggregates WhatsApp chats, human sales notes & timeline history.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100">
                    <div className="p-1.5 bg-indigo-600 text-white rounded-md mt-0.5">
                      <Brain className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">Lead Profiler Agent</div>
                      <p className="text-gray-500 text-[11px]">Extracts BANT criteria, sentiments, pain points & calculates lead score (0-100).</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2.5 bg-purple-50/50 rounded-lg border border-purple-100">
                    <div className="p-1.5 bg-purple-600 text-white rounded-md mt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">Follow-Up Strategist</div>
                      <p className="text-gray-500 text-[11px]">Calculates optimal follow-up deadline & determines next stage advancement.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2.5 bg-cyan-50/50 rounded-lg border border-cyan-100">
                    <div className="p-1.5 bg-cyan-600 text-white rounded-md mt-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">Copywriter Agent (RAG)</div>
                      <p className="text-gray-500 text-[11px]">Drafts tailored WhatsApp copy grounded in company knowledge base.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2.5 bg-emerald-50/50 rounded-lg border border-emerald-100">
                    <div className="p-1.5 bg-emerald-600 text-white rounded-md mt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">Safety & Anti-Ban Gate</div>
                      <p className="text-gray-500 text-[11px]">Enforces frequency caps, human approval routing & typing delays.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Batch Lead Intelligence Trigger */}
              <Card className="shadow-sm border-blue-100 bg-gradient-to-br from-blue-50/50 to-indigo-50/30">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-sm text-gray-900">Batch AI Lead Analysis</h3>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Trigger the full 5-agent AI pipeline across your entire CRM pipeline to refresh scores, BANT profiles, and follow-up schedules.
                  </p>
                  <Button
                    onClick={handleAnalyzeAllLeads}
                    disabled={isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Run Batch AI Analysis
                  </Button>
                </CardContent>
              </Card>

              {/* Active WhatsApp Gateway Session */}
              <Card className="shadow-sm border-gray-200">
                <CardContent className="p-4 space-y-2">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">WhatsApp Dispatch Gateway</div>
                  {data?.activeSession ? (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="font-bold text-emerald-900">{data.activeSession.sessionId}</span>
                      </div>
                      <span className="font-semibold text-emerald-700 uppercase text-[10px]">{data.activeSession.status}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-xs text-amber-800">
                      <span>No active WhatsApp session connected</span>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>

          </div>
        </div>
      )}

      {/* TAB 2: PROPOSALS QUEUE */}
      {activeTab === 'proposals' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase">Filter Status:</span>
              <div className="flex gap-1">
                {['ALL', 'PENDING_APPROVAL', 'APPROVED', 'AUTO_EXECUTED', 'REJECTED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setProposalStatusFilter(st)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      proposalStatusFilter === st
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {st.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {stats.pendingProposalsCount > 0 && (
              <Button
                size="sm"
                onClick={handleBatchApprove}
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                <Check className="w-3.5 h-3.5 mr-1" /> Approve All Pending ({stats.pendingProposalsCount})
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {proposals.length === 0 ? (
              <div className="col-span-2 text-center py-12 bg-white rounded-xl border border-gray-200 text-gray-400 text-sm">
                No action proposals match the selected filter.
              </div>
            ) : (
              proposals.map((p: any) => {
                const payload = JSON.parse(p.proposedPayload || '{}');
                return (
                  <Card key={p.id} className="shadow-sm border-gray-200 hover:shadow-md transition-shadow">
                    <CardHeader className="bg-slate-50/50 border-b pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-blue-600" />
                          <span className="font-bold text-sm text-gray-900">
                            {p.contact?.name || p.contact?.pushName || p.contact?.whatsappId}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.status === 'PENDING_APPROVAL' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          p.status === 'APPROVED' || p.status === 'AUTO_EXECUTED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {p.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">{p.contact?.whatsappId}</div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          {p.actionType}
                        </span>
                        <span className="text-gray-500">
                          Confidence: <strong className="text-gray-900">{Math.round((p.confidence || 0.8) * 100)}%</strong>
                        </span>
                      </div>

                      <p className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100 italic">
                        <strong>AI Reasoning:</strong> {p.reasoning}
                      </p>

                      {payload.message && (
                        <div className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs font-mono space-y-1">
                          <div className="text-[10px] text-slate-400 font-bold uppercase">Proposed WhatsApp Message:</div>
                          <div className="text-slate-200">{payload.message}</div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-400">
                        <span>Created: {new Date(p.createdAt).toLocaleDateString()}</span>
                        
                        {p.status === 'PENDING_APPROVAL' ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectProposal(p.id)}
                              disabled={isPending}
                              className="text-[11px] text-red-600 hover:bg-red-50 border-red-200 h-7 px-2"
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedProposal(p);
                                setEditProposalMsg(payload.message || '');
                                setEditProposalStage(payload.targetStageId || '');
                              }}
                              className="text-[11px] text-blue-600 hover:bg-blue-50 border-blue-200 h-7 px-2"
                            >
                              <Edit3 className="w-3 h-3 mr-1" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApproveProposal(p.id)}
                              disabled={isPending}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold h-7 px-2.5"
                            >
                              Approve
                            </Button>
                          </div>
                        ) : (
                          <span className="font-semibold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Executed
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: FOLLOWUPS SCHEDULER */}
      {activeTab === 'followups' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <Input
                placeholder="Search scheduled follow-ups by contact name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-gray-50 border-gray-200 text-xs"
              />
            </div>

            <Button
              size="sm"
              onClick={handleTriggerWorker}
              disabled={isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-sm"
            >
              <Play className="w-3.5 h-3.5 mr-1.5" /> Scan & Dispatch All Due Follow-Ups
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">AI Lead Score & Intent</th>
                    <th className="py-3 px-4">Follow-Up Deadline</th>
                    <th className="py-3 px-4">AI Suggested Message</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {scheduledFollowups.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-400">
                        No scheduled follow-ups found.
                      </td>
                    </tr>
                  ) : (
                    scheduledFollowups.map((f: any) => {
                      const isOverdue = f.nextFollowupAt && new Date(f.nextFollowupAt) <= new Date();
                      return (
                        <tr key={f.leadId} className="hover:bg-gray-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-gray-900">{f.contact?.name || f.contact?.pushName || 'Lead'}</div>
                            <div className="text-gray-500 text-[11px]">{f.contact?.whatsappId}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-blue-700">{f.leadScore}/100</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                f.buyingIntent === 'HIGH' ? 'bg-emerald-100 text-emerald-800' :
                                f.buyingIntent === 'MEDIUM' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {f.buyingIntent}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={`font-semibold block ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-900'}`}>
                              {f.nextFollowupAt ? new Date(f.nextFollowupAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'None'}
                            </span>
                            {isOverdue && <span className="text-[10px] text-red-500 font-bold uppercase">🚨 Due for dispatch</span>}
                          </td>

                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="text-gray-800 font-mono text-[11px] line-clamp-2 bg-gray-50 p-1.5 rounded border border-gray-100">
                              {f.nextSuggestedMessage || f.nextFollowupReason || 'No message drafted'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedFollowup(f);
                                  setRescheduleDate(f.nextFollowupAt ? new Date(f.nextFollowupAt).toISOString().slice(0, 16) : '');
                                  setRescheduleMessage(f.nextSuggestedMessage || '');
                                  setRescheduleReason(f.nextFollowupReason || '');
                                }}
                                className="text-xs text-blue-600 border-blue-200 hover:bg-blue-50 h-7"
                              >
                                <Calendar className="w-3.5 h-3.5 mr-1" /> Reschedule
                              </Button>

                              <Button
                                size="sm"
                                onClick={() => handleExecuteFollowupNow(f.leadId)}
                                disabled={isPending}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold h-7"
                              >
                                <Send className="w-3.5 h-3.5 mr-1" /> Send Now
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCancelFollowup(f.leadId)}
                                disabled={isPending}
                                className="text-gray-400 hover:text-red-600 h-7 px-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: LEAD INTELLIGENCE DIRECTORY */}
      {activeTab === 'profiles' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <Input
                placeholder="Search leads by name, WhatsApp phone or summary..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-gray-50 border-gray-200 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase">Intent:</span>
              <div className="flex gap-1">
                {['ALL', 'HIGH', 'MEDIUM', 'LOW', 'UNQUALIFIED'].map((intent) => (
                  <button
                    key={intent}
                    onClick={() => setIntentFilter(intent)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      intentFilter === intent
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {intent}
                  </button>
                ))}
              </div>

              <Button
                size="sm"
                onClick={handleAnalyzeAllLeads}
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold ml-2"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" /> Re-Analyze All
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leadProfiles.length === 0 ? (
              <div className="col-span-3 text-center py-12 bg-white rounded-xl border border-gray-200 text-gray-400 text-sm">
                No lead intelligence profiles found. Click "Re-Analyze All" to let AI generate intelligence cards!
              </div>
            ) : (
              leadProfiles.map((p: any) => {
                return (
                  <Card key={p.id} className="shadow-sm border-gray-200 hover:shadow-md transition-shadow flex flex-col justify-between">
                    <CardHeader className="bg-slate-50/60 border-b pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-sm text-gray-900">
                            {p.contact?.name || p.contact?.pushName || 'Unnamed Contact'}
                          </div>
                          <div className="text-xs text-gray-500">{p.contact?.whatsappId}</div>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-0.5 rounded text-xs font-extrabold ${
                            (p.leadScore || 0) >= 70 ? 'bg-emerald-100 text-emerald-800' :
                            (p.leadScore || 0) >= 40 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            Score: {p.leadScore}/100
                          </span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-bold">
                            Intent: {p.buyingIntent}
                          </span>
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-bold">
                            Sentiment: {p.sentiment}
                          </span>
                          {p.buyerPersona && (
                            <span className="px-2 py-0.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded text-[10px] font-bold">
                              {p.buyerPersona}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-gray-700 leading-relaxed line-clamp-3 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                          {p.summary || 'No summary available.'}
                        </p>

                        <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 pt-1">
                          <div>
                            <span className="font-bold text-gray-500 block">Budget:</span>
                            <span className="truncate block font-medium text-gray-900">{p.budget || 'Unknown'}</span>
                          </div>
                          <div>
                            <span className="font-bold text-gray-500 block">Need:</span>
                            <span className="truncate block font-medium text-gray-900">{p.need || 'Evaluating'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between mt-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setViewingProfileDetail(p)}
                          className="text-xs text-blue-600 hover:bg-blue-50 h-7 px-2"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> View Full Intel
                        </Button>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleReanalyzeLead(p.leadId)}
                            disabled={isPending}
                            title="Re-analyze with AI"
                            className="text-gray-500 hover:text-blue-600 h-7 px-2"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedProfile(p);
                              setEditProfileScore(p.leadScore || 50);
                              setEditProfileIntent(p.buyingIntent || 'MEDIUM');
                              setEditProfileSentiment(p.sentiment || 'NEUTRAL');
                              setEditProfileSummary(p.summary || '');
                              setEditProfileNeed(p.need || '');
                              setEditProfileBudget(p.budget || '');
                            }}
                            title="Edit Profile"
                            className="text-gray-500 hover:text-amber-600 h-7 px-2"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteProfile(p.leadId)}
                            disabled={isPending}
                            title="Delete AI Intelligence"
                            className="text-gray-500 hover:text-red-600 h-7 px-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT LOG */}
      {activeTab === 'activities' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase">Activity Type:</span>
              <div className="flex gap-1 flex-wrap">
                {['ALL', 'MESSAGE_SENT', 'LEAD_STAGE_CHANGED', 'NOTE_ADDED'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setActivityTypeFilter(type)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      activityTypeFilter === type
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {type.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => loadData(true)}
              disabled={refreshing || isPending}
              className="text-xs font-semibold text-gray-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh Log
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Event Type</th>
                    <th className="py-3 px-4">Execution Note / Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {aiActivities.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-gray-400">
                        No activity records found.
                      </td>
                    </tr>
                  ) : (
                    aiActivities.map((act: any) => (
                      <tr key={act.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3.5 px-4 text-gray-500 whitespace-nowrap">
                          {new Date(act.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-gray-900">{act.contact?.name || act.contact?.pushName || 'Contact'}</div>
                          <div className="text-gray-500 text-[11px]">{act.contact?.whatsappId}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            act.type === 'MESSAGE_SENT' ? 'bg-emerald-100 text-emerald-800' :
                            act.type === 'LEAD_STAGE_CHANGED' ? 'bg-blue-100 text-blue-800' :
                            act.type === 'NOTE_ADDED' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {act.type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-gray-800">
                          {act.description}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <AISettingsPanel />
        </div>
      )}

      {/* MODAL 1: EDIT & APPROVE PROPOSAL */}
      {selectedProposal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-300" />
                <h3 className="font-bold text-base">Edit & Approve AI Proposal</h3>
              </div>
              <button onClick={() => setSelectedProposal(null)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditAndApproveProposal} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Target Contact</label>
                <div className="text-sm font-semibold text-gray-900 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                  {selectedProposal.contact?.name || selectedProposal.contact?.pushName || selectedProposal.contact?.whatsappId} ({selectedProposal.contact?.whatsappId})
                </div>
              </div>

              {stages && stages.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Move Pipeline Stage (Optional)</label>
                  <select
                    value={editProposalStage}
                    onChange={(e) => setEditProposalStage(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Keep current pipeline stage</option>
                    {stages.map((st: any) => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">WhatsApp Follow-Up Message Body</label>
                <textarea
                  value={editProposalMsg}
                  onChange={(e) => setEditProposalMsg(e.target.value)}
                  rows={4}
                  className="w-full bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-900 focus:ring-1 focus:ring-blue-500 resize-none font-mono"
                  placeholder="Type or adjust the WhatsApp message..."
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedProposal(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  <Send className="w-3.5 h-3.5 mr-1" /> Approve & Dispatch Now
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RESCHEDULE / EDIT FOLLOWUP */}
      {selectedFollowup && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 bg-gradient-to-r from-purple-900 to-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-300" />
                <h3 className="font-bold text-base">Reschedule Follow-Up Deadline</h3>
              </div>
              <button onClick={() => setSelectedFollowup(null)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReschedule} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Target Contact</label>
                <div className="text-sm font-semibold text-gray-900 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                  {selectedFollowup.contact?.name || selectedFollowup.contact?.pushName || selectedFollowup.contact?.whatsappId}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Next Follow-Up Deadline</label>
                <Input
                  type="datetime-local"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="bg-white text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Follow-Up Reason / Strategy</label>
                <Input
                  type="text"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="e.g. Inquire about pricing decision after demo"
                  className="bg-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Prepared WhatsApp Copy</label>
                <textarea
                  value={rescheduleMessage}
                  onChange={(e) => setRescheduleMessage(e.target.value)}
                  rows={3}
                  className="w-full bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-900 focus:ring-1 focus:ring-purple-500 resize-none font-mono"
                  placeholder="WhatsApp message text..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedFollowup(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
                >
                  Save Schedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT LEAD INTELLIGENCE PROFILE */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 bg-gradient-to-r from-slate-900 to-blue-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-300" />
                <h3 className="font-bold text-base">Edit AI Lead Intelligence Card</h3>
              </div>
              <button onClick={() => setSelectedProfile(null)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfileEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Lead Score (0-100)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={editProfileScore}
                    onChange={(e) => setEditProfileScore(Number(e.target.value))}
                    className="bg-white text-xs font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Buying Intent</label>
                  <select
                    value={editProfileIntent}
                    onChange={(e) => setEditProfileIntent(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800"
                  >
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                    <option value="UNQUALIFIED">UNQUALIFIED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Sentiment</label>
                  <select
                    value={editProfileSentiment}
                    onChange={(e) => setEditProfileSentiment(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800"
                  >
                    <option value="POSITIVE">POSITIVE</option>
                    <option value="CURIOUS">CURIOUS</option>
                    <option value="NEUTRAL">NEUTRAL</option>
                    <option value="FRUSTRATED">FRUSTRATED</option>
                    <option value="COLD">COLD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Executive AI Summary</label>
                <textarea
                  value={editProfileSummary}
                  onChange={(e) => setEditProfileSummary(e.target.value)}
                  rows={3}
                  className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-xs text-gray-900 focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Need / Requirement</label>
                  <Input
                    type="text"
                    value={editProfileNeed}
                    onChange={(e) => setEditProfileNeed(e.target.value)}
                    className="bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Budget</label>
                  <Input
                    type="text"
                    value={editProfileBudget}
                    onChange={(e) => setEditProfileBudget(e.target.value)}
                    className="bg-white text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedProfile(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  Save Profile Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: VIEW FULL INTEL MODAL */}
      {viewingProfileDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Brain className="w-5 h-5 text-blue-300" />
                  Full Lead Intelligence Analysis
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  {viewingProfileDetail.contact?.name || viewingProfileDetail.contact?.pushName} ({viewingProfileDetail.contact?.whatsappId})
                </p>
              </div>
              <button onClick={() => setViewingProfileDetail(null)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-gray-500 font-bold uppercase text-[10px] block">Lead Score</span>
                  <span className="text-lg font-extrabold text-blue-700">{viewingProfileDetail.leadScore}/100</span>
                </div>
                <div>
                  <span className="text-gray-500 font-bold uppercase text-[10px] block">Buying Intent</span>
                  <span className="text-sm font-bold text-emerald-700">{viewingProfileDetail.buyingIntent}</span>
                </div>
                <div>
                  <span className="text-gray-500 font-bold uppercase text-[10px] block">Sentiment</span>
                  <span className="text-sm font-bold text-indigo-700">{viewingProfileDetail.sentiment}</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-900 uppercase text-[11px] mb-1">Executive Summary</h4>
                <p className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-gray-800 leading-relaxed">
                  {viewingProfileDetail.summary || 'No summary available.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <span className="font-bold text-gray-700 block mb-1">Budget</span>
                  <span className="text-gray-900">{viewingProfileDetail.budget || 'Not specified'}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <span className="font-bold text-gray-700 block mb-1">Timeline</span>
                  <span className="text-gray-900">{viewingProfileDetail.timeline || 'Not specified'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <span className="font-bold text-gray-700 block mb-1">Pain Points</span>
                  <span className="text-gray-900">{viewingProfileDetail.painPoints || 'None detected'}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <span className="font-bold text-gray-700 block mb-1">Objections</span>
                  <span className="text-gray-900">{viewingProfileDetail.objections || 'None detected'}</span>
                </div>
              </div>

              {viewingProfileDetail.nextSuggestedMessage && (
                <div>
                  <h4 className="font-bold text-gray-900 uppercase text-[11px] mb-1">Next Suggested WhatsApp Copy</h4>
                  <div className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono">
                    {viewingProfileDetail.nextSuggestedMessage}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <Button
                onClick={() => setViewingProfileDetail(null)}
                className="bg-gray-900 text-white text-xs font-semibold px-5"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
