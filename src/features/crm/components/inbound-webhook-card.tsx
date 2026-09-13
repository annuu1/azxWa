'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { 
  Webhook, 
  Copy, 
  Check, 
  Send, 
  Zap, 
  ShieldCheck, 
  Smartphone, 
  FileText, 
  Bot, 
  Users, 
  ExternalLink,
  Code2,
  AlertCircle
} from 'lucide-react';
import { getInboundWebhookInfo, simulateInboundLeadAction } from '../actions/crm-actions';

export default function InboundWebhookCard() {
  const [loading, setLoading] = useState(true);
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Test Simulator State
  const [simName, setSimName] = useState('Rahul Sharma');
  const [simPhone, setSimPhone] = useState('+919876543210');
  const [simSource, setSimSource] = useState('Meta Lead Ad - 3BHK Plots');
  const [simCampaign, setSimCampaign] = useState('Summer Sale 2026');
  const [simNotes, setSimNotes] = useState('Looking for 3BHK brochure and payment plans.');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await getInboundWebhookInfo();
        if (res.success) {
          setWebhookInfo(res);
        }
      } catch (err) {
        console.error('Failed to load webhook info:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const copyToClipboard = (text: string, isToken = false) => {
    navigator.clipboard.writeText(text);
    if (isToken) {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simPhone.trim()) return;

    setTesting(true);
    setTestResult(null);

    try {
      const res = await simulateInboundLeadAction({
        name: simName.trim(),
        phone: simPhone.trim(),
        source: simSource.trim(),
        campaign: simCampaign.trim(),
        notes: simNotes.trim(),
        autoEngage: true,
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const sampleJsonPayload = JSON.stringify(
    {
      name: "Rahul Sharma",
      phone: "+919876543210",
      email: "rahul@example.com",
      source: "Facebook Lead Ads",
      campaign: "Summer Sale 2026",
      notes: "Interested in 3BHK floor plans and brochure",
      tags: ["Facebook Ads", "3BHK Buyer"]
    },
    null,
    2
  );

  return (
    <div className="space-y-6">
      
      {/* Top Main Webhook Configuration Card */}
      <Card className="border border-indigo-100 shadow-sm bg-linear-to-br from-white via-indigo-50/20 to-white">
        <CardHeader className="pb-4 border-b border-indigo-50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Webhook className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-gray-900">
                  Instant Ad Lead Inbound Webhook
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Connect Meta Lead Ads, Google Ads, Zapier, Make, or Webflow forms for zero-latency engagement.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                webhookInfo?.hasConnectedWhatsApp 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  webhookInfo?.hasConnectedWhatsApp ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`} />
                {webhookInfo?.hasConnectedWhatsApp ? 'WhatsApp Auto-Outreach Online' : 'Connect WhatsApp for Outreach'}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">Loading webhook configuration...</div>
          ) : (
            <>
              {/* Endpoint URL Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-600" />
                  Your Organization Inbound Webhook URL (POST)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={webhookInfo?.endpointUrl || ''}
                    className="font-mono text-xs bg-gray-50/80 border-gray-300 text-gray-900 h-10 select-all"
                  />
                  <Button
                    type="button"
                    onClick={() => copyToClipboard(webhookInfo?.endpointUrl || '')}
                    className="h-10 px-4 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-4 h-4 mr-1.5 text-emerald-300" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1.5" /> Copy URL
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-gray-500">
                  Target this endpoint with HTTP <strong>POST</strong> using JSON or form-urlencoded payloads.
                </p>
              </div>

              {/* Secret Webhook Token */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Secret Webhook Key (Optional Header Authentication)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    type="password"
                    value={webhookInfo?.webhookToken || ''}
                    className="font-mono text-xs bg-gray-50/80 border-gray-300 text-gray-700 h-10 max-w-md"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => copyToClipboard(webhookInfo?.webhookToken || '', true)}
                    className="h-10 px-4 text-xs font-medium"
                  >
                    {copiedToken ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[11px] text-gray-500">
                  Can be passed via header <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-700 font-mono text-[10px]">x-api-key: {webhookInfo?.webhookToken}</code> or <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-700 font-mono text-[10px]">Authorization: Bearer {webhookInfo?.webhookToken}</code>.
                </p>
              </div>

              {/* Autonomous Flow Step Indicators */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px]">1</span>
                    Ad Lead Captured
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Lead data ingested from Meta Ads, Google Ads, or landing pages within 50ms.
                  </p>
                </div>

                <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px]">2</span>
                    Round-Robin Assigned
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Automatically distributed to the sales rep with the least active workload.
                  </p>
                </div>

                <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px]">3</span>
                    Instant WhatsApp Outreach
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Sends immediate personalized welcome message + attaches brochure PDF if requested.
                  </p>
                </div>

                <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px]">4</span>
                    Autonomous AI Profiling
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Debounced multi-agent system monitors replies and calculates lead intent.
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Two Column Layout: Live Interactive Simulator + Integration Snippets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Interactive Webhook Simulator */}
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="bg-gray-50/60 border-b pb-3">
            <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-600" />
              Interactive Lead Simulator (Test Live Engagement)
            </CardTitle>
            <CardDescription className="text-xs">
              Simulate an inbound ad lead to test instant contact enrollment and WhatsApp outreach.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSimulate} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-600 uppercase">Lead Name</label>
                  <Input
                    value={simName}
                    onChange={(e) => setSimName(e.target.value)}
                    placeholder="Rahul Sharma"
                    required
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-600 uppercase">Phone (WhatsApp)</label>
                  <Input
                    value={simPhone}
                    onChange={(e) => setSimPhone(e.target.value)}
                    placeholder="+919876543210"
                    required
                    className="h-9 text-xs bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-600 uppercase">Ad Source / Platform</label>
                  <Input
                    value={simSource}
                    onChange={(e) => setSimSource(e.target.value)}
                    placeholder="Meta Ads / Facebook"
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-600 uppercase">Campaign Name</label>
                  <Input
                    value={simCampaign}
                    onChange={(e) => setSimCampaign(e.target.value)}
                    placeholder="Summer Sale 2026"
                    className="h-9 text-xs bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-600 uppercase">Lead Note / Inquiry</label>
                <Input
                  value={simNotes}
                  onChange={(e) => setSimNotes(e.target.value)}
                  placeholder="Interested in 3BHK brochure and pricing..."
                  className="h-9 text-xs bg-white"
                />
              </div>

              <Button
                type="submit"
                disabled={testing}
                className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors"
              >
                {testing ? (
                  <>
                    <Zap className="w-3.5 h-3.5 mr-2 animate-spin" /> Processing Inbound Lead...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 mr-2 text-amber-300" /> Trigger Inbound Webhook Test
                  </>
                )}
              </Button>
            </form>

            {/* Test Result Display */}
            {testResult && (
              <div className={`mt-4 p-3.5 rounded-xl border text-xs space-y-1.5 ${
                testResult.success 
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
                  : 'bg-rose-50/80 border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span>{testResult.success ? '✅ Inbound Lead Processed Successfully!' : '❌ Webhook Error'}</span>
                  <span className="text-[10px] opacity-75">Status: {testResult.status}</span>
                </div>
                <p className="text-[11px]">{testResult.message || testResult.error}</p>
                {testResult.lead && (
                  <div className="mt-2 pt-2 border-t border-emerald-200/60 grid grid-cols-2 gap-2 text-[11px]">
                    <div><strong>Contact:</strong> {testResult.lead.name}</div>
                    <div><strong>WhatsApp:</strong> {testResult.lead.whatsappId}</div>
                    <div><strong>Assigned Rep:</strong> {testResult.lead.assignedTo || 'Unassigned'}</div>
                    <div><strong>Instant WhatsApp:</strong> {testResult.lead.whatsappEngaged ? 'Dispatched 🚀' : 'No WhatsApp Session'}</div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* JSON Payload & Integration Documentation */}
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="bg-gray-50/60 border-b pb-3">
            <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-purple-600" />
              Sample JSON Payload & Field Specs
            </CardTitle>
            <CardDescription className="text-xs">
              Supports standard webhooks from Zapier, Make.com, Webflow, and Meta Graph API.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="relative">
              <pre className="p-3.5 rounded-xl bg-gray-950 text-gray-100 font-mono text-[11px] leading-relaxed overflow-x-auto border border-gray-800">
                {sampleJsonPayload}
              </pre>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(sampleJsonPayload)}
                className="absolute top-2 right-2 text-gray-400 hover:text-white hover:bg-gray-800 h-7 text-[10px]"
              >
                <Copy className="w-3 h-3 mr-1" /> Copy JSON
              </Button>
            </div>

            <div className="space-y-1.5 text-xs text-gray-600">
              <p className="font-semibold text-gray-800">Supported Field Aliases:</p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-gray-500">
                <li><strong>Phone:</strong> <code className="text-indigo-600">phone</code>, <code className="text-indigo-600">phoneNumber</code>, <code className="text-indigo-600">mobile</code>, or <code className="text-indigo-600">whatsapp</code></li>
                <li><strong>Name:</strong> <code className="text-indigo-600">name</code>, <code className="text-indigo-600">fullName</code>, or <code className="text-indigo-600">first_name</code> + <code className="text-indigo-600">last_name</code></li>
                <li><strong>Notes:</strong> <code className="text-indigo-600">notes</code>, <code className="text-indigo-600">message</code>, <code className="text-indigo-600">inquiry</code>, or <code className="text-indigo-600">comments</code></li>
                <li><strong>Tags:</strong> Array of strings or comma-separated string</li>
              </ul>
            </div>
          </CardContent>
        </Card>

      </div>

    </div>
  );
}
