'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { RefreshCw, Users, Layers, Tag, Plus, PlusCircle } from 'lucide-react';
import { getOrgContacts, getPipelineData, getOrgAgents, getOrgTags, createOrgTag } from '../actions/crm-actions';
import ContactsList from './contacts-list';
import PipelineBoard from './pipeline-board';
import ContactDetailsModal from './contact-details-modal';

export default function CRMDashboard() {
  const [activeTab, setActiveTab] = useState<'contacts' | 'pipeline' | 'tags'>('contacts');
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<any[]>([]);
  const [pipeline, setPipeline] = useState<any>({ stages: [], leads: [] });
  const [agents, setAgents] = useState<any[]>([]);
  const [tagsList, setTagsList] = useState<any[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  // Create Tag Form State
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [creatingTag, setCreatingTag] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [contactsData, pipelineData, agentsData, tagsData] = await Promise.all([
        getOrgContacts(),
        getPipelineData(),
        getOrgAgents(),
        getOrgTags(),
      ]);

      if (contactsData.success) setContacts(contactsData.contacts || []);
      if (pipelineData.success) setPipeline(pipelineData);
      if (agentsData.success) setAgents(agentsData.agents || []);
      if (tagsData.success) setTagsList(tagsData.tags || []);
    } catch (err) {
      console.error('Failed to load CRM dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    setCreatingTag(true);
    try {
      const result = await createOrgTag(newTagName, newTagColor);
      if (result.success) {
        setNewTagName('');
        await fetchData();
      }
    } finally {
      setCreatingTag(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header and Refresh Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead & Contacts CRM</h1>
          <p className="text-sm text-gray-500">Manage client relationships, track pipeline stages, and assign tasks to agents</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchData} 
          disabled={loading}
          className="bg-white border-gray-200"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh CRM Data
        </Button>
      </div>

      {/* Tab Selectors */}
      <div className="flex border-b border-gray-200 pb-0.5 space-x-6">
        <button
          onClick={() => setActiveTab('contacts')}
          className={`flex items-center pb-3 text-sm font-semibold border-b-2 transition-all px-1 ${activeTab === 'contacts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
        >
          <Users className="w-4 h-4 mr-2" /> Contacts Directory
        </button>
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`flex items-center pb-3 text-sm font-semibold border-b-2 transition-all px-1 ${activeTab === 'pipeline' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
        >
          <Layers className="w-4 h-4 mr-2" /> Deals Pipeline
        </button>
        <button
          onClick={() => setActiveTab('tags')}
          className={`flex items-center pb-3 text-sm font-semibold border-b-2 transition-all px-1 ${activeTab === 'tags' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
        >
          <Tag className="w-4 h-4 mr-2" /> Contact Tags
        </button>
      </div>

      {/* Tab Panels */}
      {loading && !selectedContactId ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-500 font-medium">Syncing database records...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeTab === 'contacts' && (
            <ContactsList 
              contacts={contacts} 
              allTags={tagsList} 
              onSelectContact={setSelectedContactId}
              onUpdate={fetchData}
            />
          )}

          {activeTab === 'pipeline' && (
            <PipelineBoard 
              stages={pipeline.stages} 
              leads={pipeline.leads} 
              agents={agents}
              onSelectContact={setSelectedContactId}
              onUpdate={fetchData}
            />
          )}

          {activeTab === 'tags' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Create Tag Card */}
              <Card className="border bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Create New Tag</CardTitle>
                  <CardDescription>Classify contacts and leads for segmenting filters</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateTag} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Tag Name</label>
                      <Input 
                        value={newTagName} 
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="e.g. Hot Lead, Retail, Inactive" 
                        required 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600 block">Tag Color</label>
                      <div className="flex items-center space-x-3">
                        <input 
                          type="color" 
                          value={newTagColor}
                          onChange={(e) => setNewTagColor(e.target.value)}
                          className="w-10 h-10 border rounded cursor-pointer p-0 shrink-0"
                        />
                        <span className="text-xs font-mono text-gray-500 uppercase">{newTagColor}</span>
                      </div>
                    </div>
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={creatingTag}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Create Tag
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Tags List Card */}
              <Card className="md:col-span-2 border bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">All Registered Tags</CardTitle>
                  <CardDescription>Currently configured tags in your organization</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {tagsList.map((tag) => (
                      <span 
                        key={tag.id}
                        style={{ backgroundColor: `${tag.color}15`, color: tag.color, borderColor: `${tag.color}35` }}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border"
                      >
                        <span style={{ backgroundColor: tag.color }} className="w-2.5 h-2.5 rounded-full mr-2 shrink-0" />
                        {tag.name}
                      </span>
                    ))}
                    {tagsList.length === 0 && (
                      <p className="text-sm text-gray-400 italic py-6">No tags created yet. Create one on the left.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Slide-out details modal */}
      {selectedContactId && (
        <ContactDetailsModal 
          contactId={selectedContactId} 
          onClose={() => setSelectedContactId(null)}
          onUpdate={fetchData}
          agents={agents}
          allTags={tagsList}
        />
      )}
    </div>
  );
}
