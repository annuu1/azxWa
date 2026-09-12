'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { 
  Eye, 
  User, 
  RefreshCw, 
  Layers, 
  Sparkles, 
  Clock, 
  Flame, 
  Check, 
  X, 
  ShieldCheck, 
  Bot, 
  Zap,
  MessageSquare,
  TrendingUp,
  AlertCircle,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  UserPlus,
  Phone,
  ArrowRight,
  Search,
  Radio,
  Send
} from 'lucide-react';
import { 
  updateLeadStage, 
  assignLeadAgent,
  createLeadForContact,
  createManualContactAndLead,
  convertAllContactsToLeads,
  moveLeadStageStep,
  deleteLead
} from '../actions/crm-actions';
import { 
  analyzeLeadWithAi, 
  analyzeAllPipelineLeadsAction, 
  approveProposalAction, 
  rejectProposalAction,
  toggleAiExecutionModeAction,
  getAiModeSettingAction,
  triggerFollowupWorkerAction
} from '@/features/ai/actions/multi-agent-actions';

interface PipelineBoardProps {
  stages: any[];
  leads: any[];
  agents: any[];
  contacts?: any[];
  onSelectContact: (id: string) => void;
  onUpdate: () => void;
}

const DEFAULT_STAGES = [
  { id: 'New', name: 'New', position: 1 },
  { id: 'Contacted', name: 'Contacted', position: 2 },
  { id: 'Qualified', name: 'Qualified', position: 3 },
  { id: 'Proposal', name: 'Proposal', position: 4 },
  { id: 'Won', name: 'Won', position: 5 },
  { id: 'Lost', name: 'Lost', position: 6 },
];

export default function PipelineBoard({ 
  stages, 
  leads, 
  agents, 
  contacts = [],
  onSelectContact, 
  onUpdate 
}: PipelineBoardProps) {
  const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [convertingAll, setConvertingAll] = useState(false);
  const [aiMode, setAiMode] = useState<'AUTONOMOUS' | 'APPROVAL_REQUIRED'>('APPROVAL_REQUIRED');
  const [togglingMode, setTogglingMode] = useState(false);
  const [approvingProposalId, setApprovingProposalId] = useState<string | null>(null);
  const [runningWorker, setRunningWorker] = useState(false);
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [filterStagnantOnly, setFilterStagnantOnly] = useState(false);
  const [expandedColumns, setExpandedColumns] = useState<Record<string, boolean>>({});

  // Add Deal Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'existing' | 'new'>('existing');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [targetStageId, setTargetStageId] = useState('');
  const [targetAgentId, setTargetAgentId] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [savingLead, setSavingLead] = useState(false);

  // Ensure stages array is always populated with real or fallback stages
  const safeStages = useMemo(() => {
    if (Array.isArray(stages) && stages.length > 0) {
      return stages;
    }
    return DEFAULT_STAGES;
  }, [stages]);

  const safeLeads = Array.isArray(leads) ? leads : [];
  const safeContacts = Array.isArray(contacts) ? contacts : [];

  // Filter leads by search term and stagnation status
  const filteredLeads = useMemo(() => {
    let result = safeLeads;

    if (pipelineSearch.trim()) {
      const query = pipelineSearch.toLowerCase();
      result = result.filter(item => {
        const c = item.contact || {};
        return (
          (c.name || '').toLowerCase().includes(query) ||
          (c.pushName || '').toLowerCase().includes(query) ||
          (c.whatsappId || '').toLowerCase().includes(query)
        );
      });
    }

    if (filterStagnantOnly) {
      const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
      result = result.filter(item => {
        const lastUpdated = new Date(item.updatedAt || item.createdAt).getTime();
        return lastUpdated <= twoDaysAgo;
      });
    }

    return result;
  }, [safeLeads, pipelineSearch, filterStagnantOnly]);

  // Group leads by their stageId using useMemo
  const leadsByStage = useMemo(() => {
    const grouped = new Map<string, any[]>();
    for (const stage of safeStages) {
      grouped.set(stage.id, []);
    }
    for (const lead of filteredLeads) {
      const targetId = lead.stageId && grouped.has(lead.stageId) ? lead.stageId : safeStages[0]?.id;
      if (targetId) {
        if (!grouped.has(targetId)) {
          grouped.set(targetId, []);
        }
        grouped.get(targetId)!.push(lead);
      }
    }
    return grouped;
  }, [safeStages, filteredLeads]);

  useEffect(() => {
    getAiModeSettingAction().then(res => {
      if (res.success && res.aiMode) {
        setAiMode(res.aiMode);
      }
    });
  }, []);

  const openAddLeadModal = (stageId?: string) => {
    const initialStage = stageId || safeStages[0]?.id || 'New';
    setTargetStageId(initialStage);
    setTargetAgentId('');
    if (safeContacts.length === 0) {
      setAddMode('new');
      setSelectedContactId('');
    } else {
      setAddMode('existing');
      setSelectedContactId(safeContacts[0]?.id || '');
    }
    setNewContactName('');
    setNewContactPhone('');
    setContactSearchQuery('');
    setShowAddModal(true);
  };

  const handleToggleMode = async () => {
    setTogglingMode(true);
    const newMode = aiMode === 'AUTONOMOUS' ? 'APPROVAL_REQUIRED' : 'AUTONOMOUS';
    try {
      const res = await toggleAiExecutionModeAction(newMode);
      if (res.success) {
        setAiMode(newMode);
      }
    } finally {
      setTogglingMode(false);
    }
  };

  const handleStageChange = async (leadId: string, newStageId: string) => {
    setLoadingLeadId(leadId);
    try {
      const result = await updateLeadStage(leadId, newStageId);
      if (result.success) {
        onUpdate();
      }
    } finally {
      setLoadingLeadId(null);
    }
  };

  const handleStepStage = async (leadId: string, direction: 'prev' | 'next') => {
    setLoadingLeadId(leadId);
    try {
      const result = await moveLeadStageStep(leadId, direction);
      if (result.success) {
        onUpdate();
      }
    } finally {
      setLoadingLeadId(null);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('Remove this lead from the deals pipeline? The contact record will remain in your directory.')) return;
    setLoadingLeadId(leadId);
    try {
      const result = await deleteLead(leadId);
      if (result.success) {
        onUpdate();
      }
    } finally {
      setLoadingLeadId(null);
    }
  };

  const handleAgentChange = async (leadId: string, agentId: string) => {
    setLoadingLeadId(leadId);
    try {
      const target = agentId === 'unassigned' ? null : agentId;
      const result = await assignLeadAgent(leadId, target);
      if (result.success) {
        onUpdate();
      }
    } finally {
      setLoadingLeadId(null);
    }
  };

  const handleRunAiForLead = async (leadId: string) => {
    setLoadingLeadId(leadId);
    try {
      const res = await analyzeLeadWithAi(leadId);
      if (res.success) {
        onUpdate();
      }
    } finally {
      setLoadingLeadId(null);
    }
  };

  const handleBatchAnalyze = async () => {
    setAnalyzingAll(true);
    try {
      const res = await analyzeAllPipelineLeadsAction();
      if (res.success) {
        onUpdate();
      }
    } finally {
      setAnalyzingAll(false);
    }
  };

  const handleConvertAll = async () => {
    setConvertingAll(true);
    try {
      const res = await convertAllContactsToLeads();
      if (res.success) {
        onUpdate();
      }
    } finally {
      setConvertingAll(false);
    }
  };

  const handleApproveProposal = async (proposalId: string) => {
    setApprovingProposalId(proposalId);
    try {
      const res = await approveProposalAction(proposalId);
      if (res.success) {
        onUpdate();
      }
    } finally {
      setApprovingProposalId(null);
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    setApprovingProposalId(proposalId);
    try {
      const res = await rejectProposalAction(proposalId);
      if (res.success) {
        onUpdate();
      }
    } finally {
      setApprovingProposalId(null);
    }
  };

  const handleTriggerWorker = async () => {
    setRunningWorker(true);
    try {
      const res = await triggerFollowupWorkerAction();
      if (res.success) {
        onUpdate();
      }
    } finally {
      setRunningWorker(false);
    }
  };

  const handleSaveNewLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLead(true);
    try {
      const stageToUse = targetStageId || safeStages[0]?.id;
      if (addMode === 'existing') {
        if (!selectedContactId) return;
        const res = await createLeadForContact(selectedContactId, stageToUse);
        if (res.success) {
          setShowAddModal(false);
          onUpdate();
        }
      } else {
        if (!newContactPhone.trim()) return;
        const res = await createManualContactAndLead({
          name: newContactName.trim() || newContactPhone.trim(),
          phone: newContactPhone.trim(),
          stageId: stageToUse,
          assignedUserId: targetAgentId || undefined,
        });
        if (res.success) {
          setShowAddModal(false);
          onUpdate();
        }
      }
    } finally {
      setSavingLead(false);
    }
  };

  // Filter contacts for existing contact selector modal
  const filteredContactsForModal = safeContacts.filter(c => {
    const query = contactSearchQuery.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(query) ||
      (c.pushName || '').toLowerCase().includes(query) ||
      (c.whatsappId || '').toLowerCase().includes(query)
    );
  });

  const toggleExpand = (stageId: string) => {
    setExpandedColumns(prev => ({
      ...prev,
      [stageId]: !prev[stageId]
    }));
  };

  return (
    <div className="space-y-4">
      {/* Top AI Agent Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-gray-200/80 rounded-xl p-3 shadow-xs">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-xs text-gray-900">Multi-Agent Lead Intelligence Engine</span>
              <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                aiMode === 'AUTONOMOUS' 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {aiMode === 'AUTONOMOUS' ? <Zap className="w-3 h-3 mr-1" /> : <ShieldCheck className="w-3 h-3 mr-1" />}
                {aiMode === 'AUTONOMOUS' ? 'Autonomous Mode' : 'Co-Pilot Approval Required'}
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              {aiMode === 'AUTONOMOUS' 
                ? 'Agents automatically schedule follow-ups, advance stages, and execute decisions.' 
                : 'Agents synthesize lead notes and propose actions for human approval.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Add New Deal Button */}
          <Button
            size="sm"
            onClick={() => openAddLeadModal()}
            className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Deal to Pipeline
          </Button>

          {/* Sync / Convert All Contacts Button */}
          {safeContacts.length > 0 && safeLeads.length < safeContacts.length && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleConvertAll}
              disabled={convertingAll}
              title="Import all contacts directory records as active pipeline deals"
              className="text-xs h-8 font-medium border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-100/50"
            >
              {convertingAll ? (
                <RefreshCw className="animate-spin w-3.5 h-3.5 mr-1.5" />
              ) : (
                <UserPlus className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
              )}
              Add All Contacts ({safeContacts.length}) to Pipeline
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleMode}
            disabled={togglingMode}
            className="text-xs h-8 font-medium"
          >
            {togglingMode ? <RefreshCw className="animate-spin w-3.5 h-3.5 mr-1" /> : null}
            Switch to {aiMode === 'AUTONOMOUS' ? 'Co-Pilot Mode' : 'Autonomous Mode'}
          </Button>

          <Button
            size="sm"
            onClick={handleBatchAnalyze}
            disabled={analyzingAll}
            className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            {analyzingAll ? (
              <>
                <RefreshCw className="animate-spin w-3.5 h-3.5 mr-1.5" />
                Analyzing Pipeline Leads...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-blue-200" />
                Analyze All Leads with AI
              </>
            )}
          </Button>

          {/* Trigger Due Follow-ups Worker button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleTriggerWorker}
            disabled={runningWorker}
            title="Execute due follow-ups immediately via background worker"
            className="text-xs h-8 font-medium border-emerald-200 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100/50"
          >
            {runningWorker ? (
              <RefreshCw className="animate-spin w-3.5 h-3.5 mr-1.5" />
            ) : (
              <Send className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            )}
            Process Due Follow-Ups
          </Button>
        </div>
      </div>

      {/* Filter / Search toolbar */}
      <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-gray-200/80">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
          <Input
            value={pipelineSearch}
            onChange={(e) => setPipelineSearch(e.target.value)}
            placeholder="Search deals in pipeline..."
            className="pl-8 h-8 text-xs bg-gray-50"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={filterStagnantOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStagnantOnly(!filterStagnantOnly)}
            className={`h-8 text-xs font-medium ${
              filterStagnantOnly 
                ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600' 
                : 'text-amber-800 border-amber-300 hover:bg-amber-50 bg-amber-50/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5 mr-1" />
            {filterStagnantOnly ? 'Showing Inactive Deals (>48h)' : 'Filter Inactive (>48h)'}
          </Button>
          <div className="text-xs text-gray-500 font-medium">
            Total Deals: <span className="font-bold text-gray-900">{safeLeads.length}</span>
            {(pipelineSearch || filterStagnantOnly) && ` (Filtered: ${filteredLeads.length})`}
          </div>
        </div>
      </div>

      {/* Main Board Area */}
      <div className="flex space-x-4 overflow-x-auto pb-6 min-h-[calc(100vh-270px)] items-start w-full">
        {safeStages.map((stage, stageIndex) => {
          const stageLeads = leadsByStage.get(stage.id) || [];
          const isFirstStage = stageIndex === 0;
          const isLastStage = stageIndex === safeStages.length - 1;
          const isExpanded = expandedColumns[stage.id] || false;
          const displayLeads = isExpanded ? stageLeads : stageLeads.slice(0, 30);
          const hasMore = stageLeads.length > 30 && !isExpanded;

          return (
            <div 
              key={stage.id} 
              className="w-80 shrink-0 bg-gray-50/80 border border-gray-200/80 rounded-xl p-3 flex flex-col max-h-[calc(100vh-250px)] shadow-2xs"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                  <h4 className="font-bold text-gray-800 text-xs sm:text-sm">{stage.name}</h4>
                  <span className="text-[11px] font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                    {stageLeads.length}
                  </span>
                </div>

                {/* Add deal to this specific stage */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openAddLeadModal(stage.id)}
                  title={`Add new lead to ${stage.name}`}
                  className="h-6 w-6 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Leads Scroll Area */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {displayLeads.map((item) => {
                  const leadId = item.id;
                  const contact = item.contact || {};
                  const assignedUser = item.assignedUser;
                  const intel = item.intelligence;
                  const pendingProposal = item.pendingProposal;
                  const isItemLoading = loadingLeadId === leadId;

                  // Parse score & intent
                  const score = intel?.leadScore ?? null;
                  const sentiment = intel?.sentiment || 'NEUTRAL';
                  const nextFollowup = intel?.nextFollowupAt ? new Date(intel.nextFollowupAt) : null;
                  const lastUpdated = new Date(item.updatedAt || item.createdAt).getTime();
                  const daysInactive = Math.floor((Date.now() - lastUpdated) / (1000 * 60 * 60 * 24));

                  return (
                    <Card 
                      key={leadId} 
                      className={`bg-white shadow-xs border border-gray-200 hover:shadow-md transition-shadow relative overflow-hidden group ${isItemLoading ? 'opacity-60 pointer-events-none' : ''}`}
                    >
                      <CardContent className="p-3 space-y-2.5">
                        {/* Contact Info & Details Button */}
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 flex-1 pr-2">
                            <h5 className="font-bold text-gray-900 leading-tight text-xs sm:text-sm truncate">
                              {contact.name || contact.pushName || 'WhatsApp Lead'}
                            </h5>
                            <span className="text-[10px] font-mono text-gray-400 block mt-0.5 truncate">
                              {contact.whatsappId ? contact.whatsappId.replace('@c.us', '') : 'No Number'}
                            </span>
                            {daysInactive >= 2 && (
                              <span className={`inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded mt-1 ${
                                daysInactive >= 7 
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                <Clock className="w-2.5 h-2.5 mr-1 shrink-0" />
                                {daysInactive >= 7 ? `Stagnant ${daysInactive}d` : `Inactive ${daysInactive}d`}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-1 shrink-0">
                            <Button 
                              variant="outline" 
                              size="icon" 
                              onClick={() => handleRunAiForLead(leadId)}
                              title="Run Multi-Agent Lead Intelligence & Follow-up Planner"
                              className="h-6 w-6 text-blue-600 border-blue-200 hover:bg-blue-50"
                            >
                              <Sparkles className="w-3 h-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => onSelectContact(contact.id)}
                              title="View Profile & Notes"
                              className="h-6 w-6 text-gray-400 hover:text-blue-600"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDeleteLead(leadId)}
                              title="Remove lead from pipeline"
                              className="h-6 w-6 text-gray-300 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>

                        {/* AI Lead Score & Sentiment Badges */}
                        {intel ? (
                          <div className="space-y-1.5 bg-gray-50/80 border border-gray-100 rounded-lg p-2">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className={`font-bold px-1.5 py-0.5 rounded flex items-center ${
                                score >= 75 
                                  ? 'bg-orange-100 text-orange-700' 
                                  : score >= 50 
                                  ? 'bg-amber-100 text-amber-700' 
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                <Flame className="w-3 h-3 mr-0.5 shrink-0" />
                                {score >= 75 ? 'Hot Lead' : score >= 50 ? 'Warm Lead' : 'Cold Lead'} ({score}%)
                              </span>
                              <span className="font-semibold text-gray-500 capitalize">
                                {sentiment.toLowerCase()}
                              </span>
                            </div>

                            {/* Client summary snippet */}
                            <p className="text-[11px] text-gray-600 line-clamp-2 leading-relaxed italic">
                              "{intel.summary}"
                            </p>

                            {/* Next Follow-up Indicator */}
                            {nextFollowup && (
                              <div className={`flex items-center text-[10px] pt-1 border-t border-gray-200/50 font-medium ${
                                nextFollowup <= new Date() 
                                  ? 'text-red-600 font-bold' 
                                  : 'text-blue-700'
                              }`}>
                                <Clock className={`w-3 h-3 mr-1 shrink-0 ${nextFollowup <= new Date() ? 'text-red-500 animate-pulse' : 'text-blue-500'}`} />
                                <span className="truncate">
                                  {nextFollowup <= new Date() 
                                    ? '🔥 Follow-Up Due Now' 
                                    : `Follow-up: ${nextFollowup.toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-gray-50/50 border border-dashed border-gray-200 rounded-lg p-1.5 text-center">
                            <button 
                              type="button" 
                              onClick={() => handleRunAiForLead(leadId)}
                              className="text-[10px] text-blue-600 font-semibold hover:underline flex items-center justify-center w-full"
                            >
                              <Sparkles className="w-3 h-3 mr-1 text-blue-500" /> Analyze lead with AI
                            </button>
                          </div>
                        )}

                        {/* Pending AI Action Proposal */}
                        {pendingProposal && (
                          <div className="bg-amber-50/90 border border-amber-200/90 rounded-lg p-2 text-xs space-y-1.5 animate-in fade-in">
                            <div className="flex items-center justify-between text-[10px] font-bold text-amber-800">
                              <span className="flex items-center">
                                <AlertCircle className="w-3 h-3 mr-1 text-amber-600" /> AI Proposal Pending
                              </span>
                              <span className="bg-amber-200/80 px-1.5 py-0.2 rounded text-[9px]">
                                {Math.round(Number(pendingProposal.confidence || 0.85) * 100)}% Conf
                              </span>
                            </div>

                            <p className="text-[11px] text-amber-900 leading-snug font-medium line-clamp-2">
                              {pendingProposal.reasoning}
                            </p>

                            <div className="flex items-center space-x-1.5 pt-1">
                              <Button
                                size="sm"
                                onClick={() => handleApproveProposal(pendingProposal.id)}
                                disabled={approvingProposalId === pendingProposal.id}
                                className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex-1"
                              >
                                {approvingProposalId === pendingProposal.id ? <RefreshCw className="animate-spin w-3 h-3" /> : <Check className="w-3 h-3 mr-1" />}
                                Approve & Execute
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRejectProposal(pendingProposal.id)}
                                disabled={approvingProposalId === pendingProposal.id}
                                className="h-6 px-2 text-[10px] text-gray-600 hover:bg-gray-100"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Display Tags */}
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.tags.map((tag: any) => (
                              <span
                                key={tag.id}
                                style={{ backgroundColor: `${tag.color}10`, color: tag.color, borderColor: `${tag.color}25` }}
                                className="text-[10px] font-medium border px-1.5 py-0.2 rounded"
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Dropdown controls (Stage & Assignee) & Move Buttons */}
                        <div className="pt-2 border-t border-gray-100 space-y-2">
                          <div className="grid grid-cols-2 gap-1.5 text-xs">
                            {/* Assign Agent select */}
                            <div className="space-y-0.5">
                              <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider block">Agent</label>
                              <select
                                value={assignedUser?.id || 'unassigned'}
                                onChange={(e) => handleAgentChange(leadId, e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded p-1 text-[10px] focus:outline-none"
                              >
                                <option value="unassigned">Unassigned</option>
                                {agents.map(a => (
                                  <option key={a.id} value={a.id}>{a.email.split('@')[0]}</option>
                                ))}
                              </select>
                            </div>

                            {/* Move Stage select */}
                            <div className="space-y-0.5">
                              <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider block">Stage</label>
                              <select
                                value={stage.id}
                                onChange={(e) => handleStageChange(leadId, e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded p-1 text-[10px] focus:outline-none"
                              >
                                {safeStages.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Quick Stage Progression Buttons */}
                          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isFirstStage || isItemLoading}
                              onClick={() => handleStepStage(leadId, 'prev')}
                              className="h-6 px-1.5 text-[10px] text-gray-500 hover:text-gray-900 disabled:opacity-30"
                              title="Move back one stage"
                            >
                              <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Prev
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isLastStage || isItemLoading}
                              onClick={() => handleStepStage(leadId, 'next')}
                              className="h-6 px-1.5 text-[10px] text-blue-600 font-semibold hover:bg-blue-50 disabled:opacity-30"
                              title="Advance to next stage"
                            >
                              Next <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>

                      {isItemLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px] z-20">
                          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                        </div>
                      )}
                    </Card>
                  );
                })}

                {/* Show more button if truncated */}
                {hasMore && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleExpand(stage.id)}
                    className="w-full text-[11px] h-7 bg-white text-blue-600 hover:bg-blue-50 border-blue-200"
                  >
                    Show all {stageLeads.length} deals in {stage.name}
                  </Button>
                )}

                {isExpanded && stageLeads.length > 30 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpand(stage.id)}
                    className="w-full text-[11px] h-6 text-gray-500 hover:text-gray-700"
                  >
                    Show less
                  </Button>
                )}

                {stageLeads.length === 0 && (
                  <div className="text-center py-6 px-3 bg-white/50 border border-dashed rounded-lg border-gray-200 space-y-2">
                    <p className="text-[11px] text-gray-400 italic">No deals in this stage</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAddLeadModal(stage.id)}
                      className="text-[11px] h-7 w-full border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 text-gray-700"
                    >
                      <Plus className="w-3 h-3 mr-1 text-emerald-600" /> Add Deal Here
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Deal / Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm">Add Deal to Pipeline</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowAddModal(false)}
                className="h-7 w-7 text-gray-400 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Mode Tabs */}
            <div className="flex border-b border-gray-100 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAddMode('existing')}
                className={`flex-1 py-2.5 text-center border-b-2 transition-colors ${
                  addMode === 'existing' 
                    ? 'border-blue-600 text-blue-600 bg-blue-50/20' 
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                Select Existing Contact ({safeContacts.length})
              </button>
              <button
                type="button"
                onClick={() => setAddMode('new')}
                className={`flex-1 py-2.5 text-center border-b-2 transition-colors ${
                  addMode === 'new' 
                    ? 'border-blue-600 text-blue-600 bg-blue-50/20' 
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                + Create New Contact
              </button>
            </div>

            <form onSubmit={handleSaveNewLead} className="p-5 space-y-4 text-xs">
              {addMode === 'existing' ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-gray-700 block">Select Contact</label>
                    <Input
                      placeholder="Type to filter contacts..."
                      value={contactSearchQuery}
                      onChange={(e) => setContactSearchQuery(e.target.value)}
                      className="text-xs h-8 mb-1.5"
                    />
                    <select
                      value={selectedContactId}
                      onChange={(e) => setSelectedContactId(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    >
                      <option value="" disabled>-- Choose a contact --</option>
                      {filteredContactsForModal.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name || c.pushName || 'User'} ({c.whatsappId ? c.whatsappId.replace('@c.us', '') : 'No number'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-gray-700 block">Contact Name</label>
                    <Input
                      placeholder="e.g. John Doe, Acme Corp"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                      className="text-xs h-8"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-gray-700 block">Phone / WhatsApp Number</label>
                    <Input
                      placeholder="e.g. 919876543210"
                      value={newContactPhone}
                      onChange={(e) => setNewContactPhone(e.target.value)}
                      className="text-xs h-8"
                      required
                    />
                    <span className="text-[10px] text-gray-400">Include country code without '+' or special symbols</span>
                  </div>
                </div>
              )}

              {/* Target Stage & Agent Selection */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 block">Pipeline Stage</label>
                  <select
                    value={targetStageId}
                    onChange={(e) => setTargetStageId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs focus:outline-none"
                    required
                  >
                    {safeStages.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 block">Assign Agent</label>
                  <select
                    value={targetAgentId}
                    onChange={(e) => setTargetAgentId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.email.split('@')[0]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingLead}
                  className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {savingLead ? <RefreshCw className="animate-spin w-3.5 h-3.5 mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                  Save Deal to Pipeline
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
