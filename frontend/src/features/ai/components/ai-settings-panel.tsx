'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Bot, Sparkles, Save, AlertCircle, Eye, EyeOff, Cpu, CheckCircle } from 'lucide-react';
import { getAISettingsData, saveAISettings } from '../actions/ai-actions';

export default function AISettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form States
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState('groq');
  const [model, setModel] = useState('llama-3.8b-instant');
  const [apiKey, setApiKey] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  
  // UI States
  const [showKey, setShowKey] = useState(false);

  // Default models depending on provider selection
  const groqModels = [
    { value: 'llama-3.8b-instant', label: 'Meta LLaMA 8B Instant (Llama-3.1-8b-instant)' },
    { value: 'llama-3.3-70b-versatile', label: 'Meta LLaMA 70B Versatile (Llama-3.3-70b-versatile)' },
    { value: 'mixtral-8x7b-32768', label: 'Mistral Mixtral 8x7B (Mixtral-8x7b-32768)' }
  ];

  const openrouterModels = [
    { value: 'llama-3.8b-instant', label: 'Meta LLaMA 8B Instruct (meta-llama/llama-3.1-8b-instruct)' },
    { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Meta LLaMA 70B Instruct (meta-llama/llama-3.3-70b-instruct)' },
    { value: 'google/gemini-2.5-flash', label: 'Google Gemini 2.5 Flash' },
    { value: 'openai/gpt-4o-mini', label: 'OpenAI GPT-4o Mini' }
  ];

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await getAISettingsData();
      if (data.success && data.settings) {
        setEnabled(data.settings.enabled);
        setProvider(data.settings.provider);
        setModel(data.settings.model);
        setApiKey(data.settings.apiKey || '');
        setSystemPrompt(data.settings.systemPrompt);
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

  // Set default model on provider switch
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    // Keep 'llama-3.8b-instant' as standard identifier since both handle it
    setModel('llama-3.8b-instant');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await saveAISettings(
        enabled,
        provider,
        model,
        apiKey || null,
        systemPrompt
      );

      if (res.success) {
        setSuccessMsg('AI Configuration saved successfully!');
        // Re-fetch to display masked key status
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
    <Card className="w-full max-w-4xl mx-auto shadow-md">
      <CardHeader className="bg-gray-50/50 border-b pb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
            <Bot className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <CardTitle className="text-xl">AI Assistant Configuration</CardTitle>
            <CardDescription>
              Deploy an AI chatbot to automate custom WhatsApp client conversations for your organization.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <form onSubmit={handleSave}>
        <CardContent className="py-6 space-y-6">
          
          {/* Status Messages */}
          {successMsg && (
            <div className="flex items-center bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              <CheckCircle className="w-4 h-4 mr-2 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="flex items-center bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Toggle Enable */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
            <div>
              <label className="font-semibold text-gray-900 block text-sm">Enable AI Auto-Responder</label>
              <span className="text-xs text-gray-500">
                When enabled, the AI will reply to incoming WhatsApp messages using the settings below.
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Column - Provider Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 border-b pb-2 flex items-center">
                <Cpu className="w-4 h-4 mr-1.5 text-blue-500" /> Model Provider Settings
              </h3>
              
              {/* Provider Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase">AI Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleProviderChange('groq')}
                    className={`py-2 px-3 text-sm rounded-lg border font-semibold text-center transition-all ${
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
                    className={`py-2 px-3 text-sm rounded-lg border font-semibold text-center transition-all ${
                      provider === 'openrouter'
                        ? 'bg-blue-50 text-blue-700 border-blue-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    🌐 OpenRouter (Fallback)
                  </button>
                </div>
              </div>

              {/* Model Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase">AI Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {provider === 'groq'
                    ? groqModels.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))
                    : openrouterModels.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                </select>
                <p className="text-[10px] text-gray-500 leading-normal">
                  {provider === 'groq' 
                    ? 'Groq delivers instant responses using LLaMA models. LLaMA 8B Instant is recommended.'
                    : 'OpenRouter offers fallback to a wide collection of models. Set up an OpenRouter API key to activate.'}
                </p>
              </div>

              {/* API Key Input */}
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
                    className="pr-10 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-gray-500">
                  Tenant-specific keys take priority. If left blank, the app will fall back to the system administrator's global keys.
                </p>
              </div>
            </div>

            {/* Right Column - Prompt Settings */}
            <div className="space-y-4 flex flex-col">
              <h3 className="text-sm font-semibold text-gray-900 border-b pb-2 flex items-center">
                <Sparkles className="w-4 h-4 mr-1.5 text-blue-500" /> Bot Behavior Prompts
              </h3>
              
              <div className="flex-1 flex flex-col space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase">System Prompt / Instructions</label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Tell the AI what role it should play, what services/products you sell, how to reply, and when to refer the customer to a human agent..."
                  className="w-full flex-1 min-h-[160px] bg-white border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-normal leading-relaxed resize-none"
                  required
                />
                <p className="text-[10px] text-gray-500 leading-normal">
                  Define guidelines (e.g., Tone, language, budget filters, lead qualification parameters). Mention key details like business hours or product pricing here.
                </p>
              </div>
            </div>

          </div>

          {/* Antiban Banner */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 flex items-start space-x-3 text-xs leading-relaxed text-blue-800">
            <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-1">🛡️ Native Antiban Features Active</span>
              AI Auto-Replies simulate natural behavior: the bot displays a "typing..." status indicator for 1.5 - 4 seconds before transmitting each response to prevent account flags.
            </div>
          </div>

        </CardContent>
        
        <CardFooter className="bg-gray-50/50 border-t py-4 flex justify-end">
          <Button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 font-semibold px-6"
          >
            {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Settings
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
