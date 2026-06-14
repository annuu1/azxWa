'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { 
  FileText, 
  Globe, 
  HelpCircle, 
  Trash2, 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Plus, 
  ArrowRight,
  BookOpen,
  Search,
  ExternalLink
} from 'lucide-react';
import { 
  getKnowledgeSourcesAction, 
  getKnowledgeChunksAction, 
  createFAQEntryAction, 
  deleteKnowledgeSourceAction, 
  deleteKnowledgeChunkAction, 
  addURLSourceAction 
} from '../actions/kb-actions';

interface Source {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: any;
}

interface Chunk {
  id: string;
  title: string | null;
  content: string;
  createdAt: any;
}

export default function KBPanel() {
  const [activeTab, setActiveTab] = useState<'documents' | 'urls' | 'faqs'>('documents');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Data States
  const [files, setFiles] = useState<Source[]>([]);
  const [urls, setUrls] = useState<Source[]>([]);
  const [faqs, setFaqs] = useState<Chunk[]>([]);
  const [faqSourceId, setFaqSourceId] = useState<string | null>(null);

  // Form inputs
  const [urlInput, setUrlInput] = useState('');
  const [submittingUrl, setSubmittingUrl] = useState(false);

  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [submittingFaq, setSubmittingFaq] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // File Upload states
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await getKnowledgeSourcesAction();
      if (!res.success || !res.sources) {
        throw new Error(res.error || 'Failed to fetch knowledge sources.');
      }

      const sourcesList = res.sources as Source[];
      const docSources = sourcesList.filter(s => s.type === 'FILE');
      const urlSources = sourcesList.filter(s => s.type === 'URL');
      const faqSource = sourcesList.find(s => s.type === 'FAQ');

      setFiles(docSources);
      setUrls(urlSources);

      if (faqSource) {
        setFaqSourceId(faqSource.id);
        const chunkRes = await getKnowledgeChunksAction(faqSource.id);
        if (chunkRes.success && chunkRes.chunks) {
          setFaqs(chunkRes.chunks as Chunk[]);
        }
      } else {
        setFaqs([]);
        setFaqSourceId(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'txt', 'md'].includes(ext || '')) {
      setErrorMsg('Unsupported format. Please upload PDF, DOCX, TXT, or MD.');
      return;
    }

    setUploadingFile(true);
    setUploadProgress('Reading file contents...');
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      setUploadProgress('Parsing and chunking into SQLite DB...');
      const response = await fetch('/api/knowledge-base/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setSuccessMsg(`Document "${file.name}" uploaded and parsed successfully!`);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setUploadingFile(false);
      setUploadProgress('');
      // reset file input
      e.target.value = '';
    }
  };

  const handleAddURL = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setSubmittingUrl(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Basic URL verification
      new URL(urlInput);
      
      const res = await addURLSourceAction(urlInput);
      if (res.success) {
        setSuccessMsg(`Scraped and indexed URL: ${urlInput}`);
        setUrlInput('');
        await loadData();
      } else {
        throw new Error(res.error || 'Scraping failed');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid URL or Scrape error.');
    } finally {
      setSubmittingUrl(false);
    }
  };

  const handleAddFAQ = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;

    setSubmittingFaq(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await createFAQEntryAction(faqQuestion.trim(), faqAnswer.trim());
      if (res.success) {
        setSuccessMsg('FAQ entry created successfully!');
        setFaqQuestion('');
        setFaqAnswer('');
        await loadData();
      } else {
        throw new Error(res.error || 'Failed to save FAQ.');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmittingFaq(false);
    }
  };

  const handleDeleteSource = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete source "${name}"? All associated RAG chunks will be permanently removed.`)) {
      return;
    }
    
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await deleteKnowledgeSourceAction(id);
      if (res.success) {
        setSuccessMsg(`Source deleted successfully.`);
        await loadData();
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      setErrorMsg('Delete failed: ' + err.message);
    }
  };

  const handleDeleteFAQ = async (chunkId: string) => {
    if (!confirm('Are you sure you want to delete this FAQ entry?')) {
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await deleteKnowledgeChunkAction(chunkId);
      if (res.success) {
        setSuccessMsg('FAQ entry deleted.');
        await loadData();
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      setErrorMsg('Delete failed: ' + err.message);
    }
  };

  // Helper for status badge styling
  const renderStatus = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ready
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Indexing
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200">
            {status}
          </span>
        );
    }
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredUrls = urls.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFaqs = faqs.filter(
    f => 
      (f.title?.toLowerCase().includes(searchQuery.toLowerCase()) || false) || 
      f.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      
      {/* Messages */}
      {successMsg && (
        <div className="flex items-center bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm shadow-sm transition-all duration-200">
          <CheckCircle2 className="w-4 h-4 mr-2 shrink-0 animate-bounce" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm shadow-sm transition-all duration-200">
          <AlertTriangle className="w-4 h-4 mr-2 shrink-0 animate-pulse" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 pb-px gap-2">
        <button
          onClick={() => { setActiveTab('documents'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'documents'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <FileText className="w-4 h-4" />
          Documents
          <span className="ml-1 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-normal">
            {files.length}
          </span>
        </button>
        <button
          onClick={() => { setActiveTab('urls'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'urls'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <Globe className="w-4 h-4" />
          Websites & URLs
          <span className="ml-1 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-normal">
            {urls.length}
          </span>
        </button>
        <button
          onClick={() => { setActiveTab('faqs'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'faqs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          Q&A / FAQs
          <span className="ml-1 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-normal">
            {faqs.length}
          </span>
        </button>
      </div>

      {/* Global Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder={`Search inside ${activeTab === 'documents' ? 'documents' : activeTab === 'urls' ? 'URLs' : 'FAQs'}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Form Panel */}
        <div className="lg:col-span-1 space-y-6">
          {activeTab === 'documents' && (
            <Card className="shadow-sm border border-gray-200">
              <CardHeader className="bg-gray-50/50 border-b pb-4">
                <CardTitle className="text-base font-bold text-gray-800">Upload Knowledge Files</CardTitle>
                <CardDescription className="text-xs">
                  Supported formats: PDF, DOCX, TXT, MD. (Max 10MB)
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-lg p-6 bg-gray-50/50 transition-colors relative group cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    onChange={handleFileUpload}
                    disabled={uploadingFile}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {uploadingFile ? (
                    <div className="flex flex-col items-center text-center space-y-2">
                      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      <span className="text-xs font-semibold text-gray-700">{uploadProgress}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center space-y-2">
                      <UploadCloud className="w-10 h-10 text-gray-400 group-hover:text-blue-500 transition-colors" />
                      <span className="text-xs font-semibold text-gray-700">Click or Drag & Drop</span>
                      <span className="text-[10px] text-gray-500">PDF, Word, or text files</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'urls' && (
            <Card className="shadow-sm border border-gray-200">
              <CardHeader className="bg-gray-50/50 border-b pb-4">
                <CardTitle className="text-base font-bold text-gray-800">Index Website URL</CardTitle>
                <CardDescription className="text-xs">
                  Scrape text body from any public URL and parse it as RAG context.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleAddURL} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 uppercase">Page URL</label>
                    <Input
                      type="url"
                      placeholder="https://example.com/pricing"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      required
                      className="bg-white"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={submittingUrl}
                    className="w-full bg-blue-600 hover:bg-blue-700 font-semibold"
                  >
                    {submittingUrl ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scraping & Parsing...
                      </>
                    ) : (
                      <>
                        Scrape & Index URL <ArrowRight className="w-4 h-4 ml-1.5" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {activeTab === 'faqs' && (
            <Card className="shadow-sm border border-gray-200">
              <CardHeader className="bg-gray-50/50 border-b pb-4">
                <CardTitle className="text-base font-bold text-gray-800">Add FAQ Entry</CardTitle>
                <CardDescription className="text-xs">
                  Create instant static Q&A pairs. Excellent for exact product questions.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleAddFAQ} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 uppercase">Question (Keyword Target)</label>
                    <Input
                      type="text"
                      placeholder="What are your hours?"
                      value={faqQuestion}
                      onChange={(e) => setFaqQuestion(e.target.value)}
                      required
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 uppercase">Answer (Response Content)</label>
                    <textarea
                      placeholder="We are open Mon-Fri from 9 AM to 6 PM EST."
                      value={faqAnswer}
                      onChange={(e) => setFaqAnswer(e.target.value)}
                      required
                      className="w-full min-h-[100px] bg-white border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-normal leading-relaxed resize-none"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={submittingFaq}
                    className="w-full bg-blue-600 hover:bg-blue-700 font-semibold"
                  >
                    {submittingFaq ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Adding...
                      </>
                    ) : (
                      <>
                        Add FAQ <Plus className="w-4 h-4 ml-1.5" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* RAG Help Card */}
          <Card className="bg-blue-50/40 border border-blue-100 shadow-none">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-blue-800 font-semibold text-xs">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>How does RAG work?</span>
              </div>
              <p className="text-[11px] leading-relaxed text-blue-700 font-normal">
                When a customer sends a message on WhatsApp, our platform automatically searches all active Documents, URLs, and FAQs matching key phrases.
                <br /><br />
                The matched context blocks are fed to the AI engine instantly, letting the bot answer organization-specific details securely without training custom models.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right Data Listing Panel */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 border rounded-lg bg-white">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
              <span className="text-sm text-gray-500">Loading knowledge assets...</span>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Documents Tab List */}
              {activeTab === 'documents' && (
                <div className="space-y-3">
                  {filteredFiles.length === 0 ? (
                    <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <h3 className="text-sm font-semibold text-gray-700">No Knowledge Files</h3>
                      <p className="text-xs text-gray-500 mt-1">Upload PDF, DOCX, or text documents to train the AI.</p>
                    </div>
                  ) : (
                    filteredFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-semibold text-sm text-gray-900 block truncate max-w-[280px]">
                              {file.name}
                            </span>
                            <span className="text-[10px] text-gray-400 block mt-0.5">
                              Uploaded {new Date(file.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {renderStatus(file.status)}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteSource(file.id, file.name)}
                            className="text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* URLs Tab List */}
              {activeTab === 'urls' && (
                <div className="space-y-3">
                  {filteredUrls.length === 0 ? (
                    <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
                      <Globe className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <h3 className="text-sm font-semibold text-gray-700">No Web Sources</h3>
                      <p className="text-xs text-gray-500 mt-1">Add website URLs to parse product pages and documentation.</p>
                    </div>
                  ) : (
                    filteredUrls.map((url) => (
                      <div
                        key={url.id}
                        className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 shrink-0">
                            <Globe className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-sm text-gray-900 block truncate max-w-[320px]">
                              {url.name}
                            </span>
                            <span className="text-[10px] text-gray-400 block mt-0.5 flex items-center gap-1">
                              Indexed {new Date(url.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {renderStatus(url.status)}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteSource(url.id, url.name)}
                            className="text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* FAQs Tab List */}
              {activeTab === 'faqs' && (
                <div className="space-y-3">
                  {filteredFaqs.length === 0 ? (
                    <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
                      <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <h3 className="text-sm font-semibold text-gray-700">No FAQ Entries</h3>
                      <p className="text-xs text-gray-500 mt-1">Create Q&A pairs for direct keyword matches.</p>
                    </div>
                  ) : (
                    filteredFaqs.map((faq) => (
                      <div
                        key={faq.id}
                        className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 inline-block text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase shrink-0">Q</span>
                            <h4 className="font-semibold text-sm text-gray-900 leading-tight">
                              {faq.title}
                            </h4>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteFAQ(faq.id)}
                            className="text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 -mt-1 -mr-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="flex items-start gap-2.5 border-t border-gray-50 pt-2.5">
                          <span className="mt-0.5 inline-block text-xs font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded uppercase shrink-0">A</span>
                          <p className="text-xs text-gray-600 leading-relaxed font-normal">
                            {faq.content}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

            </div>
          )}
        </div>

      </div>

    </div>
  );
}
