'use client';

import { useState } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { 
  Search, 
  Plus, 
  Filter, 
  Tag, 
  Check, 
  Award, 
  Eye, 
  MessageSquare,
  UserPlus,
  RefreshCw,
  X,
  Layers
} from 'lucide-react';
import { 
  convertContactToLead, 
  createManualContactAndLead, 
  convertAllContactsToLeads 
} from '../actions/crm-actions';

interface ContactsListProps {
  contacts: any[];
  allTags: any[];
  onSelectContact: (id: string) => void;
  onUpdate: () => void;
}

export default function ContactsList({ 
  contacts, 
  allTags, 
  onSelectContact, 
  onUpdate 
}: ContactsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTagId, setSelectedTagId] = useState<string>('all');
  const [qualifyingId, setQualifyingId] = useState<string | null>(null);
  const [convertingAll, setConvertingAll] = useState(false);

  // Add Contact Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [addToPipeline, setAddToPipeline] = useState(true);
  const [savingContact, setSavingContact] = useState(false);

  // Filter contacts based on search query and tag selection
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = 
      (contact.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.pushName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.whatsappId || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTag = 
      selectedTagId === 'all' || 
      contact.tags?.some((t: any) => t.id === selectedTagId);

    return matchesSearch && matchesTag;
  });

  const unqualifiedCount = contacts.filter(c => !c.isLead).length;

  const handleQualifyLead = async (contactId: string) => {
    setQualifyingId(contactId);
    try {
      const result = await convertContactToLead(contactId);
      if (result.success) {
        onUpdate();
      }
    } finally {
      setQualifyingId(null);
    }
  };

  const handleConvertAll = async () => {
    setConvertingAll(true);
    try {
      const result = await convertAllContactsToLeads();
      if (result.success) {
        onUpdate();
      }
    } finally {
      setConvertingAll(false);
    }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone.trim()) return;

    setSavingContact(true);
    try {
      const res = await createManualContactAndLead({
        name: newName.trim() || newPhone.trim(),
        phone: newPhone.trim(),
      });
      if (res.success) {
        setShowAddModal(false);
        setNewName('');
        setNewPhone('');
        onUpdate();
      }
    } finally {
      setSavingContact(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search contacts by name, pushname, or WhatsApp ID..." 
              className="pl-9 h-9 text-xs"
            />
          </div>
          
          {/* Tag filter selector */}
          <div className="flex items-center space-x-2 shrink-0">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              className="bg-white border rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 h-9"
              value={selectedTagId}
              onChange={(e) => setSelectedTagId(e.target.value)}
            >
              <option value="all">All Tags</option>
              {allTags.map(tag => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {unqualifiedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleConvertAll}
              disabled={convertingAll}
              className="text-xs h-9 font-medium text-blue-700 bg-blue-50/50 border-blue-200 hover:bg-blue-100"
            >
              {convertingAll ? (
                <RefreshCw className="animate-spin w-3.5 h-3.5 mr-1.5" />
              ) : (
                <Layers className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
              )}
              Add All ({unqualifiedCount}) to Pipeline
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Directory Grid */}
      <div className="border rounded-lg bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-gray-50 border-b text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-4">Contact</th>
                <th className="p-4">WhatsApp ID</th>
                <th className="p-4">Tags</th>
                <th className="p-4">Lead Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50/50 transition-colors">
                  {/* Name and Push Name */}
                  <td className="p-4">
                    <div>
                      <p className="font-semibold text-gray-900 text-xs sm:text-sm">
                        {contact.name || contact.pushName || 'WhatsApp User'}
                      </p>
                      {contact.name && contact.pushName && (
                        <p className="text-[11px] text-gray-400 italic">Pushname: {contact.pushName}</p>
                      )}
                    </div>
                  </td>
                  
                  {/* WhatsApp ID / Number */}
                  <td className="p-4 font-mono text-xs text-gray-600">
                    {contact.whatsappId ? contact.whatsappId.replace('@c.us', '') : '-'}
                  </td>
                  
                  {/* Contact Tags */}
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags?.map((tag: any) => (
                        <span 
                          key={tag.id}
                          style={{ backgroundColor: `${tag.color}15`, color: tag.color, borderColor: `${tag.color}30` }}
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border"
                        >
                          {tag.name}
                        </span>
                      ))}
                      {(!contact.tags || contact.tags.length === 0) && (
                        <span className="text-xs text-gray-400 italic">No tags</span>
                      )}
                    </div>
                  </td>
                  
                  {/* Active Lead Qualification status */}
                  <td className="p-4">
                    {contact.isLead ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                        <Check className="w-3 h-3 mr-1" /> Deal / Lead
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border">
                        Contact Only
                      </span>
                    )}
                  </td>
                  
                  {/* Action Buttons */}
                  <td className="p-4 text-right space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => onSelectContact(contact.id)}
                      className="text-xs h-7"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" /> Profile
                    </Button>
                    
                    {!contact.isLead && (
                      <Button 
                        size="sm" 
                        disabled={qualifyingId === contact.id}
                        onClick={() => handleQualifyLead(contact.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-xs text-white h-7"
                      >
                        {qualifyingId === contact.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <Award className="w-3.5 h-3.5 mr-1" />
                        )}
                        Add to Pipeline
                      </Button>
                    )}
                  </td>
                </tr>
              ))}

              {filteredContacts.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-gray-400 italic">
                    No contacts match the criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm">Add New Contact</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowAddModal(false)}
                className="h-7 w-7 text-gray-400 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateContact} className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Contact Name</label>
                <Input
                  placeholder="e.g. Rahul Sharma, Acme Corp"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="text-xs h-8"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Phone / WhatsApp Number</label>
                <Input
                  placeholder="e.g. 919876543210"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="text-xs h-8"
                  required
                />
                <span className="text-[10px] text-gray-400">Include country code without '+' or spaces</span>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="add-pipeline-check"
                  checked={addToPipeline}
                  onChange={(e) => setAddToPipeline(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="add-pipeline-check" className="text-gray-700 cursor-pointer">
                  Automatically add to Deals Pipeline (Stage: New)
                </label>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingContact}
                  className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {savingContact ? <RefreshCw className="animate-spin w-3.5 h-3.5 mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                  Save Contact
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
