'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { RefreshCw, Megaphone, Plus, Calendar, CheckCircle, Clock, AlertCircle, Play } from 'lucide-react';
import { getCampaignsList } from '../actions/campaign-actions';
import { getWhatsAppSessionsData } from '@/features/whatsapp/actions/whatsapp-actions';
import { getOrgTags } from '@/features/crm/actions/crm-actions';
import CreateCampaignModal from './create-campaign-modal';
import CampaignDetailsModal from './campaign-details-modal';

export default function CampaignsManager() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);

  // Modal controls
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [campaignsResult, sessionsResult, tagsResult] = await Promise.all([
        getCampaignsList(),
        getWhatsAppSessionsData(),
        getOrgTags(),
      ]);

      if (campaignsResult.success) setCampaigns(campaignsResult.campaigns || []);
      if (sessionsResult.success) setSessions(sessionsResult.sessions || []);
      if (tagsResult.success) setTags(tagsResult.tags || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

      {/* Campaigns list directory */}
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
                    ) : isScheduled ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        <Calendar className="w-3.5 h-3.5 mr-1" /> Scheduled
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3.5 h-3.5 mr-1" /> Processing
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
                <div className="px-6 py-3 border-t bg-gray-50/30 flex justify-between items-center text-[10px] text-gray-400">
                  <span>Created {new Date(c.createdAt).toLocaleString()}</span>
                  {isScheduled && (
                    <span className="font-semibold text-blue-600">Runs {new Date(c.scheduledAt).toLocaleString()}</span>
                  )}
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
