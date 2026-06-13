'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { RefreshCw, Trash2, Smartphone, CheckCircle2, AlertCircle, Play, Square, Key, X, QrCode } from 'lucide-react';
import { startWhatsAppSession, stopWhatsAppSession, getPairingCode, deleteWhatsAppSession, getWhatsAppSessionsData, createWhatsAppSession } from '../actions/whatsapp-actions';

export default function WhatsAppSessionsManager({ 
  initialSessions, 
  organizationId 
}: { 
  initialSessions: any[], 
  organizationId: string 
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [newSessionName, setNewSessionName] = useState('');
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [pairingPhone, setPairingPhone] = useState<Record<string, string>>({});
  const [pairingCodes, setPairingCodes] = useState<Record<string, string>>({});
  const [connectionMethod, setConnectionMethod] = useState<Record<string, 'qr' | 'pairing'>>({});
  const [selectedSessionDetails, setSelectedSessionDetails] = useState<any | null>(null);
  const [screenshotCacheKey, setScreenshotCacheKey] = useState<number>(Date.now());

  const fetchSessions = async () => {
    setLoading(prev => ({ ...prev, global: true }));
    try {
      const data = await getWhatsAppSessionsData();
      if (data.success && data.sessions) {
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    } finally {
      setLoading(prev => ({ ...prev, global: false }));
    }
  };

  // Only refresh once on mount, then manual
  useEffect(() => {
    fetchSessions();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(prev => ({ ...prev, create: true }));
    try {
      const data = await createWhatsAppSession(newSessionName);
      if (data.success) {
        setNewSessionName('');
        // Auto-refresh when added new one
        await fetchSessions();
      } else {
        alert(data.error);
      }
    } finally {
      setLoading(prev => ({ ...prev, create: false }));
    }
  };

  const handleStart = async (sessionId: string) => {
    setLoading(prev => ({ ...prev, [sessionId]: true }));
    try {
      await startWhatsAppSession(sessionId);
      // Default to QR mode when started
      setConnectionMethod(prev => ({ ...prev, [sessionId]: 'qr' }));
      await fetchSessions();
    } finally {
      setLoading(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  const handleStop = async (sessionId: string) => {
    setLoading(prev => ({ ...prev, [sessionId]: true }));
    try {
      await stopWhatsAppSession(sessionId);
      await fetchSessions();
    } finally {
      setLoading(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  const handleRequestPairing = async (sessionId: string) => {
    const phone = pairingPhone[sessionId];
    if (!phone) {
        alert('Please enter a phone number');
        return;
    }
    
    setLoading(prev => ({ ...prev, [`pair-${sessionId}`]: true }));
    try {
      const result = await getPairingCode(sessionId, phone);
      if (result.success) {
        setPairingCodes(prev => ({ ...prev, [sessionId]: result.code }));
      } else {
        alert(result.error);
      }
    } finally {
      setLoading(prev => ({ ...prev, [`pair-${sessionId}`]: false }));
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Permanently delete this session profile?')) return;
    await deleteWhatsAppSession(sessionId);
    await fetchSessions();
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchSessions} 
          disabled={loading.global}
          className="bg-white"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading.global ? 'animate-spin' : ''}`} />
          Refresh All Sessions
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Create New Session Card */}
        <Card className="border-dashed border-2 flex flex-col justify-center bg-gray-50/30">
          <CardHeader>
            <CardTitle className="text-xl">Register Account</CardTitle>
            <CardDescription>Create a profile for a new WhatsApp number</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <Input 
                value={newSessionName} 
                onChange={(e) => setNewSessionName(e.target.value)}
                placeholder="e.g. Sales Account" 
                required 
              />
              <Button type="submit" className="w-full" disabled={loading.create}>
                {loading.create ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />}
                Register Profile
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Existing Sessions */}
        {sessions.map((session) => {
          const isActive = session.state !== 'DISCONNECTED';
          const isReady = session.ready;
          const method = connectionMethod[session.sessionId] || 'qr';

          return (
            <Card key={session.id} className={`${isReady ? 'border-green-200 bg-green-50/20' : ''} flex flex-col shadow-sm transition-all`}>
              <CardHeader className="pb-3 border-b bg-gray-50/30">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg font-bold">{session.sessionId}</CardTitle>
                    <div className="mt-1">
                      {isReady ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                        </span>
                      ) : isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> {session.state}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          <Square className="w-3 h-3 mr-1" /> Offline
                        </span>
                      )}
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-gray-400 hover:text-red-600 transition-colors"
                    onClick={() => handleDelete(session.sessionId)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="flex-1 py-4">
                {isActive ? (
                  <div className="space-y-4">
                    {!isReady && (
                      <div className="space-y-4">
                        {/* Method Selector */}
                        <div className="flex p-1 bg-gray-100 rounded-lg">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={`flex-1 text-xs h-7 shadow-none ${method === 'qr' ? 'bg-white shadow-sm font-semibold' : ''}`}
                            onClick={() => setConnectionMethod(prev => ({ ...prev, [session.sessionId]: 'qr' }))}
                          >
                            <QrCode className="w-3 h-3 mr-1" /> QR Code
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={`flex-1 text-xs h-7 shadow-none ${method === 'pairing' ? 'bg-white shadow-sm font-semibold' : ''}`}
                            onClick={() => setConnectionMethod(prev => ({ ...prev, [session.sessionId]: 'pairing' }))}
                          >
                            <Key className="w-3 h-3 mr-1" /> Pairing Code
                          </Button>
                        </div>
 
                        {method === 'qr' ? (
                          <div className="text-center">
                            <div className="p-3 bg-white rounded-lg border shadow-inner">
                              <img 
                                src={`/api/whatsapp/qr/${session.sessionId}?cache=${Date.now()}`} 
                                alt="QR Code" 
                                className="w-full aspect-square object-contain"
                              />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2">Scan with WhatsApp Linked Devices</p>
                          </div>
                        ) : (
                          <div className="space-y-4 py-2 text-center">
                            {pairingCodes[session.sessionId] ? (
                              <div className="bg-blue-50 border border-blue-100 rounded-lg p-6">
                                <p className="text-3xl font-mono font-bold tracking-[0.2em] text-blue-700">
                                  {pairingCodes[session.sessionId]}
                                </p>
                                <p className="text-[10px] text-blue-600 mt-3 font-bold uppercase">Enter this on your phone</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <p className="text-xs text-gray-500">Enter phone number with country code</p>
                                <div className="flex space-x-2">
                                  <Input 
                                    placeholder="e.g. 917078778869" 
                                    className="text-sm"
                                    value={pairingPhone[session.sessionId] || ''}
                                    onChange={(e) => setPairingPhone(prev => ({ ...prev, [session.sessionId]: e.target.value }))}
                                  />
                                  <Button 
                                    size="icon" 
                                    className="bg-blue-600 hover:bg-blue-700 shrink-0"
                                    disabled={loading[`pair-${session.sessionId}`]}
                                    onClick={() => handleRequestPairing(session.sessionId)}
                                  >
                                    {loading[`pair-${session.sessionId}`] ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {isReady && (
                      <div className="py-12 flex flex-col items-center justify-center text-center">
                        <div className="bg-green-100 p-4 rounded-full mb-4">
                          <Smartphone className="w-10 h-10 text-green-600" />
                        </div>
                        <h4 className="font-bold text-gray-900">Account Linked</h4>
                        <p className="text-xs text-gray-500 mt-1 px-4 text-center">This device is now ready for messaging automation</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-16 flex flex-col items-center justify-center text-gray-300 bg-gray-50/50 rounded-lg border-2 border-dashed">
                    <div className="p-3 bg-white rounded-full shadow-sm mb-3">
                      <Play className="w-6 h-6 text-gray-200 fill-current ml-0.5" />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Ready to Start</p>
                  </div>
                )}
              </CardContent>

              <CardFooter className="pt-3 border-t bg-gray-50/30 gap-3">
                {!isActive ? (
                  <div className="w-full flex space-x-2">
                    <Button 
                      className="flex-1 bg-blue-600 hover:bg-blue-700 shadow-sm" 
                      disabled={loading[session.sessionId]}
                      onClick={() => handleStart(session.sessionId)}
                    >
                      {loading[session.sessionId] ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4 fill-current" />}
                      Start Engine
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedSessionDetails(session);
                        setScreenshotCacheKey(Date.now());
                      }}
                    >
                      Details
                    </Button>
                  </div>
                ) : (
                  <div className="w-full flex space-x-2">
                    <Button 
                        variant="outline" 
                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 shadow-none" 
                        disabled={loading[session.sessionId]}
                        onClick={() => handleStop(session.sessionId)}
                    >
                        <Square className="mr-2 h-4 w-4 fill-current" />
                        Stop Engine
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedSessionDetails(session);
                        setScreenshotCacheKey(Date.now());
                      }}
                    >
                      Details
                    </Button>
                    <Button 
                        variant="outline" 
                        size="icon"
                        className="shrink-0"
                        onClick={fetchSessions}
                        disabled={loading[session.sessionId]}
                    >
                        <RefreshCw className={`w-4 h-4 ${loading[session.sessionId] ? 'animate-spin' : ''}`} />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-lg shadow-2xl bg-white border border-gray-200">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold">Session Details</CardTitle>
                <CardDescription>Status and diagnostic information for {selectedSessionDetails.sessionId}</CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSelectedSessionDetails(null)}
                className="h-8 w-8 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="py-6 space-y-6">
              {/* Properties Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="block text-xs font-semibold text-gray-400 uppercase">Session Name / ID</span>
                  <span className="font-mono">{selectedSessionDetails.sessionId}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-gray-400 uppercase">Connection Status</span>
                  <span>
                    {selectedSessionDetails.ready ? (
                      <span className="inline-flex items-center text-green-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Connected
                      </span>
                    ) : selectedSessionDetails.state !== 'DISCONNECTED' ? (
                      <span className="inline-flex items-center text-amber-700 font-medium">
                        <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> {selectedSessionDetails.state}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-gray-600 font-medium">
                        <Square className="w-3.5 h-3.5 mr-1" /> Offline
                      </span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-gray-400 uppercase">Created At</span>
                  <span>{new Date(selectedSessionDetails.createdAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-gray-400 uppercase">Last Updated</span>
                  <span>{new Date(selectedSessionDetails.updatedAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Puppeteer Screenshot Diagnostic if running */}
              {selectedSessionDetails.state !== 'DISCONNECTED' && (
                <div className="space-y-2 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Puppeteer Browser Page</span>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setScreenshotCacheKey(Date.now())}
                      className="text-xs h-7"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
                    </Button>
                  </div>
                  <div className="border rounded-lg bg-gray-900 overflow-hidden flex items-center justify-center p-2 relative min-h-[150px]">
                    <img 
                      src={`/api/whatsapp/screenshot/${selectedSessionDetails.sessionId}?cache=${screenshotCacheKey}`} 
                      alt="WhatsApp Web Browser View" 
                      className="max-h-[250px] w-auto object-contain rounded"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                        const parent = (e.target as HTMLElement).parentElement;
                        if (parent) {
                          const errText = document.createElement('div');
                          errText.className = 'text-xs text-gray-400 p-4 text-center';
                          errText.innerText = 'Failed to load browser page view. Session may be starting up...';
                          parent.appendChild(errText);
                        }
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 text-center">
                    Use this window to diagnose connection states or see browser errors.
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="pt-3 border-t bg-gray-50/50 flex justify-end">
              <Button onClick={() => setSelectedSessionDetails(null)}>Close</Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
