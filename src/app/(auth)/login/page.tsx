'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  Loader2, 
  ShieldCheck, 
  Smartphone,
  Sparkles
} from 'lucide-react';
import { login } from '@/features/auth/actions/auth-actions';
import { PLATFORM_INFO } from '@/shared/config/platform';

const WHATSAPP_PHONE = '917348393452';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}?text=Hi%20AutoZoneX%20team,%20I%20need%20assistance%20logging%20into%20my%20account.`;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await login(formData);
      if (res?.error) {
        setError(res.error);
        setIsLoading(false);
      }
    } catch (err: any) {
      // Next.js redirect throws a NEXT_REDIRECT digest error when redirecting
      if (err?.message?.includes('NEXT_REDIRECT') || err?.digest?.includes('NEXT_REDIRECT')) {
        return; // Redirecting successfully
      }
      setError(err?.message || 'Failed to sign in. Please check your credentials.');
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white relative overflow-hidden font-sans">
      
      {/* Background Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-emerald-600/15 via-indigo-600/10 to-transparent blur-[140px] rounded-full" />
        <div className="absolute bottom-[5%] -left-[10%] w-[500px] h-[500px] bg-emerald-600/10 blur-[130px] rounded-full" />
      </div>

      {/* Top Header Bar */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#07090E] rounded-[10px] flex items-center justify-center">
              <span className="font-black text-transparent bg-clip-text bg-gradient-to-tr from-emerald-400 to-teal-200 text-base">
                {PLATFORM_INFO.shortName || 'A'}
              </span>
            </div>
          </div>
          <span className="font-bold text-white text-base tracking-tight">{PLATFORM_INFO.name}</span>
        </Link>

        <Link
          href="/"
          className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          &larr; Back to Home
        </Link>
      </div>

      {/* Center Auth Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6">
        <div className="max-w-md w-full">
          
          {/* Card Frame with subtle glow border */}
          <div className="rounded-2xl p-1 bg-gradient-to-b from-white/15 via-white/5 to-transparent shadow-2xl">
            <div className="rounded-[15px] bg-[#0C101A]/95 border border-white/10 p-8 sm:p-10 backdrop-blur-xl">
              
              {/* Card Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 mb-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Secure Access</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Welcome Back
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-2">
                  Sign in to your AutoZoneX Connect workspace
                </p>
              </div>

              {/* Error Banner */}
              {error && (
                <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2.5 animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Email Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="email">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      placeholder="admin@yourcompany.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#141A28] border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="password">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-[#141A28] border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

              </form>

              {/* Bottom Switcher */}
              <div className="mt-6 pt-6 border-t border-white/[0.08] text-center">
                <p className="text-xs text-slate-400">
                  Don&apos;t have an account?{' '}
                  <Link href="/register" className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
                    Create a workspace
                  </Link>
                </p>
              </div>

            </div>
          </div>

          {/* Privacy & Trust Badge */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>100% Self-Hosted &bull; Multi-Tenant Data Isolation</span>
          </div>

        </div>
      </div>

      {/* Footer / WhatsApp Support Touchpoint */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between text-xs text-slate-500 border-t border-white/[0.06]">
        <span>&copy; 2026 {PLATFORM_INFO.name}. All rights reserved.</span>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1.5 transition-colors"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Need help? Chat on WhatsApp</span>
        </a>
      </footer>

    </div>
  );
}
