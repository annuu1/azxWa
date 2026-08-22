'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { 
  RefreshCw, Megaphone, Plus, Calendar, CheckCircle, Clock, 
  AlertCircle, Play, Pause, Trash2, RotateCcw, Zap, FileText 
} from 'lucide-react';
import { 
  getCampaignsList, 
  deleteCampaign, 
  startCampaignImmediately, 
  restartCampaign, 
  pauseCampaign, 
  resumeCampaign,
  getTemplatesList,
  createTemplate,
  deleteTemplate
} from '../actions/campaign-actions';
import { getWhatsAppSessionsData } from '@/features/whatsapp/actions/whatsapp-actions';
import { getOrgTags } from '@/features/crm/actions/crm-actions';
import CreateCampaignModal from './create-campaign-modal';
import CampaignDetailsModal from './campaign-details-modal';

export default function CampaignsManager() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'templates'>('campaigns');

  // Templates State
  const [templates, setTemplates] = useState<any[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Modal controls
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [campaignsResult, sessionsResult, tagsResult, templatesResult] = await Promise.all([
        getCampaignsList(),
        getWhatsAppSessionsData(),
        getOrgTags(),
        getTemplatesList(),
      ]);

      if (campaignsResult.success) setCampaigns(campaignsResult.campaigns || []);
      if (sessionsResult.success) setSessions(sessionsResult.sessions || []);
      if (tagsResult.success) setTags(tagsResult.tags || []);
      if (templatesResult.success) setTemplates(templatesResult.templates || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteCampaign = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this campaign? All its message history and queue jobs will be deleted permanently.')) return;
    try {
      const res = await deleteCampaign(id);
      if (res.success) {
        fetchData();
      } else {
        alert(res.error || 'Failed to delete campaign');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartCampaignImmediately = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Start this campaign immediately? All pending messages will be scheduled to send right now.')) return;
    try {
      const res = await startCampaignImmediately(id);
      if (res.success) {
        fetchData();
      } else {
        alert(res.error || 'Failed to start campaign');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestartCampaign = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Restart this campaign? All messages will be reset to pending status and sent again.')) return;
    try {
      const res = await restartCampaign(id);
      if (res.success) {
        fetchData();
      } else {
        alert(res.error || 'Failed to restart campaign');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePauseCampaign = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await pauseCampaign(id);
      if (res.success) {
        fetchData();
      } else {
        alert(res.error || 'Failed to pause campaign');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResumeCampaign = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await resumeCampaign(id);
      if (res.success) {
        fetchData();
      } else {
        alert(res.error || 'Failed to resume campaign');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim() || !newTemplateContent.trim()) return;
    setSavingTemplate(true);
    try {
      const res = await createTemplate(newTemplateName, newTemplateContent);
      if (res.success) {
        setNewTemplateName('');
        setNewTemplateContent('');
        fetchData();
      } else {
        alert(res.error || 'Failed to save template');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      const res = await deleteTemplate(id);
      if (res.success) {
        fetchData();
      } else {
        alert(res.error || 'Failed to delete template');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Compute overall stats
  const totalCampaigns = campaigns.length;
  const totalPending = campaigns.filter(c => c.status === 'PENDING').length;
  const totalCompleted = campaigns.filter(c => c.status === 'COMPLETED').length;

  return (
    <div className="space-y-8">
      {/* Header and Action toolbar */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaign Broadcast Automation</h1>
          <p className="text-sm text-gray-500">Run bulk messages, schedule alerts, and monitor dispatch queues</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={fetchData} 
            disabled={loading}
            className="bg-white"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" /> Launch Broadcast
          </Button>
        </div>
      </div>

      {/* Analytics Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border bg-white shadow-sm">
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-blue-100/50 rounded-full">
              <Megaphone className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase">Total Campaigns</span>
              <span className="text-2xl font-bold text-gray-900">{totalCampaigns}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border bg-white shadow-sm">
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-amber-100/50 rounded-full">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase">Pending / Active</span>
              <span className="text-2xl font-bold text-gray-900">{totalPending}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border bg-white shadow-sm">
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-green-100/50 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase">Completed</span>
              <span className="text-2xl font-bold text-gray-900">{totalCompleted}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`py-2 px-4 font-semibold text-sm transition-all border-b-2 -mb-px ${
            activeTab === 'campaigns'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Active Campaigns
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`py-2 px-4 font-semibold text-sm transition-all border-b-2 -mb-px ${
            activeTab === 'templates'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Saved Templates
        </button>
      </div>

      {/* Campaigns list directory */}
      {activeTab === 'campaigns' && (
        <>
          {loading && campaigns.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-4">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm text-gray-500 font-medium">Syncing broadcast registry...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {campaigns.map((c) => {
                const total = c.stats.total;
                const sent = c.stats.sent;
                const failed = c.stats.failed;
                
                const progressPct = total > 0 ? Math.round((sent / total) * 100) : 0;
                const isCompleted = c.status === 'COMPLETED';
                const isScheduled = c.scheduledAt !== null;

                return (
                  <Card 
                    key={c.id} 
                    onClick={() => setSelectedCampaignId(c.id)}
                    className={`bg-white shadow-sm hover:shadow-md transition-all border border-gray-200/70 cursor-pointer flex flex-col justify-between`}
                  >
                    <CardHeader className="pb-3 bg-gray-50/20 border-b flex flex-row justify-between items-start">
                      <div>
                        <CardTitle className="text-lg font-bold text-gray-900">{c.name}</CardTitle>
                        <CardDescription className="text-xs">Session: {c.sessionId}</CardDescription>
                      </div>
                      <div>
                        {isCompleted ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Completed
                          </span>
                        ) : isScheduled && c.status === 'PENDING' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <Calendar className="w-3.5 h-3.5 mr-1" /> Scheduled
                          </span>
                        ) : c.status === 'PAUSED' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Pause className="w-3.5 h-3.5 mr-1" /> Paused
                          </span>
                        ) : c.status === 'CANCELLED' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                            <AlertCircle className="w-3.5 h-3.5 mr-1" /> Cancelled
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 mr-1 animate-pulse" /> Processing
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="py-4 space-y-4 flex-1">
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Message Template</span>
                        <p className="text-xs text-gray-600 line-clamp-2 bg-gray-50 p-2 rounded font-mono border border-gray-200/50">
                          {c.messageTemplate}
                        </p>
                      </div>

                      {/* Progress info */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-gray-600">Dispatch Progress</span>
                          <span className="font-bold text-blue-600">{progressPct}% ({sent}/{total} sent)</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div 
                            style={{ width: `${progressPct}%` }}
                            className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-green-500' : 'bg-blue-600'}`}
                          />
                        </div>
                        {failed > 0 && (
                          <span className="text-[10px] text-red-500 font-semibold flex items-center">
                            <AlertCircle className="w-3 h-3 mr-1" /> {failed} deliveries failed (will retry)
                          </span>
                        )}
                      </div>
                    </CardContent>
                    
                    {/* Control Actions Footer */}
                    <div className="px-4 py-3 border-t bg-gray-50/50 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[10px] text-gray-400">
                        <span>Created {new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                      
                      <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                        {c.status === 'PENDING' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={(e) => handlePauseCampaign(c.id, e)}
                              title="Pause Campaign"
                              className="h-7 px-2 text-xs border-amber-200 text-amber-700 hover:bg-amber-50 bg-white"
                            >
                              <Pause className="w-3.5 h-3.5 mr-1" /> Pause
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={(e) => handleStartCampaignImmediately(c.id, e)}
                              title="Send All Messages Now"
                              className="h-7 px-2 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 bg-white"
                            >
                              <Zap className="w-3.5 h-3.5 mr-1" /> Send Now
                            </Button>
                          </>
                        )}

                        {c.status === 'PAUSED' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={(e) => handleResumeCampaign(c.id, e)}
                              title="Resume Campaign"
                              className="h-7 px-2 text-xs border-green-200 text-green-700 hover:bg-green-50 bg-white"
                            >
                              <Play className="w-3.5 h-3.5 mr-1" /> Resume
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={(e) => handleStartCampaignImmediately(c.id, e)}
                              title="Send All Messages Now"
                              className="h-7 px-2 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 bg-white"
                            >
                              <Zap className="w-3.5 h-3.5 mr-1" /> Send Now
                            </Button>
                          </>
                        )}

                        {c.status === 'PROCESSING' && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={(e) => handlePauseCampaign(c.id, e)}
                            title="Pause Campaign"
                            className="h-7 px-2 text-xs border-amber-200 text-amber-700 hover:bg-amber-50 bg-white"
                          >
                            <Pause className="w-3.5 h-3.5 mr-1" /> Pause
                          </Button>
                        )}

                        {(c.status === 'COMPLETED' || c.status === 'CANCELLED' || c.status === 'FAILED') && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={(e) => handleRestartCampaign(c.id, e)}
                            title="Rerun Campaign"
                            className="h-7 px-2 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 bg-white"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restart
                          </Button>
                        )}

                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={(e) => handleDeleteCampaign(c.id, e)}
                          title="Delete Campaign"
                          className="h-7 w-7 p-0 text-red-600 hover:bg-red-55 hover:text-red-700 border-red-200 bg-white"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}

              {campaigns.length === 0 && (
                <div className="lg:col-span-2 text-center py-20 bg-white rounded-lg border border-dashed">
                  <Megaphone className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 mb-4 font-medium">No marketing or broadcast campaigns launched yet.</p>
                  <Button 
                    onClick={() => setShowCreateModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Launch Your First Broadcast
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Templates View tab content */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create Template Form */}
          <div className="lg:col-span-1">
            <Card className="border bg-white shadow-sm sticky top-6">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-blue-600" /> Save New Template
                </CardTitle>
                <CardDescription className="text-xs">Create reusable broadcast messages</CardDescription>
              </CardHeader>
              <form onSubmit={handleCreateTemplate}>
                <CardContent className="py-4 space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Template Name</label>
                    <Input
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="e.g. Discount Code Promo"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Message Content</label>
                    <textarea
                      value={newTemplateContent}
                      onChange={(e) => setNewTemplateContent(e.target.value)}
                      placeholder="Hello {{firstName}}, use code PROMO10 to get 10% off!"
                      className="w-full bg-white border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] resize-none font-mono"
                      required
                    />
                    <div className="flex flex-wrap gap-1 pt-1">
                      {['{{name}}', '{{firstName}}', '{{pushName}}', '{{phone}}'].map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setNewTemplateContent(prev => prev + v)}
                          className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 font-mono px-2 py-0.5 rounded border border-gray-200/50"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
                <div className="p-4 border-t bg-gray-50/50 flex justify-end">
                  <Button type="submit" disabled={savingTemplate} className="bg-blue-600 hover:bg-blue-700 w-full">
                    {savingTemplate ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Save Template
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          {/* Templates Grid List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {templates.map((t) => (
                <Card key={t.id} className="bg-white shadow-sm border border-gray-200/70 flex flex-col justify-between">
                  <CardHeader className="pb-3 bg-gray-50/20 border-b flex flex-row justify-between items-center">
                    <CardTitle className="text-sm font-bold text-gray-900 truncate pr-2" title={t.name}>{t.name}</CardTitle>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="py-3 flex-1">
                    <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded font-mono border border-gray-200/50 whitespace-pre-wrap min-h-[80px]">
                      {t.content}
                    </p>
                  </CardContent>
                  <div className="px-4 py-2 border-t bg-gray-50/30 text-[9px] text-gray-400">
                    Saved {new Date(t.createdAt).toLocaleDateString()}
                  </div>
                </Card>
              ))}

              {templates.length === 0 && (
                <div className="md:col-span-2 text-center py-20 bg-white rounded-lg border border-dashed">
                  <FileText className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">No templates saved yet.</p>
                  <p className="text-xs text-gray-400">Use the form to create your first reusable message template.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Builder Modal */}
      {showCreateModal && (
        <CreateCampaignModal 
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchData();
          }}
          sessions={sessions}
          tags={tags}
        />
      )}

      {/* Details logs Modal */}
      {selectedCampaignId && (
        <CampaignDetailsModal 
          campaignId={selectedCampaignId} 
          onClose={() => setSelectedCampaignId(null)}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
}
