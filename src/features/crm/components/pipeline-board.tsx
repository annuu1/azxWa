'use client';

import { useState, useMemo } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Eye, User, RefreshCw, Layers } from 'lucide-react';
import { updateLeadStage, assignLeadAgent } from '../actions/crm-actions';

interface PipelineBoardProps {
  stages: any[];
  leads: any[];
  agents: any[];
  onSelectContact: (id: string) => void;
  onUpdate: () => void;
}

export default function PipelineBoard({ 
  stages, 
  leads, 
  agents, 
  onSelectContact, 
  onUpdate 
}: PipelineBoardProps) {
  const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null);

  const handleStageChange = async (leadId: string, targetStageId: string) => {
    setLoadingLeadId(leadId);
    try {
      const result = await updateLeadStage(leadId, targetStageId);
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
      const targetAgentId = agentId === 'unassigned' ? null : agentId;
      const result = await assignLeadAgent(leadId, targetAgentId);
      if (result.success) {
        onUpdate();
      }
    } finally {
      setLoadingLeadId(null);
    }
  };

  // Group leads by their stageId
  const leadsByStage = useMemo(() => {
    const grouped = new Map<string, any[]>();
    // Pre-populate with empty arrays for all stages to ensure every stage has an entry
    stages.forEach(stage => grouped.set(stage.id, []));

    leads.forEach(lead => {
      const stageLeads = grouped.get(lead.stageId);
      if (stageLeads) {
        stageLeads.push(lead);
      } else {
        grouped.set(lead.stageId, [lead]);
      }
    });
    return grouped;
  }, [leads, stages]);

  return (
    <div className="flex space-x-4 overflow-x-auto pb-6 -mx-8 px-8 min-h-[calc(100vh-220px)] items-start">
      {stages.map((stage) => {
        const stageLeads = leadsByStage.get(stage.id) || [];

        return (
          <div 
            key={stage.id} 
            className="w-80 shrink-0 bg-gray-50/70 border border-gray-100 rounded-xl p-4 flex flex-col max-h-[calc(100vh-250px)]"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200/50">
              <div className="flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <h4 className="font-bold text-gray-800 text-sm">{stage.name}</h4>
              </div>
              <span className="text-xs font-semibold text-gray-400 bg-gray-200/50 px-2 py-0.5 rounded-full">
                {stageLeads.length}
              </span>
            </div>

            {/* Leads Scroll Area */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {stageLeads.map((item) => {
                const leadId = item.id;
                const contact = item.contact;
                const assignedUser = item.assignedUser;
                const isItemLoading = loadingLeadId === leadId;

                return (
                  <Card 
                    key={leadId} 
                    className={`bg-white shadow-sm border border-gray-200/70 hover:shadow-md transition-shadow relative overflow-hidden group ${isItemLoading ? 'opacity-60 pointer-events-none' : ''}`}
                  >
                    <CardContent className="p-4 space-y-4">
                      {/* Contact Info & Details Button */}
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="font-bold text-gray-900 leading-tight">
                            {contact.name || contact.pushName || 'WhatsApp Lead'}
                          </h5>
                          <span className="text-[10px] font-mono text-gray-400 block mt-0.5">{contact.whatsappId}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => onSelectContact(contact.id)}
                          className="h-7 w-7 text-gray-400 hover:text-blue-600 transition-colors shrink-0"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Display Tags */}
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.tags.map((tag: any) => (
                            <span
                              key={tag.id}
                              style={{ backgroundColor: `${tag.color}10`, color: tag.color, borderColor: `${tag.color}25` }}
                              className="text-[10px] font-medium border px-1.5 py-0.5 rounded"
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Dropdown controls (Stage & Assignee) */}
                      <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
                        {/* Assign Agent select */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Agent</label>
                          <select
                            value={assignedUser?.id || 'unassigned'}
                            onChange={(e) => handleAgentChange(leadId, e.target.value)}
                            className="w-full bg-gray-50 border rounded p-1 text-[11px] focus:outline-none"
                          >
                            <option value="unassigned">Unassigned</option>
                            {agents.map(a => (
                              <option key={a.id} value={a.id}>{a.email.split('@')[0]}</option>
                            ))}
                          </select>
                        </div>

                        {/* Move Stage select */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Stage</label>
                          <select
                            value={stage.id}
                            onChange={(e) => handleStageChange(leadId, e.target.value)}
                            className="w-full bg-gray-50 border rounded p-1 text-[11px] focus:outline-none"
                          >
                            {stages.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </CardContent>
                    {isItemLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/20 backdrop-blur-[0.5px]">
                        <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                      </div>
                    )}
                  </Card>
                );
              })}

              {stageLeads.length === 0 && (
                <div className="text-center py-8 text-gray-300 text-xs italic border border-dashed rounded-lg border-gray-200">
                  No deals
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
