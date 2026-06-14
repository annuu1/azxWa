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
  HelpCircle, 
  Sparkles, 
  Plus, 
  Trash2,
  Sliders,
  Table,
  Check
} from 'lucide-react';
import { 
  getConnectedSessionsAction, 
  queueBulkMessagesAction,
  convertOrUpdateLeadAction 
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
  
  // Individual CRM status updates
  const [crmStatusLoading, setCrmStatusLoading] = useState<Record<string, boolean>>({});
  const [crmStatusDone, setCrmStatusDone] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchSessions = async () => {
      setLoadingSessions(true);
      try {
        const res = await getConnectedSessionsAction();
        if (res.success && res.sessions) {
          setSessions(res.sessions);
          if (res.sessions.length > 0) {
            setSelectedSession(res.sessions[0].sessionId);
          }
        }
      } catch (err: any) {
        console.error('Failed to load connected WhatsApp accounts:', err);
      } finally {
        setLoadingSessions(false);
      }
    };
    fetchSessions();
  }, []);

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

      // Extract phone number (keeps digits)
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
        
        // Convert sheet to JSON array of objects
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        if (rawJson.length === 0) {
          throw new Error('The file is empty.');
        }

        // Get headers
        const fileHeaders = (rawJson[0] || []).map((h: any) => h?.toString().trim() || '');
        const validHeaders = fileHeaders.filter(h => h.length > 0);
        setHeaders(validHeaders);

        // Find phone and name columns
        const phoneIndex = fileHeaders.findIndex(h => 
          /phone|number|mobile|contact|tel/i.test(h)
        );
        const nameIndex = fileHeaders.findIndex(h => 
          /name|client|contact_name|lead/i.test(h)
        );

        const targetPhoneIdx = phoneIndex !== -1 ? phoneIndex : 0;
        const targetNameIdx = nameIndex !== -1 ? nameIndex : -1;

        const parsedRows: ParsedRow[] = [];
        
        // Loop starting from row index 1 (skip headers)
        for (let i = 1; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (!row || row.length === 0) continue;

          const rawPhone = row[targetPhoneIdx]?.toString().trim() || '';
          const cleanPhone = rawPhone.replace(/\D/g, '');
          if (!cleanPhone || cleanPhone.length < 7) continue;

          const rawName = targetNameIdx !== -1 ? row[targetNameIdx]?.toString().trim() : '';
          const name = rawName || `Customer (${cleanPhone.slice(-4)})`;

          // Map other columns as custom variables
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

  // Compile message preview for specific row
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

  // Click tag to insert placeholder
  const insertPlaceholder = (ph: string) => {
    setMessageTemplate(prev => prev + ` {{${ph}}}`);
  };

  // Add individual row recipient directly to CRM and qualify
  const handleSingleCRMUpdate = async (row: ParsedRow, status: 'NEW' | 'QUALIFIED' | 'CONTACTED' | 'WON' | 'LOST') => {
    const key = row.phone;
    setCrmStatusLoading(prev => ({ ...prev, [key]: true }));
    try {
      const res = await convertOrUpdateLeadAction(row.phone, row.name, status);
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

  // Queue bulk messages
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

    try {
      const res = await queueBulkMessagesAction(
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
        setSuccessMsg(`🚀 Successfully queued ${res.queuedCount} messages! The background worker will send them staggered using antiban delays.`);
        // Reset states
        setRawText('');
        setFile(null);
        setRecipients([]);
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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 max-w-7xl mx-auto">
      
      {/* Left Input & Settings Panel (2 Columns) */}
      <div className="xl:col-span-2 space-y-6">
        
        {/* Step 1: Destination & Stagger options */}
        <Card className="shadow-sm border border-gray-200">
          <CardHeader className="bg-gray-50/50 border-b pb-4">
            <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-1.5">
              <Smartphone className="w-5 h-5 text-blue-600" />
              1. Session & Antiban Options
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            
            {/* Session Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase">WhatsApp Channel</label>
              {loadingSessions ? (
                <div className="flex items-center text-xs text-gray-400 gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading connected devices...
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-xs text-red-500 bg-red-50 border border-red-100 p-3 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>No connected sessions! Connect an account in the WhatsApp panel first.</span>
                </div>
              ) : (
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                <label className="text-xs font-bold text-gray-800 block">Save Contacts to CRM</label>
                <span className="text-[10px] text-gray-500 leading-normal block">
                  Automatically add imported numbers into your CRM contact database if not already saved.
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
            <div className="space-y-2.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-blue-500" /> Staggered Delay (Seconds)
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

        {/* Step 2: Recipients Import */}
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
                  Paste List
                </button>
                <button
                  onClick={() => setInputType('file')}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    inputType === 'file' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Upload Sheets
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            
            {inputType === 'text' ? (
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-gray-500 uppercase">Paste Phone Numbers</label>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste numbers with country codes:&#10;919999999999&#10;918888888888, 917777777777"
                  className="w-full min-h-[140px] bg-white border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono leading-relaxed"
                />
                <p className="text-[10px] text-gray-400">
                  Separate numbers using commas, newlines, or spaces. Ensure to prepend country codes.
                </p>
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
                    <span className="text-xs font-semibold text-gray-700">
                      {file ? file.name : 'Choose CSV or Excel file'}
                    </span>
                    <span className="text-[10px] text-gray-400">Accepts .csv, .xlsx, .xls</span>
                  </div>
                </div>
                {headers.length > 0 && (
                  <div className="bg-gray-50 p-3 border border-gray-100 rounded-lg space-y-1.5">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Detected Headers:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {headers.map(h => (
                        <span key={h} className="bg-white border border-gray-200 px-2 py-0.5 rounded text-[10px] text-gray-600 font-semibold shadow-sm">
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

      {/* Right Template & Preview Panel (3 Columns) */}
      <div className="xl:col-span-3 space-y-6">
        
        {/* Step 3: Message Template Customizer */}
        <Card className="shadow-sm border border-gray-200">
          <CardHeader className="bg-gray-50/50 border-b pb-4">
            <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-1.5">
              <Sparkles className="w-5 h-5 text-blue-600" />
              3. Message Customizer
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            
            {/* Template Variables Buttons */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">Click to insert placeholder tags:</span>
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
                
                {/* Dynamically parsed headers from file */}
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
              <label className="text-[11px] font-bold text-gray-500 uppercase">Message Text Template</label>
              <textarea
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Compose message..."
                className="w-full min-h-[160px] bg-white border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-normal leading-relaxed"
                required
              />
            </div>

          </CardContent>
        </Card>

        {/* Step 4: Recipients Table & Preview */}
        <Card className="shadow-sm border border-gray-200 overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-1.5">
                <Table className="w-5 h-5 text-blue-600" />
                4. Recipient Preview List
              </CardTitle>
              <CardDescription className="text-[11px] mt-0.5">
                Inspect compiled templates and optionally save/qualify records to CRM.
              </CardDescription>
            </div>
            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full">
              {recipients.length} Selected
            </span>
          </CardHeader>
          
          <CardContent className="p-0">
            {recipients.length === 0 ? (
              <div className="text-center py-16 px-4 bg-white">
                <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-gray-700">No Recipients Loaded</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Paste values or upload an Excel/CSV sheet to populate the table.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider sticky top-0 z-10 border-b">
                    <tr>
                      <th className="p-3 w-10">#</th>
                      <th className="p-3 min-w-[120px]">Phone / Name</th>
                      <th className="p-3 min-w-[200px]">Message Preview</th>
                      <th className="p-3 text-right min-w-[180px]">CRM Direct Action</th>
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
                          <td className="p-3 text-gray-400 font-medium">{index + 1}</td>
                          <td className="p-3">
                            <span className="font-semibold text-gray-900 block font-mono">
                              +{row.phone}
                            </span>
                            <span className="text-[10px] text-gray-500 mt-0.5 block truncate max-w-[140px]">
                              {row.name}
                            </span>
                          </td>
                          <td className="p-3 text-gray-600 leading-relaxed font-normal whitespace-pre-wrap max-w-[260px] truncate-3-lines">
                            {preview}
                          </td>
                          <td className="p-3 text-right">
                            {isDone ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-md">
                                <Check className="w-3.5 h-3.5" /> Added as {isDone}
                              </span>
                            ) : (
                              <div className="inline-flex gap-1.5">
                                <button
                                  onClick={() => handleSingleCRMUpdate(row, 'NEW')}
                                  disabled={isUpdating}
                                  className="px-2 py-1 bg-white border border-gray-200 text-gray-700 font-semibold rounded hover:bg-gray-50 text-[10px] transition-colors shadow-sm disabled:opacity-50"
                                >
                                  + Lead
                                </button>
                                <button
                                  onClick={() => handleSingleCRMUpdate(row, 'QUALIFIED')}
                                  disabled={isUpdating}
                                  className="px-2 py-1 bg-blue-50 border border-blue-200 text-blue-700 font-bold rounded hover:bg-blue-100 text-[10px] transition-colors shadow-sm disabled:opacity-50"
                                >
                                  🎯 Qualify
                                </button>
                                {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 self-center" />}
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

          {/* Action Trigger Footer */}
          <CardFooter className="bg-gray-50/50 border-t py-4 flex justify-between items-center px-6">
            <div className="text-xs text-gray-500">
              {successMsg && <span className="text-green-600 font-semibold block">{successMsg}</span>}
              {errorMsg && <span className="text-red-500 font-semibold block">{errorMsg}</span>}
            </div>
            <Button
              onClick={handleSendBroadcast}
              disabled={submitting || recipients.length === 0 || !selectedSession}
              className="bg-blue-600 hover:bg-blue-700 font-bold px-6 py-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Queueing broadcast...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" /> Start Bulk Send
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

      </div>

    </div>
  );
}
