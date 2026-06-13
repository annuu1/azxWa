'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/shared/components/ui/card";
import { X, RefreshCw, CheckCircle, AlertCircle, Clock, Play } from 'lucide-react';
import { getCampaignDetails } from '../actions/campaign-actions';

interface CampaignDetailsModalProps {
  campaignId: string;
  onClose: () => void;
}

export default function CampaignDetailsModal({ campaignId, onClose }: CampaignDetailsModalProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const result = await getCampaignDetails(campaignId);
      if (result.success) {
        setData(result);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [campaignId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <Card className="w-full max-w-lg bg-white p-8 flex flex-col items-center justify-center space-y-4 shadow-2xl">
          <RefreshCw className="w-10 h-10 animate-spin text-blue-600" />
          <p className="text-gray-500 font-medium">Loading campaign dispatch logs...</p>
        </Card>
      </div>
    );
  }

  if (!data || !data.campaign) return null;

  const { campaign, jobs } = data;

  const total = jobs.length;
  const sent = jobs.filter((j: any) => j.status === 'SENT').length;
  const pending = jobs.filter((j: any) => j.status === 'PENDING').length;
  const processing = jobs.filter((j: any) => j.status === 'PROCESSING').length;
  const failed = jobs.filter((j: any) => j.status === 'FAILED').length;

  const progressPct = total > 0 ? Math.round((sent / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl bg-white shadow-2xl border flex flex-col max-h-[85vh]">
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold">{campaign.name}</CardTitle>
            <CardDescription>Created on {new Date(campaign.createdAt).toLocaleDateString()}</CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="h-8 w-8 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="py-6 space-y-6 overflow-y-auto flex-1">
          {/* Progress bar and summary cards */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="font-semibold text-gray-700">Dispatch Progress</span>
              <span className="font-bold text-blue-600">{progressPct}% ({sent}/{total} sent)</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div 
                style={{ width: `${progressPct}%` }}
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-2.5">
              <span className="block text-[10px] font-bold text-blue-500 uppercase">Pending</span>
              <span className="text-lg font-bold text-blue-700">{pending}</span>
            </div>
            <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-2.5">
              <span className="block text-[10px] font-bold text-amber-500 uppercase">Processing</span>
              <span className="text-lg font-bold text-amber-700">{processing}</span>
            </div>
            <div className="bg-green-50/50 border border-green-100 rounded-lg p-2.5">
              <span className="block text-[10px] font-bold text-green-500 uppercase">Sent</span>
              <span className="text-lg font-bold text-green-700">{sent}</span>
            </div>
            <div className="bg-red-50/50 border border-red-100 rounded-lg p-2.5">
              <span className="block text-[10px] font-bold text-red-500 uppercase">Failed</span>
              <span className="text-lg font-bold text-red-700">{failed}</span>
            </div>
          </div>

          {/* Template Details */}
          <div className="space-y-1">
            <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Message Template</span>
            <div className="bg-gray-50 border rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap font-mono">
              {campaign.messageTemplate}
            </div>
          </div>

          {/* Recipient Job Logs List */}
          <div className="space-y-2">
            <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Audience Queue Logs</span>
            <div className="border rounded-lg overflow-hidden divide-y max-h-[200px] overflow-y-auto">
              {jobs.map((job: any) => (
                <div key={job.id} className="p-3 flex items-center justify-between text-xs hover:bg-gray-50/50 transition-colors">
                  <div className="space-y-0.5">
                    <span className="font-mono font-medium text-gray-700">{job.recipientWhatsappId}</span>
                    {job.error && (
                      <span className="block text-[10px] text-red-500 font-medium">{job.error}</span>
                    )}
                  </div>
                  <div>
                    {job.status === 'SENT' ? (
                      <span className="inline-flex items-center text-green-600 font-semibold">
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Sent
                      </span>
                    ) : job.status === 'FAILED' ? (
                      <span className="inline-flex items-center text-red-600 font-semibold">
                        <AlertCircle className="w-3.5 h-3.5 mr-1" /> Failed ({job.attempts} attempts)
                      </span>
                    ) : job.status === 'PROCESSING' ? (
                      <span className="inline-flex items-center text-amber-600 font-semibold animate-pulse">
                        <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> Sending...
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-gray-500 font-medium">
                        <Clock className="w-3.5 h-3.5 mr-1" /> Queued
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {jobs.length === 0 && (
                <div className="text-center py-6 text-gray-400 italic">No dispatch logs found</div>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-3 border-t bg-gray-50/50 flex justify-between">
          <Button variant="outline" onClick={fetchDetails}>
            <RefreshCw className="w-4 h-4 mr-2" /> Reload Status
          </Button>
          <Button onClick={onClose}>Close Logs</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
