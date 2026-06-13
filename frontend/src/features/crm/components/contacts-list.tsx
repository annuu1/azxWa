'use client';

import { useState } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Search, Plus, Filter, Tag, Check, Award, Eye, MessageSquare } from 'lucide-react';
import { convertContactToLead } from '../actions/crm-actions';

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

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search contacts by name, pushname, or WhatsApp ID..." 
            className="pl-9"
          />
        </div>
        
        {/* Tag filter selector */}
        <div className="flex items-center space-x-2 shrink-0">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            className="bg-white border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      <p className="font-semibold text-gray-900">{contact.name || contact.pushName || 'WhatsApp User'}</p>
                      {contact.name && contact.pushName && (
                        <p className="text-xs text-gray-400 italic">Pushname: {contact.pushName}</p>
                      )}
                    </div>
                  </td>
                  
                  {/* WhatsApp ID / Number */}
                  <td className="p-4 font-mono text-xs text-gray-600">
                    {contact.whatsappId}
                  </td>
                  
                  {/* Contact Tags */}
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags?.map((tag: any) => (
                        <span 
                          key={tag.id}
                          style={{ backgroundColor: `${tag.color}15`, color: tag.color, borderColor: `${tag.color}30` }}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
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
                        <Check className="w-3 h-3 mr-1" /> Qualified Lead
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
                      className="text-xs"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" /> Profile
                    </Button>
                    
                    {!contact.isLead && (
                      <Button 
                        size="sm" 
                        disabled={qualifyingId === contact.id}
                        onClick={() => handleQualifyLead(contact.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-xs text-white"
                      >
                        {qualifyingId === contact.id ? 'Qualifying...' : (
                          <>
                            <Award className="w-3.5 h-3.5 mr-1" /> Qualify
                          </>
                        )}
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
    </div>
  );
}
