'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Layers, 
  Flame, 
  MessageSquare, 
  Bot, 
  Megaphone, 
  Smartphone, 
  Clock, 
  AlertTriangle, 
  ArrowRight, 
  CheckCircle2, 
  TrendingUp, 
  ShieldCheck, 
  Zap, 
  Send,
  BookOpen,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { DashboardMetrics } from '../actions/analytics-actions';
import { triggerStagnantScanAction } from '@/features/ai/actions/multi-agent-actions';

interface DashboardOverviewProps {
  metrics: DashboardMetrics;
  onRefresh?: () => void;
}

export function DashboardOverview({ metrics, onRefresh }: DashboardOverviewProps) {
  const router = useRouter();
  const [runningScan, setRunningScan] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  const handleRunStagnantScan = async () => {
    setRunningScan(true);
    setScanMessage('');
    try {
      const res = await triggerStagnantScanAction();
      if (res.success) {
        setScanMessage('Stagnant deals scan completed!');
        if (onRefresh) {
          onRefresh();
        } else {
          router.refresh();
        }
      }
    } catch (e: any) {
      setScanMessage('Scan error: ' + e.message);
    } finally {
      setRunningScan(false);
    }
  };

  const totalDeals = metrics.totalLeads;
  const maxStageCount = Math.max(...metrics.stagesBreakdown.map(s => s.count), 1);

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Top Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Enterprise Dashboard
            </span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              metrics.whatsappMetrics.connectedSessions > 0 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                metrics.whatsappMetrics.connectedSessions > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`} />
              {metrics.whatsappMetrics.connectedSessions > 0 ? 'WhatsApp Online' : 'WhatsApp Offline'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            {metrics.organizationName}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time CRM metrics, autonomous AI qualification, and WhatsApp traffic overview.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button 
            variant="outline"
            size="sm"
            onClick={handleRunStagnantScan}
            disabled={runningScan}
            className="h-9 text-xs font-medium border-amber-300 text-amber-800 bg-amber-50/60 hover:bg-amber-100"
          >
            <Zap className={`w-3.5 h-3.5 mr-1.5 ${runningScan ? 'animate-spin' : 'text-amber-600'}`} />
            {runningScan ? 'Scanning...' : 'Reactivate Stagnant Deals'}
          </Button>

          <Link href="/dashboard/campaigns">
            <Button size="sm" className="h-9 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs">
              <Megaphone className="w-3.5 h-3.5 mr-1.5" />
              New Campaign
            </Button>
          </Link>
        </div>
      </div>

      {scanMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{scanMessage}</span>
        </div>
      )}

      {/* Urgent Human Escalations Banner (If any) */}
      {metrics.urgentEscalations.length > 0 && (
        <div className="bg-rose-50/90 border border-rose-200 p-4 sm:p-5 rounded-2xl shadow-xs animate-in fade-in">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600 shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-900">
                  {metrics.urgentEscalations.length} Urgent Human Escalation{metrics.urgentEscalations.length > 1 ? 's' : ''} Flagged by AI Arbiter
                </h3>
                <p className="text-xs text-rose-700 mt-0.5">
                  Negative sentiment, high frustration, or low decision confidence detected. Human intervention recommended.
                </p>
                <div className="mt-3 space-y-2">
                  {metrics.urgentEscalations.map((esc) => (
                    <div key={esc.id} className="bg-white/80 p-2.5 rounded-lg border border-rose-200/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-gray-900 mr-2">{esc.contactName}:</span>
                        <span className="text-gray-600">{esc.description}</span>
                      </div>
                      <Link href="/dashboard/inbox">
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-700 hover:bg-rose-100 shrink-0 font-medium">
                          Open Chat <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4 Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Deals & Pipeline */}
        <Card className="bg-white border-gray-200 shadow-xs hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Pipeline Deals</span>
                <span className="text-3xl font-extrabold text-gray-900 mt-1 block">{metrics.totalLeads}</span>
              </div>
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>Total Contacts: <strong className="text-gray-800">{metrics.totalContacts}</strong></span>
              <Link href="/dashboard/crm" className="text-blue-600 hover:text-blue-700 font-semibold flex items-center">
                View <ArrowRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Hot Leads & AI Scoring */}
        <Card className="bg-white border-gray-200 shadow-xs hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Hot Qualified Leads</span>
                <span className="text-3xl font-extrabold text-amber-600 mt-1 block flex items-center gap-1.5">
                  <Flame className="w-6 h-6 text-amber-500 fill-amber-500" />
                  {metrics.aiMetrics.hotLeadsCount}
                </span>
              </div>
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>Avg AI Score: <strong className="text-gray-800">{metrics.aiMetrics.avgScore}/100</strong></span>
              <span>Profiled: <strong className="text-gray-800">{metrics.aiMetrics.totalProfiled}</strong></span>
            </div>
          </CardContent>
        </Card>

        {/* 24h WhatsApp Activity */}
        <Card className="bg-white border-gray-200 shadow-xs hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">24h WhatsApp Traffic</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-gray-900">
                    {metrics.whatsappMetrics.sentLast24h + metrics.whatsappMetrics.receivedLast24h}
                  </span>
                  <span className="text-xs font-medium text-gray-400">msgs</span>
                </div>
              </div>
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span className="text-emerald-700 font-medium">↑ {metrics.whatsappMetrics.sentLast24h} Sent</span>
              <span className="text-blue-700 font-medium">↓ {metrics.whatsappMetrics.receivedLast24h} Inbound</span>
            </div>
          </CardContent>
        </Card>

        {/* AI Agent Execution Mode */}
        <Card className="bg-white border-gray-200 shadow-xs hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">AI Orchestrator</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold mt-2 ${
                  metrics.aiMetrics.aiMode === 'AUTONOMOUS' 
                    ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}>
                  {metrics.aiMetrics.aiMode === 'AUTONOMOUS' ? (
                    <><Zap className="w-3 h-3 mr-1 text-purple-600" /> Autonomous</>
                  ) : (
                    <><ShieldCheck className="w-3 h-3 mr-1 text-blue-600" /> Co-Pilot Mode</>
                  )}
                </span>
              </div>
              <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>Pending Approval: <strong className="text-amber-600">{metrics.aiMetrics.pendingProposalsCount}</strong></span>
              <span>Executed: <strong className="text-emerald-600">{metrics.aiMetrics.executedProposalsCount}</strong></span>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Middle Grid: Pipeline Funnel & AI Intent Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Pipeline Stage Distribution (2 cols) */}
        <Card className="lg:col-span-2 bg-white border-gray-200 shadow-xs">
          <CardHeader className="pb-3 border-b">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-base font-bold text-gray-900">Deals Pipeline Stage Progression</CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Visual volume distribution across active sales pipeline stages
                </CardDescription>
              </div>
              <Link href="/dashboard/crm">
                <Button variant="ghost" size="sm" className="h-8 text-xs text-blue-600 hover:text-blue-700 font-semibold">
                  Open Kanban Board <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {metrics.stagesBreakdown.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">No stages defined in pipeline.</div>
            ) : (
              metrics.stagesBreakdown.map((stage) => {
                const pct = totalDeals > 0 ? Math.round((stage.count / totalDeals) * 100) : 0;
                return (
                  <div key={stage.id} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-gray-800">{stage.name}</span>
                      <div className="space-x-2 text-gray-500">
                        <span className="font-bold text-gray-900">{stage.count} deals</span>
                        <span>({pct}%)</span>
                      </div>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, stage.count > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* AI Intent & Qualification Matrix (1 col) */}
        <Card className="bg-white border-gray-200 shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold text-gray-900">Lead Intent Matrix</CardTitle>
            <CardDescription className="text-xs text-gray-500">
              BANT buying intent analyzed by AI Profiler
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-around">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-rose-50 rounded-xl border border-rose-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
                  <span className="text-xs font-bold text-rose-900">High Buying Intent</span>
                </div>
                <span className="text-sm font-extrabold text-rose-700">{metrics.aiMetrics.intents.high}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-xs font-bold text-amber-900">Medium Intent</span>
                </div>
                <span className="text-sm font-extrabold text-amber-700">{metrics.aiMetrics.intents.medium}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
                  <span className="text-xs font-bold text-blue-900">Low / Exploring</span>
                </div>
                <span className="text-sm font-extrabold text-blue-700">{metrics.aiMetrics.intents.low}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-gray-400 shrink-0" />
                  <span className="text-xs font-bold text-gray-700">Unqualified</span>
                </div>
                <span className="text-sm font-extrabold text-gray-600">{metrics.aiMetrics.intents.unqualified}</span>
              </div>
            </div>

            <Link href="/dashboard/ai">
              <Button variant="outline" className="w-full text-xs font-semibold h-9 mt-2">
                Open AI Command Center <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

      </div>

      {/* Bottom Grid: Live Activity Feed & Quick Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Real-Time Activity Feed (2 cols) */}
        <Card className="lg:col-span-2 bg-white border-gray-200 shadow-xs">
          <CardHeader className="pb-3 border-b">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-base font-bold text-gray-900">Live Activity Feed</CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Recent WhatsApp messages, autonomous AI follow-ups, and CRM events
                </CardDescription>
              </div>
              <Link href="/dashboard/inbox">
                <Button variant="ghost" size="sm" className="h-8 text-xs text-blue-600 hover:text-blue-700 font-semibold">
                  View Inbox <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {metrics.recentActivities.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">No activity recorded yet.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {metrics.recentActivities.map((act) => {
                  const isSent = act.type === 'MESSAGE_SENT';
                  const isReceived = act.type === 'MESSAGE_RECEIVED';
                  const isEscalation = act.type === 'ESCALATE_HUMAN';
                  const isStage = act.type === 'LEAD_STAGE_CHANGED';

                  return (
                    <div key={act.id} className="p-4 hover:bg-gray-50/80 transition-colors flex items-start gap-3.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        isEscalation 
                          ? 'bg-rose-100 text-rose-600'
                          : isSent
                          ? 'bg-emerald-100 text-emerald-600'
                          : isReceived
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-purple-100 text-purple-600'
                      }`}>
                        {isEscalation && <AlertTriangle className="w-4 h-4" />}
                        {isSent && <Send className="w-4 h-4" />}
                        {isReceived && <MessageSquare className="w-4 h-4" />}
                        {isStage && <Layers className="w-4 h-4" />}
                        {!isEscalation && !isSent && !isReceived && !isStage && <Bot className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-gray-900 truncate">
                            {act.contactName}
                          </span>
                          <span className="text-[10px] text-gray-400 shrink-0">
                            {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                          {act.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Launch & Session Status (1 col) */}
        <div className="space-y-6">
          
          {/* WhatsApp Sessions Health Card */}
          <Card className="bg-white border-gray-200 shadow-xs">
            <CardHeader className="pb-3 border-b">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base font-bold text-gray-900">WhatsApp Sessions</CardTitle>
                <Link href="/dashboard/whatsapp">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 font-semibold p-0">
                    Manage
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {metrics.whatsappMetrics.sessions.length === 0 ? (
                <div className="p-3 text-center text-xs text-gray-400">
                  No sessions created yet.
                </div>
              ) : (
                metrics.whatsappMetrics.sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-200/80 text-xs">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-gray-500" />
                      <span className="font-bold text-gray-900">{s.sessionId}</span>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                      s.status === 'CONNECTED' || s.status === 'READY'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {s.status}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Quick Shortcuts */}
          <Card className="bg-white border-gray-200 shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-bold text-gray-900">Platform Shortcuts</CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-2 gap-2 text-xs">
              <Link href="/dashboard/inbox">
                <div className="p-3 bg-blue-50/60 hover:bg-blue-100/80 transition-colors border border-blue-100 rounded-xl flex flex-col items-center justify-center text-center group cursor-pointer">
                  <MessageSquare className="w-5 h-5 text-blue-600 mb-1 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-gray-800">Unified Inbox</span>
                </div>
              </Link>

              <Link href="/dashboard/crm">
                <div className="p-3 bg-purple-50/60 hover:bg-purple-100/80 transition-colors border border-purple-100 rounded-xl flex flex-col items-center justify-center text-center group cursor-pointer">
                  <Layers className="w-5 h-5 text-purple-600 mb-1 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-gray-800">Kanban CRM</span>
                </div>
              </Link>

              <Link href="/dashboard/campaigns">
                <div className="p-3 bg-amber-50/60 hover:bg-amber-100/80 transition-colors border border-amber-100 rounded-xl flex flex-col items-center justify-center text-center group cursor-pointer">
                  <Megaphone className="w-5 h-5 text-amber-600 mb-1 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-gray-800">Broadcasts</span>
                </div>
              </Link>

              <Link href="/dashboard/knowledge-base">
                <div className="p-3 bg-emerald-50/60 hover:bg-emerald-100/80 transition-colors border border-emerald-100 rounded-xl flex flex-col items-center justify-center text-center group cursor-pointer">
                  <BookOpen className="w-5 h-5 text-emerald-600 mb-1 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-gray-800">Knowledge RAG</span>
                </div>
              </Link>
            </CardContent>
          </Card>

        </div>

      </div>

    </div>
  );
}
