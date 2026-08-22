'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { 
  RefreshCw, Trash2, Smartphone, CheckCircle2, Play, Square, Key, X, QrCode, 
  Copy, Check, AlertCircle, Info, ShieldCheck, Search, Filter, Eye, Unlink, Skull, 
  Plus, PhoneCall, AlertTriangle, User, Clock, ShieldAlert
} from 'lucide-react';
import { 
  startWhatsAppSession, stopWhatsAppSession, logoutWhatsAppSession, forceKillWhatsAppSession,
  getPairingCode, deleteWhatsAppSession, getWhatsAppSessionsData, createWhatsAppSession,
  getWhatsAppSessionConfig, updateWhatsAppSessionConfig
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
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  
  const [qrModalSession, setQrModalSession] = useState<any | null>(null);
  const [pairingMode, setPairingMode] = useState(false);
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [qrCacheKey, setQrCacheKey] = useState<number>(Date.now());

  const [selectedSessionDetails, setSelectedSessionDetails] = useState<any | null>(null);
  const [sessionConfig, setSessionConfig] = useState<any | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [killConfirmId, setKillConfirmId] = useState<string | null>(null);
  const [unlinkConfirmId, setUnlinkConfirmId] = useState<string | null>(null);

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
      s => (s.state !== 'DISCONNECTED' && !s.ready) || ['initializing', 'qr_ready', 'authenticating'].includes(s.status)
    );

    if (!hasPendingSession) return;

    const interval = setInterval(() => {
      fetchSessions(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [sessions, fetchSessions]);

  // Load Session Config when details modal opens
  useEffect(() => {
    if (!selectedSessionDetails) {
      setSessionConfig(null);
      return;
    }

    let isMounted = true;
    getWhatsAppSessionConfig(selectedSessionDetails.sessionId).then(res => {
      if (isMounted && res.success && res.config) {
        setSessionConfig(res.config);
      }
    });

    return () => { isMounted = false; };
  }, [selectedSessionDetails]);

  // Filter sessions based on search query and status filter
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      const nameMatch = (session.sessionId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (session.phone || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (session.pushName || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!nameMatch) return false;

      if (statusFilter === 'all') return true;
      if (statusFilter === 'active') return session.ready || session.status === 'ready';
      if (statusFilter === 'inactive') return !session.ready && session.state === 'DISCONNECTED';
      if (statusFilter === 'connecting') return session.state !== 'DISCONNECTED' && !session.ready;

      return true;
    });
  }, [sessions, searchQuery, statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = newSessionName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!cleanName || cleanName.length < 3) {
      setErrorMsg('Session name must be at least 3 characters (alphanumeric and hyphens)');
      return;
    }

    setLoading(prev => ({ ...prev, create: true }));
    try {
      const data = await createWhatsAppSession(cleanName);
      if (data.success) {
        setNewSessionName('');
        setShowCreateModal(false);
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
        const sessionObj = sessions.find(s => s.sessionId === sessionId);
        setQrModalSession(sessionObj || { sessionId });
        setPairingMode(false);
        setQrCacheKey(Date.now());
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

  const handleUnlink = async (sessionId: string) => {
    setErrorMsg(null);
    setLoading(prev => ({ ...prev, [`unlink-${sessionId}`]: true }));
    try {
      await logoutWhatsAppSession(sessionId);
      setUnlinkConfirmId(null);
      await fetchSessions();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to unlink device');
    } finally {
      setLoading(prev => ({ ...prev, [`unlink-${sessionId}`]: false }));
    }
  };

  const handleForceKill = async (sessionId: string) => {
    setErrorMsg(null);
    setLoading(prev => ({ ...prev, [`kill-${sessionId}`]: true }));
    try {
      await forceKillWhatsAppSession(sessionId);
      setKillConfirmId(null);
      await fetchSessions();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to force-kill session process');
    } finally {
      setLoading(prev => ({ ...prev, [`kill-${sessionId}`]: false }));
    }
  };

  const handleDelete = async (sessionId: string) => {
    setErrorMsg(null);
    setLoading(prev => ({ ...prev, [`delete-${sessionId}`]: true }));
    try {
      await deleteWhatsAppSession(sessionId);
      setDeleteConfirmId(null);
      await fetchSessions();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete session profile');
    } finally {
      setLoading(prev => ({ ...prev, [`delete-${sessionId}`]: false }));
    }
  };

  const handleRequestPairing = async (sessionId: string) => {
    setErrorMsg(null);
    const cleanPhone = pairingPhone.replace(/\D/g, '');

    if (!cleanPhone || cleanPhone.length < 8) {
      setErrorMsg('Please enter a valid phone number with country code (e.g. 14155552671)');
      return;
    }

    setLoading(prev => ({ ...prev, [`pair-${sessionId}`]: true }));
    try {
      const result = await getPairingCode(sessionId, cleanPhone);
      if (result.success && result.code) {
        setPairingCode(result.code);
      } else {
        setErrorMsg(result.error || 'Failed to generate pairing code');
      }
    } finally {
      setLoading(prev => ({ ...prev, [`pair-${sessionId}`]: false }));
    }
  };

  const handleAutoRejectToggle = async (sessionId: string, nextValue: boolean) => {
    if (!sessionConfig) return;
    setSavingConfig(true);
    const prevConfig = sessionConfig;
    setSessionConfig({ ...sessionConfig, autoRejectCalls: nextValue });

    try {
      const res = await updateWhatsAppSessionConfig(sessionId, { autoRejectCalls: nextValue });
      if (!res.success) {
        setSessionConfig(prevConfig);
        setErrorMsg(res.error || 'Failed to update call rejection config');
      }
    } catch (err: any) {
      setSessionConfig(prevConfig);
      setErrorMsg(err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const formatLastActive = (dateStr?: string | null) => {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Search & Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input 
              placeholder="Search by session name, phone, or ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm bg-gray-50/50 border-gray-200 focus:bg-white"
            />
          </div>

          {/* Filter Dropdown */}
          <div className="flex items-center space-x-2 shrink-0">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs sm:text-sm font-medium bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Sessions</option>
              <option value="active">Connected / Ready</option>
              <option value="connecting">Connecting / QR</option>
              <option value="inactive">Disconnected / Offline</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <Button 
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs text-xs sm:text-sm py-2 px-3 sm:px-4"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Session
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchSessions(false)} 
            disabled={loading.global}
            className="bg-white border-gray-200 hover:bg-gray-50 text-gray-700 font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${loading.global ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Global Error Alert Banner */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between text-sm animate-in fade-in shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Register New Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <Card className="w-full max-w-md shadow-2xl bg-white border border-gray-200">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-gray-900">Register WhatsApp Session</CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Create a profile name for your WhatsApp number.
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowCreateModal(false)} className="h-8 w-8 text-gray-400">
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <form onSubmit={handleCreate}>
              <CardContent className="py-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Session Identifier / Name
                  </label>
                  <Input 
                    value={newSessionName} 
                    onChange={(e) => setNewSessionName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    placeholder="e.g. sales-account-1" 
                    required 
                    className="bg-white text-sm"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Use lowercase letters, numbers, and hyphens only (e.g. <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">support-bot</code>).
                  </p>
                </div>
              </CardContent>
              <CardFooter className="pt-3 border-t bg-gray-50 flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-medium" disabled={loading.create}>
                  {loading.create ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Create Session
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredSessions.length === 0 ? (
          <div className="col-span-full py-16 flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-gray-200 p-8 shadow-xs">
            <div className="bg-gray-100 p-4 rounded-full text-gray-400 mb-3">
              <QrCode className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No WhatsApp Sessions Found</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm">
              Register a new session profile to connect a WhatsApp phone number.
            </p>
            <Button onClick={() => setShowCreateModal(true)} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> Register New Session
            </Button>
          </div>
        ) : (
          filteredSessions.map((session) => {
            const isActive = session.state !== 'DISCONNECTED';
            const isReady = session.ready || session.status === 'ready';

            return (
              <Card 
                key={session.id} 
                className={`flex flex-col shadow-xs transition-all duration-200 ${
                  isReady ? 'border-emerald-200 bg-emerald-50/10' : isActive ? 'border-amber-200 bg-amber-50/10' : 'border-gray-200'
                }`}
              >
                {/* Card Header */}
                <CardHeader className="pb-3 border-b border-gray-100 bg-gray-50/50 flex flex-row items-center justify-between space-y-0">
                  <div className="flex-1 pr-2 overflow-hidden">
                    <CardTitle className="text-base font-bold text-gray-900 truncate" title={session.sessionId}>
                      {session.sessionId}
                    </CardTitle>
                    <div className="mt-1 flex items-center space-x-1.5 flex-wrap gap-y-1">
                      {isReady ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Connected
                        </span>
                      ) : isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin text-amber-600" /> {session.state || session.status}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                          <Square className="w-3 h-3 mr-1 text-gray-400" /> Offline
                        </span>
                      )}

                      {/* Restriction Badge if any */}
                      {session.restriction && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200" title={session.restriction.kind}>
                          <ShieldAlert className="w-2.5 h-2.5 mr-1" /> {session.restriction.kind}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                      onClick={() => setSelectedSessionDetails(session)}
                      title="View Details & Config"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => setDeleteConfirmId(session.sessionId)}
                      title="Delete Session Profile"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>

                {/* Card Body */}
                <CardContent className="flex-1 py-4 space-y-3">
                  {/* Info Rows */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-gray-100">
                      <span className="text-gray-400 flex items-center">
                        <User className="w-3.5 h-3.5 mr-1 text-gray-400" /> Phone Number
                      </span>
                      <span className="font-semibold text-gray-800">
                        {session.phone ? `+${session.phone}` : (session.pushName || '—')}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-gray-100">
                      <span className="text-gray-400 flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1 text-gray-400" /> Last Active
                      </span>
                      <span className="font-medium text-gray-700">
                        {formatLastActive(session.lastActive)}
                      </span>
                    </div>
                  </div>

                  {/* Engine Last Error Alert if failed */}
                  {session.lastError && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-800 flex items-start space-x-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span className="line-clamp-2" title={session.lastError}>
                        {session.lastError}
                      </span>
                    </div>
                  )}

                  {/* QR Link Quick Trigger if Connecting */}
                  {!isReady && isActive && (
                    <div className="pt-2 text-center">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setQrModalSession(session);
                          setPairingMode(false);
                          setQrCacheKey(Date.now());
                        }}
                        className="w-full bg-white border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-semibold"
                      >
                        <QrCode className="w-3.5 h-3.5 mr-1.5" /> Open QR / Pairing Code
                      </Button>
                    </div>
                  )}
                </CardContent>

                {/* Card Action Buttons Footer */}
                <CardFooter className="pt-3 border-t border-gray-100 bg-gray-50/50 flex flex-wrap gap-2">
                  {!isActive ? (
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs py-2 shadow-xs" 
                      disabled={loading[session.sessionId]}
                      onClick={() => handleStart(session.sessionId)}
                    >
                      {loading[session.sessionId] ? (
                        <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="mr-2 h-3.5 w-3.5 fill-current" />
                      )}
                      Start Engine
                    </Button>
                  ) : (
                    <div className="w-full flex items-center space-x-2">
                      <Button 
                        variant="outline" 
                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50 text-xs font-medium py-1.5" 
                        disabled={loading[session.sessionId]}
                        onClick={() => handleStop(session.sessionId)}
                      >
                        <Square className="mr-1.5 h-3.5 w-3.5 fill-current" /> Stop
                      </Button>

                      <Button 
                        variant="outline" 
                        className="text-amber-700 border-amber-200 hover:bg-amber-50 text-xs font-medium py-1.5 px-2.5" 
                        disabled={loading[`unlink-${session.sessionId}`]}
                        onClick={() => setUnlinkConfirmId(session.sessionId)}
                        title="Unlink WhatsApp Web session without deleting profile"
                      >
                        <Unlink className="w-3.5 h-3.5 mr-1" /> Unlink
                      </Button>

                      {session.engineLoaded && (
                        <Button 
                          variant="outline" 
                          className="text-gray-700 border-gray-300 hover:bg-gray-100 text-xs font-medium py-1.5 px-2" 
                          onClick={() => setKillConfirmId(session.sessionId)}
                          title="Force kill stuck browser process"
                        >
                          <Skull className="w-3.5 h-3.5 text-gray-500" />
                        </Button>
                      )}
                    </div>
                  )}
                </CardFooter>
              </Card>
            );
          })
        )}
      </div>

      {/* QR & Pairing Modal */}
      {qrModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <Card className="w-full max-w-md shadow-2xl bg-white border border-gray-200">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-gray-900">
                  Link Device: <span className="text-blue-600">{qrModalSession.sessionId}</span>
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Scan QR code or use phone pairing code
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setQrModalSession(null)} className="h-8 w-8 text-gray-400">
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="py-5 space-y-4">
              {/* Tab Selector */}
              <div className="flex p-1 bg-gray-100 rounded-lg">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`flex-1 text-xs h-8 ${!pairingMode ? 'bg-white shadow-xs font-bold text-blue-700' : 'text-gray-600'}`}
                  onClick={() => setPairingMode(false)}
                >
                  <QrCode className="w-3.5 h-3.5 mr-1.5" /> Scan QR Code
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`flex-1 text-xs h-8 ${pairingMode ? 'bg-white shadow-xs font-bold text-blue-700' : 'text-gray-600'}`}
                  onClick={() => setPairingMode(true)}
                >
                  <Key className="w-3.5 h-3.5 mr-1.5" /> Phone Pairing Code
                </Button>
              </div>

              {!pairingMode ? (
                /* QR Code Display */
                <div className="text-center space-y-3">
                  <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-inner max-w-[220px] mx-auto">
                    <img 
                      src={`/api/whatsapp/qr/${qrModalSession.sessionId}?cache=${qrCacheKey}`} 
                      alt="WhatsApp QR Code" 
                      className="w-full aspect-square object-contain rounded"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <p className="font-semibold text-gray-800">Instructions:</p>
                    <ol className="text-[11px] list-decimal list-inside text-gray-600 space-y-0.5">
                      <li>Open WhatsApp on your phone</li>
                      <li>Tap <strong>Menu</strong> or <strong>Settings</strong> &gt; <strong>Linked Devices</strong></li>
                      <li>Tap <strong>Link a Device</strong> and point camera at QR code</li>
                    </ol>
                  </div>
                  <button 
                    onClick={() => setQrCacheKey(Date.now())}
                    className="text-xs text-blue-600 hover:underline font-semibold flex items-center justify-center mx-auto"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" /> Refresh QR Code
                  </button>
                </div>
              ) : (
                /* Pairing Code Display */
                <div className="space-y-3">
                  {pairingCode ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center space-y-2">
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block">
                        Your 8-Digit Pairing Code
                      </span>
                      <div className="flex items-center justify-center space-x-2">
                        <p className="text-2xl font-mono font-bold tracking-[0.2em] text-blue-900">
                          {pairingCode.substring(0, 4)} - {pairingCode.substring(4)}
                        </p>
                        <Button 
                          size="icon" 
                          variant="ghost"
                          className="h-8 w-8 text-blue-600 hover:bg-blue-100"
                          onClick={() => copyToClipboard(pairingCode)}
                        >
                          {copiedCode === pairingCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                      <p className="text-[11px] text-blue-700 font-medium">
                        Open WhatsApp &gt; Linked Devices &gt; Link with phone number
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-600">
                        Enter phone number with country code (e.g. <code className="bg-gray-100 px-1 rounded">14155552671</code>):
                      </p>
                      <div className="flex space-x-2">
                        <Input 
                          placeholder="Phone number" 
                          className="text-sm bg-white"
                          value={pairingPhone}
                          onChange={(e) => setPairingPhone(e.target.value)}
                        />
                        <Button 
                          className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                          disabled={loading[`pair-${qrModalSession.sessionId}`]}
                          onClick={() => handleRequestPairing(qrModalSession.sessionId)}
                        >
                          {loading[`pair-${qrModalSession.sessionId}`] ? (
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
            </CardContent>
            <CardFooter className="pt-3 border-t bg-gray-50 flex justify-end">
              <Button onClick={() => setQrModalSession(null)}>Close</Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Session Details & Config Modal */}
      {selectedSessionDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <Card className="w-full max-w-lg shadow-2xl bg-white border border-gray-200 max-h-[90vh] overflow-y-auto">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">Session Configuration & Details</CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Telemetry for {selectedSessionDetails.sessionId}
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedSessionDetails(null)} className="h-8 w-8 text-gray-400">
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            <CardContent className="py-5 space-y-5">
              {/* Properties Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Session Identifier</span>
                  <span className="font-mono text-gray-900 font-semibold">{selectedSessionDetails.sessionId}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Engine Provider</span>
                  <span className="font-semibold text-emerald-700 uppercase">{activeEngine}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Phone Number</span>
                  <span className="font-semibold text-gray-800">{selectedSessionDetails.phone ? `+${selectedSessionDetails.phone}` : '—'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Push Name</span>
                  <span className="font-semibold text-gray-800">{selectedSessionDetails.pushName || '—'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Connection Status</span>
                  <span className="font-semibold text-emerald-700 capitalize">{selectedSessionDetails.status || selectedSessionDetails.state}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Engine Process Loaded</span>
                  <span className="font-semibold text-gray-800">{selectedSessionDetails.engineLoaded ? 'Yes' : 'No'}</span>
                </div>
              </div>

              {/* Session Config Toggle: Auto-Reject Calls */}
              <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <PhoneCall className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-gray-800">Auto-Reject Incoming Voice Calls</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={sessionConfig?.autoRejectCalls || false}
                      disabled={savingConfig || !sessionConfig}
                      onChange={(e) => handleAutoRejectToggle(selectedSessionDetails.sessionId, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <p className="text-[11px] text-gray-500">
                  When enabled, WhatsApp voice calls are automatically rejected immediately while preserving call log webhooks.
                </p>
              </div>

              {/* Error log if present */}
              {selectedSessionDetails.lastError && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-amber-800 flex items-center">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" /> Last Engine Exception
                  </span>
                  <p className="text-amber-700 font-mono text-[11px]">{selectedSessionDetails.lastError}</p>
                </div>
              )}
            </CardContent>

            <CardFooter className="pt-3 border-t border-gray-100 bg-gray-50 flex justify-end">
              <Button onClick={() => setSelectedSessionDetails(null)} className="bg-gray-900 hover:bg-black text-white">
                Close
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <Card className="w-full max-w-sm shadow-2xl bg-white border border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-gray-900 flex items-center text-red-600">
                <Trash2 className="w-4 h-4 mr-2" /> Delete Session Profile?
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 text-xs text-gray-600">
              Are you sure you want to permanently delete <strong>{deleteConfirmId}</strong>? This removes the session profile from the database.
            </CardContent>
            <CardFooter className="pt-3 border-t bg-gray-50 flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
              <Button 
                size="sm" 
                className="bg-red-600 hover:bg-red-700 text-white font-medium"
                disabled={loading[`delete-${deleteConfirmId}`]}
                onClick={() => handleDelete(deleteConfirmId)}
              >
                {loading[`delete-${deleteConfirmId}`] ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Delete Profile'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Unlink Device Confirmation Modal */}
      {unlinkConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <Card className="w-full max-w-sm shadow-2xl bg-white border border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-gray-900 flex items-center text-amber-700">
                <Unlink className="w-4 h-4 mr-2" /> Unlink WhatsApp Device?
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 text-xs text-gray-600">
              This will log out the linked WhatsApp Web device for <strong>{unlinkConfirmId}</strong> without deleting the session profile.
            </CardContent>
            <CardFooter className="pt-3 border-t bg-gray-50 flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={() => setUnlinkConfirmId(null)}>Cancel</Button>
              <Button 
                size="sm" 
                className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
                disabled={loading[`unlink-${unlinkConfirmId}`]}
                onClick={() => handleUnlink(unlinkConfirmId)}
              >
                {loading[`unlink-${unlinkConfirmId}`] ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Unlink Device'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Force-Kill Process Confirmation Modal */}
      {killConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <Card className="w-full max-w-sm shadow-2xl bg-white border border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-gray-900 flex items-center text-gray-900">
                <Skull className="w-4 h-4 mr-2 text-red-600" /> Force-Kill Stuck Engine?
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 text-xs text-gray-600">
              Force-kills the wedged browser process for <strong>{killConfirmId}</strong>. Use this only if the engine process is frozen.
            </CardContent>
            <CardFooter className="pt-3 border-t bg-gray-50 flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={() => setKillConfirmId(null)}>Cancel</Button>
              <Button 
                size="sm" 
                className="bg-gray-900 hover:bg-black text-white font-medium"
                disabled={loading[`kill-${killConfirmId}`]}
                onClick={() => handleForceKill(killConfirmId)}
              >
                {loading[`kill-${killConfirmId}`] ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Force Kill'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
