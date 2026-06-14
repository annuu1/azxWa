'use client';

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { 
  Send, 
  Upload, 
  Users, 
  Smartphone, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Sparkles, 
  Plus, 
  Trash2,
  Sliders,
  Table,
  Check,
  Pause,
  Play,
  RefreshCw,
  Clock,
  AlertCircle
} from 'lucide-react';
import { 
  getConnectedSessionsAction, 
  queueBulkMessagesAction,
  convertOrUpdateLeadAction,
  getMessageCenterBroadcastsAction,
  getBroadcastProgressAction,
  toggleBroadcastStatusAction
} from '../actions/message-center-actions';

interface ParsedRow {
  phone: string;
  name: string;
  customVars?: Record<string, string>;
}

export default function MessageCenterPanel() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Input states
  const [broadcastName, setBroadcastName] = useState('');
  const [inputType, setInputType] = useState<'text' | 'file'>('text');
  const [rawText, setRawText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [messageTemplate, setMessageTemplate] = useState('Hello {{name}},\n\nThis is a broadcast message.');
  
  // Options
  const [saveToCRM, setSaveToCRM] = useState(false);
  const [minDelay, setMinDelay] = useState(5);
  const [maxDelay, setMaxDelay] = useState(15);

  // Parsing outputs
  const [recipients, setRecipients] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  
  // UI States
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Recent Broadcasts
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [activeBroadcastId, setActiveBroadcastId] = useState<string | null>(null);
  const [activeBroadcastData, setActiveBroadcastData] = useState<any | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  // Individual CRM status updates
  const [crmStatusLoading, setCrmStatusLoading] = useState<Record<string, boolean>>({});
  const [crmStatusDone, setCrmStatusDone] = useState<Record<string, string>>({});

  // Initial load
  useEffect(() => {
    const initLoad = async () => {
      setLoadingSessions(true);
      try {
        const res = await getConnectedSessionsAction();
        if (res.success && res.sessions) {
          setSessions(res.sessions);
          if (res.sessions.length > 0) {
            setSelectedSession(res.sessions[0].sessionId);
          }
        }
        await loadBroadcasts();
      } catch (err: any) {
        console.error('Initial load failed:', err);
      } finally {
        setLoadingSessions(false);
      }
    };
    initLoad();
  }, []);

  // Poll progress when a broadcast is running/active
  useEffect(() => {
    if (!activeBroadcastId) return;

    // Fetch progress immediately
    fetchProgress(activeBroadcastId);

    const interval = setInterval(() => {
      // Only poll if campaign is not fully completed or paused
      if (activeBroadcastData?.campaign?.status === 'PENDING' || activeBroadcastData?.campaign?.status === 'PROCESSING') {
        fetchProgress(activeBroadcastId);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeBroadcastId, activeBroadcastData?.campaign?.status]);

  const loadBroadcasts = async () => {
    try {
      const res = await getMessageCenterBroadcastsAction();
      if (res.success && res.broadcasts) {
        setBroadcasts(res.broadcasts);
        // Automatically select the latest broadcast if none is selected
        if (res.broadcasts.length > 0 && !activeBroadcastId) {
          setActiveBroadcastId(res.broadcasts[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load recent broadcasts:', err);
    }
  };

  const fetchProgress = async (id: string) => {
    try {
      const res = await getBroadcastProgressAction(id);
      if (res.success) {
        setActiveBroadcastData(res);
      }
    } catch (err) {
      console.error('Failed to fetch progress details:', err);
    }
  };

  // Pause / Resume Broadcast
  const handleToggleStatus = async () => {
    if (!activeBroadcastId || !activeBroadcastData?.campaign) return;
    const currentStatus = activeBroadcastData.campaign.status;
    const shouldPause = currentStatus === 'PENDING' || currentStatus === 'PROCESSING';

    setTogglingStatus(true);
    try {
      const res = await toggleBroadcastStatusAction(activeBroadcastId, shouldPause);
      if (res.success) {
        await fetchProgress(activeBroadcastId);
        await loadBroadcasts();
      }
    } catch (err: any) {
      alert('Failed to change status: ' + err.message);
    } finally {
      setTogglingStatus(false);
    }
  };

  // Parse plain text input
  const parseTextInput = () => {
    if (!rawText.trim()) {
      setRecipients([]);
      return;
    }

    const lines = rawText.split(/[\n,]+/);
    const parsed: ParsedRow[] = [];
    
    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;

      const digits = cleanLine.replace(/\D/g, '');
      if (digits.length >= 7) {
        parsed.push({
          phone: digits,
          name: `Customer (${digits.slice(-4)})`,
          customVars: {}
        });
      }
    }
    setHeaders([]);
    setRecipients(parsed);
  };

  useEffect(() => {
    if (inputType === 'text') {
      parseTextInput();
    }
  }, [rawText, inputType]);

  // Handle file import (CSV / Excel)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErrorMsg('');
    setSuccessMsg('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) return;

        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        if (rawJson.length === 0) {
          throw new Error('The file is empty.');
        }

        const fileHeaders = (rawJson[0] || []).map((h: any) => h?.toString().trim() || '');
        const validHeaders = fileHeaders.filter(h => h.length > 0);
        setHeaders(validHeaders);

        const phoneIndex = fileHeaders.findIndex(h => 
          /phone|number|mobile|contact|tel/i.test(h)
        );
        const nameIndex = fileHeaders.findIndex(h => 
          /name|client|contact_name|lead/i.test(h)
        );

        const targetPhoneIdx = phoneIndex !== -1 ? phoneIndex : 0;
        const targetNameIdx = nameIndex !== -1 ? nameIndex : -1;

        const parsedRows: ParsedRow[] = [];
        
        for (let i = 1; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (!row || row.length === 0) continue;

          const rawPhone = row[targetPhoneIdx]?.toString().trim() || '';
          const cleanPhone = rawPhone.replace(/\D/g, '');
          if (!cleanPhone || cleanPhone.length < 7) continue;

          const rawName = targetNameIdx !== -1 ? row[targetNameIdx]?.toString().trim() : '';
          const name = rawName || `Customer (${cleanPhone.slice(-4)})`;

          const customVars: Record<string, string> = {};
          fileHeaders.forEach((header, index) => {
            if (header && index !== targetPhoneIdx && index !== targetNameIdx) {
              customVars[header] = row[index]?.toString().trim() || '';
            }
          });

          parsedRows.push({
            phone: cleanPhone,
            name,
            customVars
          });
        }

        if (parsedRows.length === 0) {
          throw new Error('No valid rows containing phone numbers were found.');
        }

        setRecipients(parsedRows);
        setSuccessMsg(`Successfully parsed ${parsedRows.length} recipients from ${selectedFile.name}`);
      } catch (err: any) {
        setErrorMsg('Failed to parse file: ' + err.message);
        setRecipients([]);
        setFile(null);
      }
    };

    reader.readAsBinaryString(selectedFile);
  };

  const getPreviewMessage = (row: ParsedRow) => {
    let msg = messageTemplate;
    msg = msg.replace(/{{name}}/gi, row.name);
    msg = msg.replace(/{{phone}}/gi, row.phone);
    if (row.customVars) {
      Object.entries(row.customVars).forEach(([k, v]) => {
        const regex = new RegExp(`{{${k}}}`, 'gi');
        msg = msg.replace(regex, v || '');
      });
    }
    return msg;
  };

  const insertPlaceholder = (ph: string) => {
    setMessageTemplate(prev => prev + ` {{${ph}}}`);
  };

  const handleSingleCRMUpdate = async (phone: string, name: string, status: 'NEW' | 'QUALIFIED' | 'CONTACTED' | 'WON' | 'LOST') => {
    const key = phone;
    setCrmStatusLoading(prev => ({ ...prev, [key]: true }));
    try {
      const res = await convertOrUpdateLeadAction(phone, name, status);
      if (res.success) {
        setCrmStatusDone(prev => ({ ...prev, [key]: status }));
      } else {
        alert('Failed to save to CRM: ' + res.error);
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setCrmStatusLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleSendBroadcast = async () => {
    if (!selectedSession) {
      setErrorMsg('Please select a connected WhatsApp session.');
      return;
    }
    if (recipients.length === 0) {
      setErrorMsg('Please add or import recipients first.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    const finalName = broadcastName.trim() || `Broadcast - ${new Date().toLocaleTimeString()}`;

    try {
      const res = await queueBulkMessagesAction(
        finalName,
        recipients.map(r => ({
          phone: r.phone,
          name: r.name,
          customVars: r.customVars
        })),
        messageTemplate,
        selectedSession,
        saveToCRM,
        Number(minDelay),
        Number(maxDelay)
      );

      if (res.success) {
        setSuccessMsg(`🚀 Staggered bulk broadcast "${finalName}" successfully queued!`);
        setRawText('');
        setBroadcastName('');
        setFile(null);
        setRecipients([]);
        
        // Reload list and select new broadcast
        await loadBroadcasts();
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      setErrorMsg('Failed to queue broadcast: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const removeRecipient = (index: number) => {
    setRecipients(prev => prev.filter((_, idx) => idx !== index));
  };

  // Helper styles for queue status badges
  const renderJobStatus = (status: string) => {
    switch (status) {
      case 'SENT':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-150">Sent</span>;
      case 'PENDING':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-150 animate-pulse">Queued</span>;
      case 'PROCESSING':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-150">Sending</span>;
      case 'FAILED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-150">Failed</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-50 text-gray-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      {/* Upper Grid - Senders controls */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        
        {/* Left Settings Panel */}
        <div className="xl:col-span-2 space-y-6">
          
          <Card className="shadow-sm border border-gray-200">
            <CardHeader className="bg-gray-50/50 border-b pb-4">
              <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-1.5">
                <Smartphone className="w-5 h-5 text-blue-600" />
                1. Channel & Antiban Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              
              {/* Broadcast Name */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase">Broadcast Name (Optional)</label>
                <Input
                  type="text"
                  placeholder="e.g. Promo Blast June"
                  value={broadcastName}
                  onChange={(e) => setBroadcastName(e.target.value)}
                  className="bg-white"
                />
              </div>

              {/* Session Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase">WhatsApp Device</label>
                {loadingSessions ? (
                  <div className="flex items-center text-xs text-gray-400 gap-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading connected accounts...
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="text-xs text-red-500 bg-red-50 border border-red-100 p-3 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>No connected accounts found. Link a device in the WhatsApp panel first.</span>
                  </div>
                ) : (
                  <select
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                  >
                    {sessions.map((s) => (
                      <option key={s.sessionId} value={s.sessionId}>
                        🟢 {s.sessionId.toUpperCase()}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Save to CRM Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-100 rounded-lg">
                <div className="space-y-0.5 pr-2">
                  <label className="text-xs font-bold text-gray-800 block">Save Numbers to CRM</label>
                  <span className="text-[10px] text-gray-500 leading-normal block">
                    Save all successfully parsed numbers into CRM contact database automatically.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={saveToCRM}
                  onChange={(e) => setSaveToCRM(e.target.checked)}
                  className="w-10 h-5 bg-gray-200 rounded-full appearance-none cursor-pointer checked:bg-blue-600 relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all checked:after:translate-x-5"
                />
              </div>

              {/* Delay Settings */}
              <div className="space-y-2.5 pt-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-blue-500" /> Stagger Settings (Seconds)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-400">Min Delay</span>
                    <Input
                      type="number"
                      min={1}
                      value={minDelay}
                      onChange={(e) => setMinDelay(Math.max(1, Number(e.target.value)))}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-400">Max Delay</span>
                    <Input
                      type="number"
                      min={2}
                      value={maxDelay}
                      onChange={(e) => setMaxDelay(Math.max(2, Number(e.target.value)))}
                      className="bg-white"
                    />
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>

          <Card className="shadow-sm border border-gray-200">
            <CardHeader className="bg-gray-50/50 border-b pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-1.5">
                  <Users className="w-5 h-5 text-blue-600" />
                  2. Import Recipients
                </CardTitle>
                <div className="flex bg-gray-100 p-0.5 rounded-lg text-xs font-semibold shrink-0">
                  <button
                    onClick={() => setInputType('text')}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      inputType === 'text' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Paste Text
                  </button>
                  <button
                    onClick={() => setInputType('file')}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      inputType === 'file' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    CSV / Excel
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              
              {inputType === 'text' ? (
                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-gray-500 uppercase">Input Numbers</label>
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Paste numbers:&#10;1234567890&#10;0987654321, 9998887776"
                    className="w-full min-h-[140px] bg-white border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono leading-relaxed"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-lg p-6 bg-gray-50/50 transition-colors relative group cursor-pointer">
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center text-center space-y-2">
                      <Upload className="w-10 h-10 text-gray-400 group-hover:text-blue-500 transition-colors" />
                      <span className="text-xs font-semibold text-gray-700 font-medium">
                        {file ? file.name : 'Drag & Drop CSV / Excel'}
                      </span>
                      <span className="text-[10px] text-gray-400">Supports .csv, .xlsx, .xls</span>
                    </div>
                  </div>
                  {headers.length > 0 && (
                    <div className="bg-gray-50 p-3 border border-gray-100 rounded-lg space-y-1.5">
                      <span className="text-[10px] font-bold text-gray-500 uppercase block">Fields Detected:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {headers.map(h => (
                          <span key={h} className="bg-white border border-gray-200 px-2 py-0.5 rounded text-[10px] text-gray-600 font-bold shadow-sm">
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </CardContent>
          </Card>

        </div>

        {/* Right Preview & Customize Panel (3 Columns) */}
        <div className="xl:col-span-3 space-y-6">
          
          <Card className="shadow-sm border border-gray-200">
            <CardHeader className="bg-gray-50/50 border-b pb-4">
              <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-1.5">
                <Sparkles className="w-5 h-5 text-blue-600" />
                3. Customize Dynamic Template
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              
              {/* Tags Selector */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase block">Insert placeholders:</span>
                <div className="flex flex-wrap gap-1.5">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => insertPlaceholder('name')}
                    className="h-7 px-2.5 text-xs font-bold text-blue-600 border-blue-200 bg-blue-50/20 hover:bg-blue-50"
                  >
                    {"{{name}}"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => insertPlaceholder('firstName')}
                    className="h-7 px-2.5 text-xs font-bold text-blue-600 border-blue-200 bg-blue-50/20 hover:bg-blue-50"
                  >
                    {"{{firstName}}"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => insertPlaceholder('phone')}
                    className="h-7 px-2.5 text-xs font-bold text-blue-600 border-blue-200 bg-blue-50/20 hover:bg-blue-50"
                  >
                    {"{{phone}}"}
                  </Button>
                  
                  {headers.map(h => (
                    <Button
                      key={h}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => insertPlaceholder(h)}
                      className="h-7 px-2.5 text-xs font-bold text-purple-600 border-purple-200 bg-purple-50/20 hover:bg-purple-50"
                    >
                      {`{{${h}}}`}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Template Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase">Message Body Template</label>
                <textarea
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  placeholder="Type message template here..."
                  className="w-full min-h-[140px] bg-white border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-normal leading-relaxed"
                  required
                />
              </div>

            </CardContent>
          </Card>

          <Card className="shadow-sm border border-gray-200 overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b pb-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-1.5">
                  <Table className="w-5 h-5 text-blue-600" />
                  4. Recipient Preview Table
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Confirm details and dynamically render messages prior to dispatch.
                </CardDescription>
              </div>
              <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold px-3 py-1 rounded-full">
                {recipients.length} Recipient(s) Loaded
              </span>
            </CardHeader>
            
            <CardContent className="p-0">
              {recipients.length === 0 ? (
                <div className="text-center py-12 px-4 bg-white">
                  <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <h3 className="text-xs font-semibold text-gray-700">No Contacts Imported</h3>
                  <span className="text-[10px] text-gray-400 block mt-0.5">Input raw numbers or upload spreadsheet data.</span>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider sticky top-0 z-10 border-b">
                      <tr>
                        <th className="p-3 w-10">#</th>
                        <th className="p-3">Contact</th>
                        <th className="p-3">Rendered Message</th>
                        <th className="p-3 text-right">CRM Quick Save</th>
                        <th className="p-3 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {recipients.map((row, index) => {
                        const key = row.phone;
                        const preview = getPreviewMessage(row);
                        const isUpdating = !!crmStatusLoading[key];
                        const isDone = crmStatusDone[key];

                        return (
                          <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-3 text-gray-400">{index + 1}</td>
                            <td className="p-3">
                              <span className="font-semibold text-gray-900 block font-mono">
                                +{row.phone}
                              </span>
                              <span className="text-[10px] text-gray-500 mt-0.5 block truncate max-w-[140px]">
                                {row.name}
                              </span>
                            </td>
                            <td className="p-3 text-gray-600 leading-relaxed max-w-[240px] truncate-3-lines whitespace-pre-wrap font-normal">
                              {preview}
                            </td>
                            <td className="p-3 text-right">
                              {isDone ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                                  <Check className="w-3 h-3" /> Saved as {isDone}
                                </span>
                              ) : (
                                <div className="inline-flex gap-1">
                                  <button
                                    onClick={() => handleSingleCRMUpdate(row.phone, row.name, 'NEW')}
                                    disabled={isUpdating}
                                    className="px-2 py-0.5 bg-white border border-gray-200 text-gray-600 font-semibold rounded hover:bg-gray-50 text-[9px] transition-colors"
                                  >
                                    + Lead
                                  </button>
                                  <button
                                    onClick={() => handleSingleCRMUpdate(row.phone, row.name, 'QUALIFIED')}
                                    disabled={isUpdating}
                                    className="px-2 py-0.5 bg-blue-50 border border-blue-150 text-blue-700 font-bold rounded hover:bg-blue-100 text-[9px] transition-colors"
                                  >
                                    🎯 Qualify
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => removeRecipient(index)}
                                className="text-gray-300 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>

            <CardFooter className="bg-gray-50/50 border-t py-4 flex justify-between items-center px-6">
              <div className="text-xs text-gray-500">
                {successMsg && <span className="text-green-600 font-semibold block">{successMsg}</span>}
                {errorMsg && <span className="text-red-500 font-semibold block">{errorMsg}</span>}
              </div>
              <Button
                onClick={handleSendBroadcast}
                disabled={submitting || recipients.length === 0 || !selectedSession}
                className="bg-blue-600 hover:bg-blue-700 font-bold px-6"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Staging Queue...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" /> Start Bulk Broadcast
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

        </div>

      </div>

      {/* Lower Grid - Live Monitoring & History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 border-t pt-8">
        
        {/* Left Side: Broadcasts List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center gap-2 pb-2">
            <Clock className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-bold text-gray-800">Broadcast History</h2>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {broadcasts.length === 0 ? (
              <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
                <Users className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <span className="text-xs text-gray-400">No broadcasts launched yet.</span>
              </div>
            ) : (
              broadcasts.map((b) => {
                const isActive = b.id === activeBroadcastId;
                const total = b.stats.total || 0;
                const sent = b.stats.sent || 0;
                const failed = b.stats.failed || 0;
                const progress = total > 0 ? Math.round(((sent + failed) / total) * 100) : 0;

                return (
                  <div
                    key={b.id}
                    onClick={() => setActiveBroadcastId(b.id)}
                    className={`p-4 border rounded-lg cursor-pointer transition-all shadow-sm ${
                      isActive 
                        ? 'border-blue-500 bg-blue-50/20 shadow-md' 
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-sm text-gray-900 block truncate max-w-[180px]">
                          {b.name}
                        </span>
                        <span className="text-[10px] text-gray-400 mt-1 block">
                          Session: <strong className="font-mono text-gray-600">{b.sessionId}</strong>
                        </span>
                      </div>
                      
                      {/* Status Badges */}
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        b.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border border-green-150' :
                        b.status === 'PAUSED' ? 'bg-gray-100 text-gray-700 border border-gray-200' :
                        b.status === 'FAILED' ? 'bg-red-50 text-red-700 border border-red-150' :
                        'bg-blue-50 text-blue-700 border border-blue-150 animate-pulse'
                      }`}>
                        {b.status}
                      </span>
                    </div>

                    {/* Mini Progress */}
                    <div className="mt-3 space-y-1.5">
                      <div className="flex justify-between text-[10px] text-gray-500 font-semibold">
                        <span>Progress: {progress}%</span>
                        <span>{sent + failed}/{total} sent</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1">
                        <div 
                          className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Active Monitor & Log Console (2 Columns) */}
        <div className="lg:col-span-2 space-y-4">
          
          {activeBroadcastId && activeBroadcastData ? (
            <div className="space-y-4">
              
              {/* Dynamic Header & Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                <div>
                  <h3 className="font-bold text-base text-gray-900 flex items-center gap-1.5">
                    Monitoring: {activeBroadcastData.campaign.name}
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Staggered delay: {activeBroadcastData.campaign.minDelay}-{activeBroadcastData.campaign.maxDelay}s. 
                    Channel: <span className="font-mono font-bold">{activeBroadcastData.campaign.sessionId}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Pause / Resume Button */}
                  {(activeBroadcastData.campaign.status === 'PENDING' || 
                    activeBroadcastData.campaign.status === 'PROCESSING' || 
                    activeBroadcastData.campaign.status === 'PAUSED') && (
                      <Button
                        variant={activeBroadcastData.campaign.status === 'PAUSED' ? 'default' : 'outline'}
                        size="sm"
                        onClick={handleToggleStatus}
                        disabled={togglingStatus}
                        className={`h-8 font-bold text-xs ${
                          activeBroadcastData.campaign.status === 'PAUSED' 
                            ? 'bg-blue-600 hover:bg-blue-700' 
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {togglingStatus ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : activeBroadcastData.campaign.status === 'PAUSED' ? (
                          <>
                            <Play className="w-3.5 h-3.5 mr-1" /> Resume Sending
                          </>
                        ) : (
                          <>
                            <Pause className="w-3.5 h-3.5 mr-1" /> Pause Sending
                          </>
                        )}
                      </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchProgress(activeBroadcastId)}
                    className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                
                {/* Total */}
                <div className="bg-white border border-gray-250 p-4 rounded-lg shadow-sm text-center">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Total</span>
                  <span className="text-xl font-bold text-gray-800 block mt-1">
                    {activeBroadcastData.stats.total || 0}
                  </span>
                </div>

                {/* Queued (Pending) */}
                <div className="bg-white border border-gray-250 p-4 rounded-lg shadow-sm text-center">
                  <span className="text-[10px] font-bold text-blue-500 uppercase block">Queued</span>
                  <span className="text-xl font-bold text-blue-600 block mt-1">
                    {(activeBroadcastData.stats.pending || 0) + (activeBroadcastData.stats.processing || 0)}
                  </span>
                </div>

                {/* Sent */}
                <div className="bg-white border border-gray-250 p-4 rounded-lg shadow-sm text-center">
                  <span className="text-[10px] font-bold text-green-500 uppercase block">Sent</span>
                  <span className="text-xl font-bold text-green-600 block mt-1">
                    {activeBroadcastData.stats.sent || 0}
                  </span>
                </div>

                {/* Failed */}
                <div className="bg-white border border-gray-250 p-4 rounded-lg shadow-sm text-center">
                  <span className="text-[10px] font-bold text-red-500 uppercase block">Failed</span>
                  <span className="text-xl font-bold text-red-600 block mt-1">
                    {activeBroadcastData.stats.failed || 0}
                  </span>
                </div>

              </div>

              {/* Progress Bar Header */}
              <div className="w-full bg-white border border-gray-200 p-4 rounded-lg shadow-sm space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                  <span>Broadcast Progress Log</span>
                  <span>
                    {Math.round(
                      (((activeBroadcastData.stats.sent || 0) + (activeBroadcastData.stats.failed || 0)) / 
                      (activeBroadcastData.stats.total || 1)) * 100
                    )}% Completed
                  </span>
                </div>
                <div className="w-full bg-gray-150 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-green-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        (((activeBroadcastData.stats.sent || 0) + (activeBroadcastData.stats.failed || 0)) / 
                        (activeBroadcastData.stats.total || 1)) * 100
                      }%`
                    }}
                  />
                </div>
              </div>

              {/* Live Jobs Table Log */}
              <Card className="border border-gray-200 overflow-hidden shadow-sm">
                <CardHeader className="bg-gray-50/50 border-b p-3.5">
                  <CardTitle className="text-xs font-bold text-gray-700 uppercase">Queue Activity Logs</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-[300px]">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="bg-gray-50 text-gray-400 font-bold uppercase tracking-wider sticky top-0 border-b">
                        <tr>
                          <th className="p-2.5 w-8">#</th>
                          <th className="p-2.5">Recipient</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5">Scheduled / Error</th>
                          <th className="p-2.5 text-right">CRM Sync</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {activeBroadcastData.jobs.map((job: any, idx: number) => {
                          const displayPhone = job.recipientWhatsappId.split('@')[0];
                          const key = displayPhone;
                          const isUpdating = !!crmStatusLoading[key];
                          const isDone = crmStatusDone[key];

                          return (
                            <tr key={job.id} className="hover:bg-gray-50/30 transition-colors">
                              <td className="p-2.5 text-gray-400 font-semibold">{idx + 1}</td>
                              <td className="p-2.5">
                                <span className="font-semibold text-gray-900 block font-mono">+{displayPhone}</span>
                              </td>
                              <td className="p-2.5">{renderJobStatus(job.status)}</td>
                              <td className="p-2.5 max-w-[200px] truncate">
                                {job.status === 'FAILED' ? (
                                  <span className="text-red-500 font-medium flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3 shrink-0" /> {job.error || 'Connection Timeout'}
                                  </span>
                                ) : (
                                  <span className="text-gray-500 font-mono text-[10px]">
                                    {new Date(job.scheduledFor).toLocaleTimeString()}
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-right">
                                {isDone ? (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                                    <Check className="w-2.5 h-2.5" /> {isDone}
                                  </span>
                                ) : (
                                  <div className="inline-flex gap-1 justify-end">
                                    <button
                                      onClick={() => handleSingleCRMUpdate(displayPhone, displayPhone, 'NEW')}
                                      disabled={isUpdating}
                                      className="px-1.5 py-0.5 bg-white border border-gray-200 text-gray-600 font-semibold rounded hover:bg-gray-50 text-[9px] transition-colors"
                                    >
                                      + Lead
                                    </button>
                                    <button
                                      onClick={() => handleSingleCRMUpdate(displayPhone, displayPhone, 'QUALIFIED')}
                                      disabled={isUpdating}
                                      className="px-1.5 py-0.5 bg-blue-50 border border-blue-150 text-blue-700 font-bold rounded hover:bg-blue-100 text-[9px] transition-colors"
                                    >
                                      🎯 Qualify
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

            </div>
          ) : (
            <div className="text-center py-24 bg-white border border-gray-200 rounded-lg">
              <Clock className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-gray-700">Select a Broadcast</h3>
              <p className="text-xs text-gray-400 mt-1">Select a campaign from the history panel to view live logs.</p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
