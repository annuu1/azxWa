'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { 
  RefreshCw, Trash2, Smartphone, CheckCircle2, Play, Square, Key, X, QrCode, 
  Copy, Check, AlertCircle, Info, ShieldCheck 
} from 'lucide-react';
import { 
  startWhatsAppSession, stopWhatsAppSession, getPairingCode, deleteWhatsAppSession, 
  getWhatsAppSessionsData, createWhatsAppSession 
} from '../actions/whatsapp-actions';

interface SessionsManagerProps {
  initialSessions: any[];
  organizationId: string;
  activeEngine?: string;
}

export default function WhatsAppSessionsManager({ 
  initialSessions, 
  organizationId,
  activeEngine = 'openwa'
}: SessionsManagerProps) {
  const [sessions, setSessions] = useState(initialSessions);
  const [newSessionName, setNewSessionName] = useState('');
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [pairingPhone, setPairingPhone] = useState<Record<string, string>>({});
  const [pairingCodes, setPairingCodes] = useState<Record<string, string>>({});
  const [connectionMethod, setConnectionMethod] = useState<Record<string, 'qr' | 'pairing'>>({});
  const [selectedSessionDetails, setSelectedSessionDetails] = useState<any | null>(null);
  const [qrCacheKeys, setQrCacheKeys] = useState<Record<string, number>>({});
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchSessions = useCallback(async (silent = false) => {
    if (!silent) setLoading(prev => ({ ...prev, global: true }));
    try {
      const data = await getWhatsAppSessionsData();
      if (data.success && data.sessions) {
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    } finally {
      if (!silent) setLoading(prev => ({ ...prev, global: false }));
    }
  }, []);

  // Auto-polling when any session is connecting or scanning QR code
  useEffect(() => {
    const hasPendingSession = sessions.some(
      s => s.state !== 'DISCONNECTED' && !s.ready
    );

    if (!hasPendingSession) return;

    const interval = setInterval(() => {
      fetchSessions(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [sessions, fetchSessions]);

  const refreshQrCode = (sessionId: string) => {
    setQrCacheKeys(prev => ({ ...prev, [sessionId]: Date.now() }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = newSessionName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!cleanName) {
      setErrorMsg('Please enter a valid session name');
      return;
    }

    setLoading(prev => ({ ...prev, create: true }));
    try {
      const data = await createWhatsAppSession(cleanName);
      if (data.success) {
        setNewSessionName('');
        await fetchSessions();
      } else {
        setErrorMsg(data.error || 'Failed to create session');
      }
    } finally {
      setLoading(prev => ({ ...prev, create: false }));
    }
  };

  const handleStart = async (sessionId: string) => {
    setErrorMsg(null);
    setLoading(prev => ({ ...prev, [sessionId]: true }));
    try {
      const res = await startWhatsAppSession(sessionId);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setConnectionMethod(prev => ({ ...prev, [sessionId]: 'qr' }));
        refreshQrCode(sessionId);
        await fetchSessions();
      }
    } finally {
      setLoading(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  const handleStop = async (sessionId: string) => {
    setErrorMsg(null);
    setLoading(prev => ({ ...prev, [sessionId]: true }));
    try {
      await stopWhatsAppSession(sessionId);
      await fetchSessions();
    } finally {
      setLoading(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  const handleRequestPairing = async (sessionId: string) => {
    setErrorMsg(null);
    const rawPhone = pairingPhone[sessionId] || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');

    if (!cleanPhone || cleanPhone.length < 8) {
      setErrorMsg('Please enter a valid phone number with country code (e.g. 14155552671)');
      return;
    }

    setLoading(prev => ({ ...prev, [`pair-${sessionId}`]: true }));
    try {
      const result = await getPairingCode(sessionId, cleanPhone);
      if (result.success && result.code) {
        setPairingCodes(prev => ({ ...prev, [sessionId]: result.code }));
      } else {
        setErrorMsg(result.error || 'Failed to generate pairing code');
      }
    } finally {
      setLoading(prev => ({ ...prev, [`pair-${sessionId}`]: false }));
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm(`Are you sure you want to delete session profile "${sessionId}"?`)) return;
    setErrorMsg(null);
    await deleteWhatsAppSession(sessionId);
    await fetchSessions();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Info className="w-4 h-4 text-blue-500 shrink-0" />
          <span>
            Active sessions automatically auto-reply and log WhatsApp messages directly in CRM.
          </span>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => fetchSessions(false)} 
          disabled={loading.global}
          className="w-full sm:w-auto bg-white border-gray-300 hover:bg-gray-50 text-gray-700 font-medium"
        >
          <RefreshCw className={`w-4 h-4 mr-2 text-blue-600 ${loading.global ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
      </div>

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between text-sm animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Register New Session Card */}
        <Card className="border-2 border-dashed border-gray-300 bg-gray-50/50 hover:bg-gray-50 transition-colors flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-2">
              <Smartphone className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg font-bold text-gray-900">Register Account</CardTitle>
            <CardDescription className="text-xs text-gray-500">
              Create a new session profile to link a WhatsApp phone number.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Session Name / ID
                </label>
                <Input 
                  value={newSessionName} 
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="e.g. sales-bot-1" 
                  required 
                  className="bg-white text-sm"
                />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5" disabled={loading.create}>
                {loading.create ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Smartphone className="mr-2 h-4 w-4" />
                )}
                Register Profile
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Existing Session Cards */}
        {sessions.map((session) => {
          const isActive = session.state !== 'DISCONNECTED';
          const isReady = session.ready;
          const method = connectionMethod[session.sessionId] || 'qr';
          const cacheKey = qrCacheKeys[session.sessionId] || 1;

          return (
            <Card 
              key={session.id} 
              className={`flex flex-col shadow-sm transition-all duration-200 ${
                isReady ? 'border-emerald-300 bg-emerald-50/10' : isActive ? 'border-amber-300 bg-amber-50/10' : 'border-gray-200'
              }`}
            >
              {/* Card Header */}
              <CardHeader className="pb-3 border-b border-gray-100 bg-gray-50/50 flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold text-gray-900 truncate max-w-[180px]">
                    {session.sessionId}
                  </CardTitle>
                  <div className="mt-1 flex items-center space-x-1.5">
                    {isReady ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Connected
                      </span>
                    ) : isActive ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin text-amber-600" /> {session.state}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                        <Square className="w-3 h-3 mr-1 text-gray-400" /> Offline
                      </span>
                    )}
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  onClick={() => handleDelete(session.sessionId)}
                  title="Delete Session Profile"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardHeader>

              {/* Card Body */}
              <CardContent className="flex-1 py-4 sm:py-5 flex flex-col justify-center">
                {isActive ? (
                  <div className="space-y-4">
                    {!isReady && (
                      <div className="space-y-4">
                        {/* Connection Method Selector Tabs */}
                        <div className="flex p-1 bg-gray-100 rounded-lg">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={`flex-1 text-xs h-8 shadow-none transition-all ${
                              method === 'qr' ? 'bg-white shadow-sm font-bold text-blue-700' : 'text-gray-600'
                            }`}
                            onClick={() => setConnectionMethod(prev => ({ ...prev, [session.sessionId]: 'qr' }))}
                          >
                            <QrCode className="w-3.5 h-3.5 mr-1.5" /> QR Code
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={`flex-1 text-xs h-8 shadow-none transition-all ${
                              method === 'pairing' ? 'bg-white shadow-sm font-bold text-blue-700' : 'text-gray-600'
                            }`}
                            onClick={() => setConnectionMethod(prev => ({ ...prev, [session.sessionId]: 'pairing' }))}
                          >
                            <Key className="w-3.5 h-3.5 mr-1.5" /> Pairing Code
                          </Button>
                        </div>

                        {/* QR Code Tab */}
                        {method === 'qr' ? (
                          <div className="text-center space-y-2">
                            <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-inner relative max-w-[220px] mx-auto">
                              <img 
                                src={`/api/whatsapp/qr/${session.sessionId}?cache=${cacheKey}`} 
                                alt="WhatsApp QR Code" 
                                className="w-full aspect-square object-contain rounded"
                                onError={(e) => {
                                  // Fallback indicator if QR not ready yet
                                  (e.target as HTMLElement).style.display = 'none';
                                  const parent = (e.target as HTMLElement).parentElement;
                                  if (parent && !parent.querySelector('.qr-loading')) {
                                    const loader = document.createElement('div');
                                    loader.className = 'qr-loading py-12 flex flex-col items-center justify-center text-xs text-gray-500';
                                    loader.innerHTML = '<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>Initializing QR Code...';
                                    parent.appendChild(loader);
                                  }
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-gray-500 px-2">
                              <span>Scan with WhatsApp &gt; Linked Devices</span>
                              <button 
                                onClick={() => refreshQrCode(session.sessionId)}
                                className="text-blue-600 hover:underline font-semibold flex items-center"
                              >
                                <RefreshCw className="w-3 h-3 mr-1" /> Refresh QR
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Pairing Code Tab */
                          <div className="space-y-3 py-1">
                            {pairingCodes[session.sessionId] ? (
                              <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 text-center space-y-2">
                                <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-widest block">
                                  Your 8-Digit Pairing Code
                                </span>
                                <div className="flex items-center justify-center space-x-2">
                                  <p className="text-2xl sm:text-3xl font-mono font-bold tracking-[0.25em] text-blue-800">
                                    {pairingCodes[session.sessionId]}
                                  </p>
                                  <Button 
                                    size="icon" 
                                    variant="ghost"
                                    className="h-8 w-8 text-blue-600 hover:bg-blue-100"
                                    onClick={() => copyToClipboard(pairingCodes[session.sessionId])}
                                  >
                                    {copiedCode === pairingCodes[session.sessionId] ? (
                                      <Check className="w-4 h-4 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </Button>
                                </div>
                                <p className="text-[11px] text-blue-700 font-medium">
                                  Open WhatsApp &gt; Linked Devices &gt; Link with phone number
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <p className="text-xs text-gray-600">
                                  Enter phone number with country code (e.g. 14155552671):
                                </p>
                                <div className="flex space-x-2">
                                  <Input 
                                    placeholder="Phone number" 
                                    className="text-sm bg-white"
                                    value={pairingPhone[session.sessionId] || ''}
                                    onChange={(e) => setPairingPhone(prev => ({ ...prev, [session.sessionId]: e.target.value }))}
                                  />
                                  <Button 
                                    className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                                    disabled={loading[`pair-${session.sessionId}`]}
                                    onClick={() => handleRequestPairing(session.sessionId)}
                                  >
                                    {loading[`pair-${session.sessionId}`] ? (
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Key className="w-4 h-4 mr-1" />
                                    )}
                                    Get Code
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {isReady && (
                      <div className="py-8 flex flex-col items-center justify-center text-center">
                        <div className="bg-emerald-100 p-3.5 rounded-full mb-3 text-emerald-600">
                          <ShieldCheck className="w-8 h-8" />
                        </div>
                        <h4 className="font-bold text-gray-900 text-base">WhatsApp Linked & Ready</h4>
                        <p className="text-xs text-gray-500 mt-1 max-w-[220px]">
                          This session is active. Ready to send messages and run AI workflows.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                    <div className="p-3 bg-white rounded-full shadow-xs mb-2 text-gray-300">
                      <Play className="w-6 h-6 fill-current ml-0.5" />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Session Stopped</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Click Start Engine to initialize connection</p>
                  </div>
                )}
              </CardContent>

              {/* Card Footer Actions */}
              <CardFooter className="pt-3 border-t border-gray-100 bg-gray-50/50 gap-2">
                {!isActive ? (
                  <div className="w-full flex space-x-2">
                    <Button 
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 shadow-xs" 
                      disabled={loading[session.sessionId]}
                      onClick={() => handleStart(session.sessionId)}
                    >
                      {loading[session.sessionId] ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="mr-2 h-4 w-4 fill-current" />
                      )}
                      Start Engine
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedSessionDetails(session)}
                      className="border-gray-300 text-gray-700"
                    >
                      Details
                    </Button>
                  </div>
                ) : (
                  <div className="w-full flex space-x-2">
                    <Button 
                      variant="outline" 
                      className="flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 font-medium py-2" 
                      disabled={loading[session.sessionId]}
                      onClick={() => handleStop(session.sessionId)}
                    >
                      {loading[session.sessionId] ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Square className="mr-2 h-4 w-4 fill-current" />
                      )}
                      Stop Engine
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedSessionDetails(session)}
                      className="border-gray-300 text-gray-700"
                    >
                      Details
                    </Button>
                  </div>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Session Details Modal */}
      {selectedSessionDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <Card className="w-full max-w-lg shadow-2xl bg-white border border-gray-200 max-h-[90vh] overflow-y-auto">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">Session Diagnostics</CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Profile metadata and engine telemetry for {selectedSessionDetails.sessionId}
                </CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSelectedSessionDetails(null)}
                className="h-8 w-8 text-gray-400 hover:text-gray-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            <CardContent className="py-5 space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Session Identifier
                  </span>
                  <span className="font-mono text-gray-900 font-semibold">{selectedSessionDetails.sessionId}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Engine Provider
                  </span>
                  <span className="font-semibold text-emerald-700 uppercase">{activeEngine}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Connection State
                  </span>
                  <span>
                    {selectedSessionDetails.ready ? (
                      <span className="inline-flex items-center text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Connected
                      </span>
                    ) : (
                      <span className="font-semibold text-gray-700">
                        {selectedSessionDetails.state}
                      </span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Organization ID
                  </span>
                  <span className="font-mono text-xs text-gray-600 truncate block">
                    {organizationId}
                  </span>
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-3 border-t border-gray-100 bg-gray-50 flex justify-end">
              <Button onClick={() => setSelectedSessionDetails(null)} className="bg-gray-900 hover:bg-black text-white">
                Close
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
