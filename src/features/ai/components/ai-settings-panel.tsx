'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { 
  Bot, 
  Sparkles, 
  Save, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Cpu, 
  CheckCircle, 
  RefreshCw, 
  Edit3, 
  User, 
  Building2, 
  Clock, 
  Timer, 
  Sliders, 
  Brain, 
  MessageSquare, 
  Target, 
  Send, 
  Zap, 
  HelpCircle,
  Copy,
  RotateCcw
} from 'lucide-react';
import { getAISettingsData, saveAISettings } from '../actions/ai-actions';

type PromptTab = 'auto_reply' | 'profiler' | 'strategy' | 'copywriter' | 'stagnant' | 'inbound_ad';

export default function AISettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // General States
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState('groq');
  const [selectedPreset, setSelectedPreset] = useState('openai/gpt-oss-120b');
  const [customModelName, setCustomModelName] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [agentName, setAgentName] = useState('Riya');
  const [companyName, setCompanyName] = useState('');
  const [stagnantReactivationEnabled, setStagnantReactivationEnabled] = useState(true);
  const [stagnantHoursThreshold, setStagnantHoursThreshold] = useState(48);

  // Debounce Configuration State
  const [debounceSeconds, setDebounceSeconds] = useState(25);

  // Multi-Agent Prompts States
  const [systemPrompt, setSystemPrompt] = useState('');
  const [profilerPrompt, setProfilerPrompt] = useState('');
  const [strategyPrompt, setStrategyPrompt] = useState('');
  const [copywriterPrompt, setCopywriterPrompt] = useState('');
  const [stagnantPrompt, setStagnantPrompt] = useState('');
  const [inboundAdPrompt, setInboundAdPrompt] = useState('');

  // UI States
  const [showKey, setShowKey] = useState(false);
  const [activePromptTab, setActivePromptTab] = useState<PromptTab>('auto_reply');

  // Preset models depending on provider selection
  const groqModels = [
    { value: 'openai/gpt-oss-120b', label: 'OpenAI GPT-OSS 120B (Recommended)' },
    { value: 'openai/gpt-oss-20b', label: 'OpenAI GPT-OSS 20B (Fast)' },
    { value: 'qwen/qwen3.6-27b', label: 'Qwen 3.6 27B' },
    { value: 'groq/compound', label: 'Groq Compound' },
    { value: 'custom', label: '✏️ Enter Custom Model Name...' }
  ];

  const openrouterModels = [
    { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Meta LLaMA 70B Instruct' },
    { value: 'google/gemini-2.5-flash', label: 'Google Gemini 2.5 Flash' },
    { value: 'openai/gpt-4o-mini', label: 'OpenAI GPT-4o Mini' },
    { value: 'anthropic/claude-3.5-sonnet', label: 'Anthropic Claude 3.5 Sonnet' },
    { value: 'custom', label: '✏️ Enter Custom Model Name...' }
  ];

  // Industry Template Presets
  const promptTemplates: Record<PromptTab, { label: string; templates: { name: string; content: string }[] }> = {
    auto_reply: {
      label: '💬 Auto-Responder Chat',
      templates: [
        {
          name: '🏢 Real Estate & Property',
          content: 'You are a knowledgeable and polite real estate advisor. Help clients discover properties, plots, and luxury villas. Share key specifications, highlight prime locations, and encourage scheduling a site visit or speaking with a property specialist. Always respond naturally without markdown tables, use clean bullet points, and keep answers concise.'
        },
        {
          name: '🛍️ E-Commerce & Retail',
          content: 'You are an enthusiastic customer support specialist. Assist customers with product recommendations, order status, return policies, and checkout queries. Keep replies short, warm, and helpful. Never use markdown tables.'
        },
        {
          name: '💼 B2B SaaS & Consulting',
          content: 'You are a consultative business development advisor. Ask clarifying questions about client requirements, current challenges, and goals. Offer to schedule an executive walkthrough or demo.'
        },
        {
          name: '🏥 Healthcare & Clinics',
          content: 'You are a courteous patient care coordinator. Assist with appointment bookings, consultation timings, and general clinic information. Never provide clinical diagnoses; always recommend consulting our specialist doctors.'
        },
        {
          name: '🔄 Reset to Default',
          content: 'You are a helpful customer engagement and sales assistant. Act like a real human chatting on WhatsApp. Keep your responses concise, helpful, and natural. Never use markdown tables; use clean bullet points instead.'
        }
      ]
    },
    profiler: {
      label: '🎯 Lead Profiler & Scorer',
      templates: [
        {
          name: '🏢 Real Estate Qualification',
          content: 'Score leads higher (80+) if they specify budget, preferred unit size (e.g. 2BHK/3BHK/plot), or request a site visit. Differentiate between investors looking for high rental yields and families looking for immediate possession.'
        },
        {
          name: '💼 B2B Enterprise BANT',
          content: 'Evaluate leads based on B2B BANT: Authority (Founder/VP/Director), Team Size, Budget readiness, and Purchase timeline. Score 85+ if decision maker has an active project or urgent deadline.'
        },
        {
          name: '⚡ Fast High-Intent Filter',
          content: 'Identify immediate buyers vs casual window shoppers. Prioritize leads asking for pricing, financing options, or immediate availability.'
        },
        {
          name: '🔄 Reset to Default',
          content: 'Extract BANT facts (Budget, Authority, Need, Timeline), client sentiment, buying intent, pain points, objections, and calculate a realistic Lead Score (0-100).'
        }
      ]
    },
    strategy: {
      label: '⏱️ Follow-up Cadence',
      templates: [
        {
          name: '🤝 Consultative & Balanced (Recommended)',
          content: 'Space out follow-ups naturally: 24h for warm leads, 48-72h for busy professionals. If the customer asked for time to review, wait at least 3 days. Prioritize value-add messages over generic "checking in".'
        },
        {
          name: '🔥 High-Urgency (Fast Sales Cycles)',
          content: 'Follow up within 3-6 hours if an interested prospect stops responding mid-conversation. Schedule follow-up for next morning if inquiry was late evening. Use limited-slot urgency.'
        },
        {
          name: '🌿 Gentle Nurturing (Long Cycles)',
          content: 'Allow 3 to 5 days between follow-ups. Focus on sharing educational guides, market trends, or project milestones before asking for a phone call.'
        },
        {
          name: '🔄 Reset to Default',
          content: 'Decide when and why the next follow-up should occur. Evaluate lead intent, human notes, and conversation momentum.'
        }
      ]
    },
    copywriter: {
      label: '✍️ Copywriter & Outreach',
      templates: [
        {
          name: '💬 Warm & Casual (Human-like)',
          content: 'Write like a genuine colleague chatting on WhatsApp. Keep messages 2-3 sentences. Use friendly sign-offs. Jump straight into previous discussion points without robotic introductions.'
        },
        {
          name: '🎯 Direct & Action-Oriented',
          content: 'Clear, crisp, and direct. Focus on one primary benefit or question. Always end with a low-friction binary question (e.g. "Would 2 PM or 4 PM work better for you?").'
        },
        {
          name: '👔 Executive / HNI Style',
          content: 'Polite, refined, and professional tone suited for C-level executives and high-net-worth investors. Avoid hype and excessive emojis.'
        },
        {
          name: '🔄 Reset to Default',
          content: 'Write warm, human, high-converting WhatsApp messages. Ground your message in the lead\'s specific needs, past notes, and end with a low-friction question.'
        }
      ]
    },
    stagnant: {
      label: '⚡ Stagnant Deal Re-Activator',
      templates: [
        {
          name: '📦 Fresh Milestone / Inventory Update',
          content: 'Share a fresh project milestone, newly released inventory, or updated price benefit. Re-engage without guilt-tripping (never say "You haven\'t replied").'
        },
        {
          name: '🚪 Soft Break-up Hook',
          content: 'Politely ask if they have already moved forward with another option or if you should close their file for now. This creates gentle urgency and achieves the highest response rates.'
        },
        {
          name: '🎁 VIP Exclusive Incentive',
          content: 'Offer a limited-time incentive, special pricing window, or priority site visit slot to revive the dialogue.'
        },
        {
          name: '🔄 Reset to Default',
          content: 'Write a natural, friendly, zero-pressure re-engagement hook or helpful update to revive the stagnant conversation.'
        }
      ]
    },
    inbound_ad: {
      label: '📣 Instant Ad Lead Greeting',
      templates: [
        {
          name: '📄 Brochure & Floor Plan Offer',
          content: 'Hi {{firstName}}! 👋 Thanks for your interest in {{campaignName}}.\n\nI\'m {{agentName}} from {{companyName}}. I have our detailed project brochure and floor plans ready — would you like me to share them here on WhatsApp?'
        },
        {
          name: '🔍 Direct Discovery Question',
          content: 'Hey {{firstName}}! 👋 Thanks for reaching out via our ad. I\'m {{agentName}} with {{companyName}}.\n\nAre you looking for yourself or exploring investment options?'
        },
        {
          name: '📞 Quick Callback Consultation',
          content: 'Hello {{firstName}}! 👋 Thank you for contacting {{companyName}} regarding {{campaignName}}.\n\nI\'m {{agentName}}. Would now be a good time for a quick 2-minute chat, or should I message details here?'
        },
        {
          name: '🔄 Reset to Default',
          content: 'Hi {{firstName}}! 👋 Thanks for reaching out to {{companyName}} regarding {{campaignName}}.\n\nI\'m {{agentName}}. How can I assist you with details today?'
        }
      ]
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await getAISettingsData();
      if (data.success && data.settings) {
        setEnabled(data.settings.enabled);
        setProvider(data.settings.provider);
        setApiKey(data.settings.apiKey || '');
        setAgentName(data.settings.agentName || 'Riya');
        setCompanyName(data.settings.companyName || '');
        setSystemPrompt(data.settings.systemPrompt || '');
        setDebounceSeconds(data.settings.debounceSeconds ?? 25);
        setProfilerPrompt(data.settings.profilerPrompt || '');
        setStrategyPrompt(data.settings.strategyPrompt || '');
        setCopywriterPrompt(data.settings.copywriterPrompt || '');
        setStagnantPrompt(data.settings.stagnantPrompt || '');
        setInboundAdPrompt(data.settings.inboundAdPrompt || '');

        if (data.settings.stagnantReactivationEnabled !== undefined) {
          setStagnantReactivationEnabled(Boolean(data.settings.stagnantReactivationEnabled));
        }
        if (data.settings.stagnantHoursThreshold) {
          setStagnantHoursThreshold(Number(data.settings.stagnantHoursThreshold));
        }

        const currentModel = data.settings.model || 'openai/gpt-oss-120b';
        const activePresets = data.settings.provider === 'groq' ? groqModels : openrouterModels;
        const matchingPreset = activePresets.find(m => m.value === currentModel);

        if (matchingPreset && matchingPreset.value !== 'custom') {
          setSelectedPreset(matchingPreset.value);
          setIsCustomMode(false);
          setCustomModelName('');
        } else {
          setSelectedPreset('custom');
          setIsCustomMode(true);
          setCustomModelName(currentModel);
        }
      }
    } catch (err: any) {
      setErrorMsg('Failed to load AI settings: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    if (newProvider === 'groq') {
      setSelectedPreset('openai/gpt-oss-120b');
      setIsCustomMode(false);
    } else {
      setSelectedPreset('meta-llama/llama-3.3-70b-instruct');
      setIsCustomMode(false);
    }
  };

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value);
    if (value === 'custom') {
      setIsCustomMode(true);
    } else {
      setIsCustomMode(false);
      setCustomModelName('');
    }
  };

  const applyTemplate = (tab: PromptTab, content: string) => {
    switch (tab) {
      case 'auto_reply':
        setSystemPrompt(content);
        break;
      case 'profiler':
        setProfilerPrompt(content);
        break;
      case 'strategy':
        setStrategyPrompt(content);
        break;
      case 'copywriter':
        setCopywriterPrompt(content);
        break;
      case 'stagnant':
        setStagnantPrompt(content);
        break;
      case 'inbound_ad':
        setInboundAdPrompt(content);
        break;
    }
  };

  const getCurrentPromptValue = (tab: PromptTab): string => {
    switch (tab) {
      case 'auto_reply': return systemPrompt;
      case 'profiler': return profilerPrompt;
      case 'strategy': return strategyPrompt;
      case 'copywriter': return copywriterPrompt;
      case 'stagnant': return stagnantPrompt;
      case 'inbound_ad': return inboundAdPrompt;
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    const finalModel = isCustomMode 
      ? customModelName.trim() 
      : selectedPreset;

    if (!finalModel) {
      setErrorMsg('Please specify or select a valid AI Model.');
      setSaving(false);
      return;
    }

    try {
      const res = await saveAISettings(
        enabled,
        provider,
        finalModel,
        apiKey || null,
        systemPrompt,
        agentName.trim() || 'Riya',
        companyName.trim() || undefined,
        stagnantReactivationEnabled,
        stagnantHoursThreshold,
        debounceSeconds,
        profilerPrompt,
        strategyPrompt,
        copywriterPrompt,
        stagnantPrompt,
        inboundAdPrompt
      );

      if (res.success) {
        setSuccessMsg('All AI Configurations and Agent Prompts saved successfully!');
        fetchSettings();
      } else {
        setErrorMsg(res.error || 'Failed to save configuration.');
      }
    } catch (err: any) {
      setErrorMsg('Error saving configuration: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Cpu className="w-8 h-8 text-blue-500 animate-spin mr-3" />
        <span className="text-gray-500 font-medium">Loading AI Configurations...</span>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-5xl mx-auto shadow-md">
      <CardHeader className="bg-gray-50/50 border-b pb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
            <Bot className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <CardTitle className="text-xl">AI Assistant & Multi-Agent Prompts Studio</CardTitle>
            <CardDescription>
              Configure WhatsApp burst debouncing, agent personas, models, and industry-specific prompts for every autonomous AI agent.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <form onSubmit={handleSave}>
        <CardContent className="py-6 space-y-6">
          
          {/* Status Messages */}
          {successMsg && (
            <div className="flex items-center bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm animate-in fade-in">
              <CheckCircle className="w-4 h-4 mr-2 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="flex items-center bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm animate-in fade-in">
              <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* SECTION 1: GLOBAL TOGGLES & AUTOMATION CONTROLS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Toggle Enable Auto-Responder */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div>
                <label className="font-semibold text-gray-900 block text-sm">Enable AI Auto-Responder</label>
                <span className="text-xs text-gray-500">
                  Autonomous conversational replies to incoming WhatsApp messages.
                </span>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="w-11 h-6 bg-gray-200 rounded-full appearance-none cursor-pointer checked:bg-blue-600 relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all checked:after:translate-x-full"
                />
              </div>
            </div>

            {/* Autonomous Stagnant Deal Re-Activator Toggle */}
            <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <label className="font-bold text-gray-900 text-sm">Stagnant Deal Re-Activator</label>
                  </div>
                  <p className="text-[11px] text-gray-600">
                    Auto-revives idle leads stalled in pipeline stages.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={stagnantReactivationEnabled}
                  onChange={(e) => setStagnantReactivationEnabled(e.target.checked)}
                  className="w-11 h-6 bg-gray-200 rounded-full appearance-none cursor-pointer checked:bg-amber-600 relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all checked:after:translate-x-full"
                />
              </div>
              {stagnantReactivationEnabled && (
                <div className="pt-2 border-t border-amber-200/70 flex items-center justify-between text-xs">
                  <span className="text-gray-700 font-medium">Trigger after inactivity:</span>
                  <select
                    value={stagnantHoursThreshold}
                    onChange={(e) => setStagnantHoursThreshold(Number(e.target.value))}
                    className="bg-white border border-amber-300 rounded px-2 py-0.5 text-xs font-semibold text-gray-800"
                  >
                    <option value={24}>24h (1 Day)</option>
                    <option value={48}>48h (2 Days)</option>
                    <option value={72}>72h (3 Days)</option>
                    <option value={168}>7 Days</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: CONFIGURABLE DEBOUNCING TIME (BURST BUFFER) */}
          <div className="p-5 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-indigo-200/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                  <Timer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    Incoming WhatsApp Burst Debouncing Window
                    <span className="px-2 py-0.5 bg-indigo-600 text-white text-xs font-mono font-bold rounded-full">
                      {debounceSeconds}s Window
                    </span>
                  </h3>
                  <p className="text-xs text-gray-600">
                    Groups rapid fragmented user messages into a single, comprehensive response instead of sending multiple replies.
                  </p>
                </div>
              </div>

              {/* Number Input Box */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-xs font-semibold text-gray-600">Seconds:</span>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={debounceSeconds}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (!isNaN(val)) setDebounceSeconds(Math.max(5, Math.min(120, val)));
                  }}
                  className="w-16 bg-white border border-indigo-300 rounded-lg px-2.5 py-1 text-sm font-bold text-center text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Range Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium">
                <span>5s (Ultra-Fast)</span>
                <span>25s (Recommended)</span>
                <span>60s (Thoughtful Multi-Line)</span>
                <span>120s (Extended Buffer)</span>
              </div>
              <input
                type="range"
                min={5}
                max={120}
                step={1}
                value={debounceSeconds}
                onChange={(e) => setDebounceSeconds(Number(e.target.value))}
                className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            {/* Quick Presets Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-semibold text-gray-700 mr-1">Quick Presets:</span>
              {[
                { sec: 10, label: '10s (Fast)' },
                { sec: 15, label: '15s' },
                { sec: 25, label: '25s (Recommended)' },
                { sec: 35, label: '35s' },
                { sec: 45, label: '45s' },
                { sec: 60, label: '60s' }
              ].map((p) => (
                <button
                  key={p.sec}
                  type="button"
                  onClick={() => setDebounceSeconds(p.sec)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
                    debounceSeconds === p.sec
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-indigo-50 hover:border-indigo-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="text-[11px] text-indigo-900/80 bg-white/70 p-2.5 rounded-lg border border-indigo-100 flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                <strong>How it works:</strong> The webhook acknowledges incoming messages immediately in &lt;30ms (HTTP 200). If the user sends follow-up messages within the {debounceSeconds}s window (e.g. "hi" $\rightarrow$ "are you there" $\rightarrow$ "how much is the villa?"), the timer resets and aggregates them into one thought. If a human agent replies via phone or inbox, the timer cancels immediately.
              </span>
            </div>
          </div>

          {/* SECTION 3: AGENT PERSONA & BRANDING */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <User className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">AI Persona & Organization Identity</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-500" /> AI Agent Name / Persona
                </label>
                <Input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g. Riya (Default)"
                  className="bg-white text-xs font-medium"
                  required
                />
                <p className="text-[11px] text-gray-500">
                  The name of your human-like chat representative (Default: <strong>Riya</strong>).
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-500" /> Company / Brand Name
                </label>
                <Input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Autozonex Technologies"
                  className="bg-white text-xs font-medium"
                />
                <p className="text-[11px] text-gray-500">
                  Used by the AI representative to represent your company naturally in chat.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 4: MODEL PROVIDER & API KEYS */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-4">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b pb-2 flex items-center">
              <Cpu className="w-4 h-4 mr-1.5 text-blue-500" /> AI Engine & LLM Provider Configuration
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Provider Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase">AI Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleProviderChange('groq')}
                    className={`py-2 px-3 text-xs rounded-lg border font-semibold text-center transition-all ${
                      provider === 'groq'
                        ? 'bg-blue-50 text-blue-700 border-blue-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    🚀 Groq (Ultra-Fast)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProviderChange('openrouter')}
                    className={`py-2 px-3 text-xs rounded-lg border font-semibold text-center transition-all ${
                      provider === 'openrouter'
                        ? 'bg-blue-50 text-blue-700 border-blue-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    🌐 OpenRouter (Fallback)
                  </button>
                </div>
              </div>

              {/* Model Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase">Model Selection</label>
                <select
                  value={selectedPreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                >
                  {(provider === 'groq' ? groqModels : openrouterModels).map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>

                {isCustomMode && (
                  <div className="pt-1 space-y-1 animate-in fade-in">
                    <Input
                      type="text"
                      value={customModelName}
                      onChange={(e) => setCustomModelName(e.target.value)}
                      placeholder={provider === 'groq' ? 'e.g. qwen/qwen3.6-27b' : 'e.g. meta-llama/llama-3.3-70b-instruct'}
                      className="bg-white text-xs"
                      required
                    />
                  </div>
                )}
              </div>
            </div>

            {/* API Secret Key */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase">API Secret Key</label>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    provider === 'groq' 
                      ? 'Enter Groq API Key (gsk_...)' 
                      : 'Enter OpenRouter API Key (sk-or-...)'
                  }
                  className="pr-10 bg-white text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-gray-500">
                Leave blank to inherit the global server system key. Custom keys ensure dedicated quota for your organization.
              </p>
            </div>
          </div>

          {/* SECTION 5: MULTI-AGENT PROMPTS STUDIO */}
          <div className="bg-white rounded-xl border border-blue-200 overflow-hidden shadow-sm">
            <div className="p-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-blue-300" />
                <div>
                  <h3 className="font-bold text-sm">AI Multi-Agent Prompts Studio</h3>
                  <p className="text-xs text-blue-200">
                    Customize the unique instructions and behavioral guidelines for each specialized AI agent.
                  </p>
                </div>
              </div>
              <span className="text-[11px] bg-blue-800/80 px-2.5 py-1 rounded-full font-medium text-blue-200 border border-blue-700 self-start sm:self-auto">
                6 Dedicated Agents
              </span>
            </div>

            {/* Tab Navigation for Agents */}
            <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50/70 p-1.5 gap-1 text-xs">
              {[
                { key: 'auto_reply' as PromptTab, label: '💬 Auto-Responder Chat', icon: MessageSquare },
                { key: 'profiler' as PromptTab, label: '🎯 Lead Profiler', icon: Target },
                { key: 'strategy' as PromptTab, label: '⏱️ Follow-up Cadence', icon: Clock },
                { key: 'copywriter' as PromptTab, label: '✍️ Copywriter & Outreach', icon: Edit3 },
                { key: 'stagnant' as PromptTab, label: '⚡ Stagnant Re-Activator', icon: Zap },
                { key: 'inbound_ad' as PromptTab, label: '📣 Instant Ad Greeting', icon: Send },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activePromptTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActivePromptTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-white text-blue-700 shadow-sm border border-gray-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Prompt Editor Body */}
            <div className="p-5 space-y-4">
              {/* Tab Header & Details */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">
                    {promptTemplates[activePromptTab].label} Instructions
                  </h4>
                  <p className="text-xs text-gray-500">
                    {activePromptTab === 'auto_reply' && 'Controls the real-time AI conversation on WhatsApp, FAQ replies, anti-hallucination, and brand tone.'}
                    {activePromptTab === 'profiler' && 'Directs how the Lead Profiler scores buyer intent (0-100), extracts BANT budget/timeline, and identifies qualified leads.'}
                    {activePromptTab === 'strategy' && 'Instructs how the Strategy Agent determines the optimal timing and reason for the next automated touchpoint.'}
                    {activePromptTab === 'copywriter' && 'Guides the voice, persuasion style, WhatsApp formatting, and closing calls-to-action for follow-up message drafts.'}
                    {activePromptTab === 'stagnant' && 'Rules for re-engaging idle deals that have stalled in pipeline stages without recent rep activity.'}
                    {activePromptTab === 'inbound_ad' && 'The instant 3-second welcome greeting sent to ad leads when they submit a form (Meta, Google, TikTok, Web).'}
                  </p>
                </div>

                {/* Character Count */}
                <div className="text-[11px] font-mono text-gray-400 self-end sm:self-auto">
                  {getCurrentPromptValue(activePromptTab).length} chars
                </div>
              </div>

              {/* 1-Click Industry Template Presets */}
              <div className="space-y-1.5 bg-blue-50/40 p-3 rounded-xl border border-blue-100">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" /> 1-Click Industry Templates (Click to Load):
                </span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {promptTemplates[activePromptTab].templates.map((tpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applyTemplate(activePromptTab, tpl.content)}
                      className="px-2.5 py-1 text-xs bg-white text-blue-800 hover:bg-blue-600 hover:text-white border border-blue-200 rounded-md font-medium transition-all shadow-2xs"
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Textarea based on active tab */}
              <div className="space-y-2">
                {activePromptTab === 'auto_reply' && (
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Provide guidelines for the WhatsApp conversational agent..."
                    className="w-full min-h-[180px] bg-white border border-gray-200 rounded-lg p-3 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-y"
                    required
                  />
                )}

                {activePromptTab === 'profiler' && (
                  <textarea
                    value={profilerPrompt}
                    onChange={(e) => setProfilerPrompt(e.target.value)}
                    placeholder="Enter custom scoring and qualification criteria for the Lead Profiler Agent (or leave blank for standard criteria)..."
                    className="w-full min-h-[180px] bg-white border border-gray-200 rounded-lg p-3 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-y"
                  />
                )}

                {activePromptTab === 'strategy' && (
                  <textarea
                    value={strategyPrompt}
                    onChange={(e) => setStrategyPrompt(e.target.value)}
                    placeholder="Enter custom follow-up timing and cadence rules for the Strategy Agent (or leave blank for standard rules)..."
                    className="w-full min-h-[180px] bg-white border border-gray-200 rounded-lg p-3 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-y"
                  />
                )}

                {activePromptTab === 'copywriter' && (
                  <textarea
                    value={copywriterPrompt}
                    onChange={(e) => setCopywriterPrompt(e.target.value)}
                    placeholder="Enter tone of voice, formatting, and closing rules for follow-up message drafts (or leave blank for standard rules)..."
                    className="w-full min-h-[180px] bg-white border border-gray-200 rounded-lg p-3 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-y"
                  />
                )}

                {activePromptTab === 'stagnant' && (
                  <textarea
                    value={stagnantPrompt}
                    onChange={(e) => setStagnantPrompt(e.target.value)}
                    placeholder="Enter custom rules for waking up cold, inactive leads stalled in pipelines (or leave blank for standard rules)..."
                    className="w-full min-h-[180px] bg-white border border-gray-200 rounded-lg p-3 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-y"
                  />
                )}

                {activePromptTab === 'inbound_ad' && (
                  <div className="space-y-2">
                    <textarea
                      value={inboundAdPrompt}
                      onChange={(e) => setInboundAdPrompt(e.target.value)}
                      placeholder="Enter the greeting template for incoming ad leads with {{firstName}}, {{companyName}}, {{campaignName}}..."
                      className="w-full min-h-[180px] bg-white border border-gray-200 rounded-lg p-3 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-y"
                    />
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                      <span className="font-bold text-gray-700">Available Variables:</span>
                      {['{{firstName}}', '{{companyName}}', '{{agentName}}', '{{campaignName}}', '{{leadNotes}}', '{{source}}'].map((tag) => (
                        <code 
                          key={tag} 
                          onClick={() => setInboundAdPrompt((prev) => prev + ' ' + tag)}
                          className="bg-white px-1.5 py-0.5 rounded border border-gray-300 text-blue-700 font-semibold cursor-pointer hover:bg-blue-50"
                          title="Click to insert"
                        >
                          {tag}
                        </code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 6: NATIVE ANTIBAN & REPUTATION BANNER */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex items-start space-x-3 text-xs leading-relaxed text-blue-900">
            <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-1">🛡️ Native Antiban & Human Emulation Active</span>
              All AI Auto-Replies emulate human behavior: typing presence simulation, variable delays, 25s burst buffer grouping, and anti-hallucination constraints are active across all 6 agents to protect your WhatsApp numbers from spam flags.
            </div>
          </div>

        </CardContent>
        
        <CardFooter className="bg-gray-50/50 border-t py-4 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={fetchSettings}
            disabled={saving}
            className="text-xs text-gray-600"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Revert Changes
          </Button>

          <Button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 font-semibold px-6 text-xs shadow-sm"
          >
            {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save All Configurations & Prompts
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
