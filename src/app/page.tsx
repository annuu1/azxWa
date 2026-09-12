'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Bot, 
  MessageSquare, 
  Zap, 
  ShieldCheck, 
  Layers, 
  Users, 
  CheckCircle2, 
  ArrowRight, 
  Smartphone, 
  Server, 
  TrendingUp, 
  BarChart3, 
  Sparkles, 
  Cpu, 
  FileText, 
  Lock, 
  Clock, 
  Send, 
  ChevronDown, 
  ChevronUp, 
  Building2, 
  Car, 
  Home, 
  ShoppingBag, 
  Stethoscope, 
  Check, 
  X,
  UserCheck,
  Flame,
  CornerDownRight,
  Shield,
  PhoneCall
} from 'lucide-react';
import { PLATFORM_INFO } from '@/shared/config/platform';

const WHATSAPP_PHONE = '917348393452';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}?text=Hi%20AutoZoneX%20team,%20I'm%20interested%20in%20a%20demo%20and%20pricing%20for%20AutoZoneX%20Connect!`;

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<'agents' | 'inbox' | 'crm' | 'broadcast'>('agents');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: "How does the Autonomous Multi-Agent AI differ from regular ChatGPT auto-replies?",
      a: "Generic ChatGPT bots operate without CRM context, fail to score buyer intent, and frequently hallucinate robotic bracket templates like '[Your Name]'. AutoZoneX Connect deploys a 4-tier specialized agent team: the Lead Profiler scores intent (0-100) and BANT qualifications; the Follow-Up Strategist plans the exact re-engagement window; the Copywriter crafts consultative messages using your custom agent persona ('Riya') and branding; and the Supervisor Arbiter enforces guardrails, auto-escalating frustrated clients to human reps."
    },
    {
      q: "Will our WhatsApp numbers get banned for sending bulk broadcasts?",
      a: "Cloud blasting tools get blocked because they blast thousands of messages simultaneously through unthrottled API threads. AutoZoneX Connect incorporates an intelligent Queue Worker with human-jitter pacing, randomized delay intervals, message template variables ({{firstName}}), and typing indicator simulation. Combined with organic two-way AI replies, WhatsApp algorithms recognize your numbers as reputable, high-trust business lines."
    },
    {
      q: "Why should we choose self-hosted instead of cloud tools like WATI or Respond.io?",
      a: "Traditional cloud SaaS providers charge steep per-conversation fees and penalize growing contact lists with escalating monthly tiers. With AutoZoneX Connect, you own 100% of your data on your own Docker or Linux server. Customer phone numbers, confidential negotiations, and chat histories remain strictly within your infrastructure with zero per-message markups."
    },
    {
      q: "Can human sales agents take over conversations from the AI?",
      a: "Yes, instantly. Every chat in the Unified Inbox has a 1-click Contact AI Toggle in the header. When an agent opens a conversation or sends a message, the AI automatically pauses for that contact. Additionally, the Supervisor Arbiter automatically hands off the lead if it detects frustrated sentiment or confidence below 70%."
    },
    {
      q: "Can we connect multiple WhatsApp accounts across different branches or reps?",
      a: "Yes. Organizations can connect multiple WhatsApp sessions simultaneously via QR Code or 8-digit Pairing Code. Your sales team can manage leads from different numbers within one centralized, role-based dashboard."
    }
  ];

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 selection:bg-emerald-500 selection:text-white font-sans antialiased">
      
      {/* Background Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-emerald-600/15 via-indigo-600/10 to-transparent blur-[140px] rounded-full" />
        <div className="absolute top-[35%] -left-[10%] w-[600px] h-[600px] bg-emerald-600/10 blur-[150px] rounded-full" />
        <div className="absolute top-[60%] -right-[10%] w-[600px] h-[600px] bg-blue-600/10 blur-[150px] rounded-full" />
      </div>

      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#07090E]/80 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#07090E] rounded-[10px] flex items-center justify-center">
                <span className="font-black text-transparent bg-clip-text bg-gradient-to-tr from-emerald-400 to-teal-200 text-lg">
                  {PLATFORM_INFO.shortName || 'A'}
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">{PLATFORM_INFO.name}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  AI 2.0
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">WhatsApp CRM & Autonomous AI</p>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-emerald-400 transition-colors">Features</a>
            <a href="#multi-agent" className="hover:text-emerald-400 transition-colors">AI Agents</a>
            <a href="#crm" className="hover:text-emerald-400 transition-colors">Deals CRM</a>
            <a href="#comparison" className="hover:text-emerald-400 transition-colors">Comparison</a>
            <a href="#faq" className="hover:text-emerald-400 transition-colors">FAQ</a>
          </nav>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-3">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20 transition-all"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>+91 7348393452</span>
            </a>

            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>

            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-95 transition-all"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.1] text-xs text-emerald-400 font-medium mb-6 shadow-inner backdrop-blur-md animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Autonomous 4-Tier Multi-Agent AI System</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-300">Self-Hosted Private CRM</span>
          </div>

          {/* Hero Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto leading-[1.15]">
            Turn WhatsApp into an{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
              Autonomous Sales & Support Machine
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed font-normal">
            Connect unlimited WhatsApp accounts to an autonomous AI sales team that qualifies leads with BANT scoring, crafts consultative responses, schedules smart follow-ups, and moves deals through visual pipelines—running 100% on your own infrastructure.
          </p>

          {/* Action CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2.5 px-8 py-4 text-base font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-xl shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all"
            >
              <span>Launch Platform</span>
              <ArrowRight className="w-5 h-5" />
            </Link>

            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 px-8 py-4 text-base font-semibold rounded-xl bg-[#121824] text-emerald-400 border border-emerald-500/30 hover:bg-emerald-950/30 hover:border-emerald-500/50 transition-all shadow-lg"
            >
              <Smartphone className="w-5 h-5 text-emerald-400" />
              <span>Chat on WhatsApp (+91 7348393452)</span>
            </a>
          </div>

          {/* Trust & Performance Metrics Bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm">
              <div className="text-3xl font-extrabold text-emerald-400">4 sec</div>
              <div className="text-xs text-slate-400 mt-1 font-medium">Avg. Lead Response Time</div>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm">
              <div className="text-3xl font-extrabold text-teal-400">45%</div>
              <div className="text-xs text-slate-400 mt-1 font-medium">Higher Conversion Rate</div>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm">
              <div className="text-3xl font-extrabold text-cyan-400">100%</div>
              <div className="text-xs text-slate-400 mt-1 font-medium">On-Prem Data Privacy</div>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm">
              <div className="text-3xl font-extrabold text-white">$0.00</div>
              <div className="text-xs text-slate-400 mt-1 font-medium">Per-Message SaaS Markup</div>
            </div>
          </div>

        </div>

        {/* 3. Hero Visual Preview Window */}
        <div className="mt-14 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-2xl p-1 bg-gradient-to-b from-white/20 via-white/5 to-transparent shadow-2xl shadow-emerald-500/10">
            <div className="rounded-[15px] bg-[#0C101A] border border-white/10 overflow-hidden">
              
              {/* Window Header Bar */}
              <div className="px-4 py-3 bg-[#0A0D15] border-b border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-3 text-xs text-slate-400 font-mono">AutoZoneX Connect • Multi-Agent Control Center</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Engine Online (Session: Primary Sales)</span>
                </div>
              </div>

              {/* Window Body Grid: Live Inbox + Multi-Agent Intelligence */}
              <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[440px]">
                
                {/* Left: Chat Flow */}
                <div className="lg:col-span-7 p-6 border-b lg:border-b-0 lg:border-r border-white/[0.08] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm border border-emerald-500/30">
                          AS
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-white flex items-center gap-2">
                            <span>Amit Sharma</span>
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">Name Cleaned</span>
                          </div>
                          <p className="text-xs text-slate-400">+91 98765 43210 • WhatsApp Inbound</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-500/30">
                        <Bot className="w-3.5 h-3.5" />
                        <span>AI Active</span>
                      </div>
                    </div>

                    {/* Chat Bubble Thread */}
                    <div className="space-y-4 my-6">
                      {/* Customer Incoming */}
                      <div className="flex flex-col items-start max-w-[85%]">
                        <div className="bg-[#171F30] border border-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-200">
                          Hi, I am looking for 5 commercial EV delivery vans for our logistics fleet. What are your pricing plans, delivery timelines, and battery warranty terms?
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 pl-1">10:42 AM</span>
                      </div>

                      {/* AI Copilot Typing & Synthesized Reply */}
                      <div className="flex flex-col items-end max-w-[90%] ml-auto">
                        <div className="bg-gradient-to-r from-emerald-600/90 to-teal-600/90 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm shadow-md">
                          <p className="font-semibold text-emerald-200 text-xs mb-1 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            Riya from AutoZoneX (Copywriter Agent)
                          </p>
                          Hello Amit! Thanks for reaching out. We have our EV Cargo Van available with 180 km range and an 8-year / 160,000 km battery warranty. For a fleet of 5 units, we offer commercial fleet pricing starting at ₹12.5L per unit with delivery within 14 business days. Would you like me to share our official fleet brochure and schedule a quick 10-minute demo call with our fleet specialist?
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 pr-1 flex items-center gap-1">
                          <span>Delivered</span> • <span>10:42 AM (3s response)</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-emerald-400" />
                      100% Encrypted • Self-Hosted Server
                    </span>
                    <span className="text-emerald-400 font-medium">Grounding: Fleet_Specs_2026.pdf</span>
                  </div>
                </div>

                {/* Right: Multi-Agent Intelligence Panel */}
                <div className="lg:col-span-5 p-6 bg-[#0E1320] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-emerald-400" />
                        <span className="font-semibold text-sm text-white">Multi-Agent Lead Intelligence</span>
                      </div>
                      <span className="text-xs bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded">
                        Score: 94/100
                      </span>
                    </div>

                    <div className="mt-4 space-y-3.5">
                      {/* BANT Metrics */}
                      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                        <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-2">
                          BANT Qualification (Lead Profiler)
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-400">Need:</span> <span className="text-slate-200 font-medium">5 EV Cargo Vans</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Timeline:</span> <span className="text-emerald-400 font-medium">Immediate (14 days)</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Intent:</span> <span className="text-emerald-400 font-bold">HIGH</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Sentiment:</span> <span className="text-cyan-400 font-medium">Positive</span>
                          </div>
                        </div>
                      </div>

                      {/* Follow-up Strategy Recommendation */}
                      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                        <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-1 flex items-center justify-between">
                          <span>Follow-up Strategist</span>
                          <span className="text-teal-400 text-[10px]">Optimal Timing</span>
                        </div>
                        <p className="text-xs text-slate-300">
                          Schedule check-in for <strong className="text-white">Tomorrow 10:30 AM</strong> if fleet PDF is not acknowledged.
                        </p>
                      </div>

                      {/* Pipeline Stage Recommendation */}
                      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                        <div>
                          <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                            Supervisor Arbiter
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5">Move deal to <strong className="text-emerald-400">"Proposal / Discovery"</strong></p>
                        </div>
                        <div className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded text-[11px] font-semibold">
                          Confidence: 96%
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-center justify-between">
                    <span className="text-xs text-slate-400">Status: Automated Autopilot</span>
                    <Link
                      href="/register"
                      className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      <span>Explore Live CRM</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>

      </section>

      {/* 4. Multi-Agent AI Deep Dive */}
      <section id="multi-agent" className="py-20 md:py-28 bg-[#090D15] border-t border-white/[0.06] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 mb-4">
              <Bot className="w-3.5 h-3.5" />
              The AI Architecture
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              An Autonomous 4-Tier AI Team Working For You
            </h2>
            <p className="mt-4 text-slate-400 text-base sm:text-lg">
              Unlike simplistic chatbots that spout generic answers, AutoZoneX Connect runs four specialized agents in sequence to qualify, strategize, draft, and oversee every lead.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Agent 1: Lead Profiler */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-emerald-500/30 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">Agent 01</div>
              <h3 className="text-xl font-bold text-white mb-2">Lead Profiler</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Evaluates psychographic buyer intent, extracts BANT metrics (Budget, Authority, Need, Timeline), detects sentiment, and generates an algorithmic 0–100 lead score.
              </p>
              <div className="mt-4 pt-4 border-t border-white/[0.06] text-xs text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Intent Classification</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> BANT Qualification</div>
              </div>
            </div>

            {/* Agent 2: Follow-up Strategist */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-teal-500/30 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/25 flex items-center justify-center text-teal-400 mb-5 group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold text-teal-400 uppercase tracking-wider mb-1">Agent 02</div>
              <h3 className="text-xl font-bold text-white mb-2">Follow-up Strategist</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Determines the exact psychological moment to re-engage (Immediate, Few Hours, Next Morning, 2 Days) and defines the exact conversational goal for maximum conversion.
              </p>
              <div className="mt-4 pt-4 border-t border-white/[0.06] text-xs text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-teal-400" /> Optimal Timing Windows</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-teal-400" /> Tactical Next Objective</div>
              </div>
            </div>

            {/* Agent 3: Copywriter */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-cyan-500/30 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 mb-5 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1">Agent 03</div>
              <h3 className="text-xl font-bold text-white mb-2">Consultative Copywriter</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Adopts your customizable persona (e.g. &quot;Riya from AutoZoneX&quot;) and brand voice. Generates natural WhatsApp messages with zero robotic placeholder brackets.
              </p>
              <div className="mt-4 pt-4 border-t border-white/[0.06] text-xs text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" /> Zero Bracket Hallucinations</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" /> Dynamic Persona & Branding</div>
              </div>
            </div>

            {/* Agent 4: Supervisor Arbiter */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-indigo-500/30 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 mb-5 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Agent 04</div>
              <h3 className="text-xl font-bold text-white mb-2">Supervisor Arbiter</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Calculates decision confidence. Automatically halts AI and escalates to human reps if a client is frustrated or confidence drops below 70%, ensuring brand safety.
              </p>
              <div className="mt-4 pt-4 border-t border-white/[0.06] text-xs text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> Frustration Detection</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> Auto-Stage Progression</div>
              </div>
            </div>

          </div>

          {/* Persona & Name Cleaner Showcase Strip */}
          <div className="mt-10 p-6 rounded-2xl bg-gradient-to-r from-emerald-950/20 via-slate-900/60 to-indigo-950/20 border border-emerald-500/20 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">Intelligent Contact Name Cleaner Included</h4>
                <p className="text-xs sm:text-sm text-slate-400">
                  Automatically strips emojis, country codes, and corporate suffixes (e.g. &quot;📱 Rahul Verma (Broker)&quot; &rarr; &quot;Rahul&quot;) so every greeting sounds human and warm.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/ai"
              className="px-5 py-2.5 rounded-lg bg-emerald-500 text-white font-semibold text-xs whitespace-nowrap hover:bg-emerald-400 transition-colors shadow"
            >
              Configure AI Persona
            </Link>
          </div>

        </div>
      </section>

      {/* 5. Complete Feature Matrix */}
      <section id="features" className="py-20 md:py-28 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs font-semibold text-cyan-400 mb-4">
              <Layers className="w-3.5 h-3.5" />
              Full Platform Capabilities
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              Everything You Need To Scale WhatsApp Revenue
            </h2>
            <p className="mt-4 text-slate-400 text-base sm:text-lg">
              A complete suite of sales, support, and marketing infrastructure engineered for modern businesses.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-white/20 transition-all">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Multi-Session WhatsApp</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Connect and manage multiple WhatsApp numbers simultaneously via QR scan or 8-digit Pairing Code. Monitor live engine health, automated failover, and remote session restart.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-white/20 transition-all">
              <div className="w-10 h-10 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center mb-4">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Unified Team Inbox</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Real-time shared inbox with SSE sync. Full rich media support (photos, videos, audio, PDFs, stickers), quoted replies, emoji reactions, and human-like typing simulation.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-white/20 transition-all">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Deals Kanban Pipeline</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Drag-and-drop deal management across custom pipeline stages. Full 360° contact history timeline combining messages, staff internal notes, and AI qualification updates.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-white/20 transition-all">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4">
                <Send className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Anti-Ban Campaign Broadcasts</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Run targeted bulk campaigns safely. Our asynchronous queue engine employs human-jitter pacing delays, personalized variables (&#123;&#123;firstName&#125;&#125;), and 3-attempt auto-retries.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-white/20 transition-all">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Grounded RAG Knowledge Base</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Upload your product brochures, PDFs, pricing sheets, and FAQs. The AI answers technical questions and pricing requests by directly citing your documents with zero hallucinations.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-white/20 transition-all">
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center mb-4">
                <Server className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">100% Self-Hosted Privacy</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Run with Docker Compose or PM2 on your private Linux VPS. All contact lists, customer data, and messages remain completely under your control with zero cloud vendor lock-in.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* 6. Competitor Comparison Table */}
      <section id="comparison" className="py-20 md:py-28 bg-[#090D15] border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 mb-4">
              <ShieldCheck className="w-3.5 h-3.5" />
              Why AutoZoneX Connect
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              How We Compare Against Market Leaders
            </h2>
            <p className="mt-4 text-slate-400 text-base sm:text-lg">
              Compare our self-hosted, multi-agent platform directly with traditional cloud alternatives like WATI, Respond.io, and Interakt.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse rounded-2xl overflow-hidden bg-[#0C101A] border border-white/[0.08]">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                  <th className="py-4 px-6 text-sm font-semibold text-slate-300">Feature / Capability</th>
                  <th className="py-4 px-6 text-sm font-bold text-emerald-400 bg-emerald-500/10 border-x border-emerald-500/20">
                    AutoZoneX Connect
                  </th>
                  <th className="py-4 px-6 text-sm font-semibold text-slate-400">WATI</th>
                  <th className="py-4 px-6 text-sm font-semibold text-slate-400">Respond.io</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-sm">
                
                <tr>
                  <td className="py-4 px-6 font-medium text-slate-200">Deployment & Data Privacy</td>
                  <td className="py-4 px-6 font-bold text-emerald-400 bg-emerald-500/5 border-x border-emerald-500/20 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    100% Self-Hosted / Private Server
                  </td>
                  <td className="py-4 px-6 text-slate-400">Cloud Only (Shared Servers)</td>
                  <td className="py-4 px-6 text-slate-400">Cloud Only (Shared Servers)</td>
                </tr>

                <tr>
                  <td className="py-4 px-6 font-medium text-slate-200">Per-Message / Per-Conversation Fees</td>
                  <td className="py-4 px-6 font-bold text-emerald-400 bg-emerald-500/5 border-x border-emerald-500/20 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    $0.00 (Zero Markup)
                  </td>
                  <td className="py-4 px-6 text-rose-400 flex items-center gap-1.5">
                    <X className="w-4 h-4 text-rose-400 shrink-0" /> Heavy Markup Tiers
                  </td>
                  <td className="py-4 px-6 text-rose-400 flex items-center gap-1.5">
                    <X className="w-4 h-4 text-rose-400 shrink-0" /> Monthly Active Contact Limits
                  </td>
                </tr>

                <tr>
                  <td className="py-4 px-6 font-medium text-slate-200">Autonomous Multi-Agent AI (4 Agents)</td>
                  <td className="py-4 px-6 font-bold text-emerald-400 bg-emerald-500/5 border-x border-emerald-500/20 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    Included (Lead Profiler + Arbiter)
                  </td>
                  <td className="py-4 px-6 text-slate-400">Basic Rule-based Bot</td>
                  <td className="py-4 px-6 text-slate-400">Basic AI Assist Add-on</td>
                </tr>

                <tr>
                  <td className="py-4 px-6 font-medium text-slate-200">BANT Lead Scoring & Intent Matrix</td>
                  <td className="py-4 px-6 font-bold text-emerald-400 bg-emerald-500/5 border-x border-emerald-500/20 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    Algorithmic 0–100 Score
                  </td>
                  <td className="py-4 px-6 text-slate-500">No</td>
                  <td className="py-4 px-6 text-slate-500">No</td>
                </tr>

                <tr>
                  <td className="py-4 px-6 font-medium text-slate-200">Native Kanban Deals Pipeline CRM</td>
                  <td className="py-4 px-6 font-bold text-emerald-400 bg-emerald-500/5 border-x border-emerald-500/20 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    Integrated Visual CRM
                  </td>
                  <td className="py-4 px-6 text-slate-400">Requires External CRM</td>
                  <td className="py-4 px-6 text-slate-400">Requires External CRM</td>
                </tr>

                <tr>
                  <td className="py-4 px-6 font-medium text-slate-200">RAG Document Ingestion (PDF, Docs)</td>
                  <td className="py-4 px-6 font-bold text-emerald-400 bg-emerald-500/5 border-x border-emerald-500/20 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    Native Indexing & Chunking
                  </td>
                  <td className="py-4 px-6 text-slate-500">No</td>
                  <td className="py-4 px-6 text-slate-400">Extra Paid Add-on</td>
                </tr>

                <tr>
                  <td className="py-4 px-6 font-medium text-slate-200">Multiple WhatsApp Numbers</td>
                  <td className="py-4 px-6 font-bold text-emerald-400 bg-emerald-500/5 border-x border-emerald-500/20 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    Multi-Session Included
                  </td>
                  <td className="py-4 px-6 text-slate-400">Extra Monthly Fee / Number</td>
                  <td className="py-4 px-6 text-slate-400">Tier-Restricted</td>
                </tr>

              </tbody>
            </table>
          </div>

        </div>
      </section>

      {/* 7. Target Verticals / Use Cases */}
      <section className="py-20 md:py-28 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              Tailored For High-Value Business Verticals
            </h2>
            <p className="mt-4 text-slate-400 text-base sm:text-lg">
              Proven workflows designed to accelerate sales cycles in industries where fast WhatsApp follow-up wins deals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                <Car className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Automotive Dealerships</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                Automate test-drive bookings, financing inquiries, inventory brochures, and post-service WhatsApp follow-ups with customized sales personas.
              </p>
              <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <span>3x Faster Lead Capture</span>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
              <div className="w-10 h-10 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center mb-4">
                <Home className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Real Estate Brokerages</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                Instantly qualify buyer budgets and timelines (BANT), send floor plans, and arrange site visit appointments while reps are in the field.
              </p>
              <div className="text-xs text-teal-400 font-semibold flex items-center gap-1">
                <span>40% More Site Visits</span>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">B2B Agencies & High-Ticket SaaS</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                Re-engage cold inbound inquiries with consultative follow-ups, handle pricing objections, and book qualified discovery calls 24/7.
              </p>
              <div className="text-xs text-cyan-400 font-semibold flex items-center gap-1">
                <span>50% Less Rep Overhead</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 8. Interactive FAQ */}
      <section id="faq" className="py-20 md:py-28 bg-[#090D15] border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="mt-4 text-slate-400 text-base">
              Everything you need to know about deployment, compliance, and multi-agent AI.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div 
                key={idx}
                className="rounded-xl bg-[#0C101A] border border-white/[0.08] overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                >
                  <span className="font-semibold text-white text-base">{faq.q}</span>
                  {openFaq === idx ? (
                    <ChevronUp className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                  )}
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-5 pt-1 text-sm text-slate-300 leading-relaxed border-t border-white/[0.04]">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 9. Bottom High-Converting CTA Banner */}
      <section className="py-20 relative overflow-hidden border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          
          <div className="p-10 sm:p-14 rounded-3xl bg-gradient-to-b from-emerald-950/40 via-slate-900/80 to-[#0C101A] border border-emerald-500/30 shadow-2xl relative overflow-hidden">
            
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              Ready to Automate Your WhatsApp Sales?
            </h2>
            <p className="mt-4 text-slate-300 text-base sm:text-lg max-w-2xl mx-auto">
              Deploy AutoZoneX Connect on your infrastructure today or speak with our sales architects for a tailored implementation demo.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-8 py-4 text-base font-bold rounded-xl bg-emerald-500 text-white shadow-xl shadow-emerald-500/30 hover:bg-emerald-400 active:scale-95 transition-all"
              >
                <Smartphone className="w-5 h-5" />
                <span>Contact on WhatsApp (+91 7348393452)</span>
              </a>

              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold rounded-xl bg-white/[0.08] text-white border border-white/15 hover:bg-white/[0.12] transition-all"
              >
                <span>Create Admin Account</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Self-Hosted Docker</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Multi-Tenant Architecture</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Dedicated Human Support</span>
            </div>

          </div>

        </div>
      </section>

      {/* 10. Footer */}
      <footer className="py-12 bg-[#05070B] border-t border-white/[0.08] text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 text-black flex items-center justify-center font-bold text-xs">
              {PLATFORM_INFO.shortName}
            </div>
            <span className="text-white font-semibold text-sm">{PLATFORM_INFO.name}</span>
            <span className="text-slate-500">© 2026. All rights reserved.</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#multi-agent" className="hover:text-white transition-colors">AI Agents</a>
            <a href="#comparison" className="hover:text-white transition-colors">Comparison</a>
            <a href="/login" className="hover:text-white transition-colors">Sign In</a>
            <a 
              href={WHATSAPP_URL} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
            >
              <span>+91 7348393452</span>
            </a>
          </div>
        </div>
      </footer>

      {/* 11. Sticky Floating WhatsApp Contact Widget (Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 group animate-bounce-subtle">
        
        {/* Floating Tooltip Bubble */}
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0D121F]/90 backdrop-blur-md border border-emerald-500/30 text-white text-xs font-semibold shadow-2xl hover:border-emerald-400 transition-all cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Chat with us on WhatsApp</span>
        </a>

        {/* Floating WhatsApp Action Button */}
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contact on WhatsApp"
          className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/40 hover:scale-110 active:scale-95 transition-transform"
        >
          {/* Pulsing ring */}
          <span className="absolute -inset-1 rounded-full bg-emerald-500/30 animate-pulse" />
          <Smartphone className="w-7 h-7 text-white relative z-10" />
        </a>

      </div>

    </div>
  );
}
