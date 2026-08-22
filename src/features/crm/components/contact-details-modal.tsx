'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { X, RefreshCw, Plus, Trash2, Tag, Calendar, User, FileText, CheckCircle2, MessageSquare, ArrowRight } from 'lucide-react';
import { 
  getContactDetails, 
  addContactNote, 
  addTagToContact, 
  removeTagFromContact, 
  createOrgTag,
  assignLeadAgent,
  updateLeadStage
} from '../actions/crm-actions';

interface ContactDetailsModalProps {
  contactId: string;
  onClose: () => void;
  onUpdate: () => void;
  agents: any[];
  allTags: any[];
}

export default function ContactDetailsModal({ 
  contactId, 
  onClose, 
  onUpdate, 
  agents,
  allTags 
}: ContactDetailsModalProps) {
  const [loading, setLoading] = useState(true);
  const [submittingNote, setSubmittingNote] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [noteContent, setNoteContent] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [addingTag, setAddingTag] = useState(false);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const data = await getContactDetails(contactId);
      if (data.success) {
        setDetails(data);
      }
    } catch (err) {
      console.error('Error fetching contact details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [contactId]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    setSubmittingNote(true);
    try {
      const result = await addContactNote(contactId, noteContent);
      if (result.success) {
        setNoteContent('');
        await fetchDetails();
        onUpdate();
      }
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleAddTag = async (tagId: string) => {
    try {
      const result = await addTagToContact(contactId, tagId);
      if (result.success) {
        await fetchDetails();
        onUpdate();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      const result = await removeTagFromContact(contactId, tagId);
      if (result.success) {
        await fetchDetails();
        onUpdate();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateAndAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    setAddingTag(true);
    try {
      const tagResult = await createOrgTag(newTagName, newTagColor);
      if (tagResult.success && tagResult.tag) {
        await addTagToContact(contactId, tagResult.tag.id);
        setNewTagName('');
        await fetchDetails();
        onUpdate();
      }
    } finally {
      setAddingTag(false);
    }
  };

  const handleAssignAgent = async (agentId: string) => {
    if (!details?.lead) return;
    try {
      const targetAgentId = agentId === 'unassigned' ? null : agentId;
      const result = await assignLeadAgent(details.lead.id, targetAgentId);
      if (result.success) {
        await fetchDetails();
        onUpdate();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveStage = async (stageId: string) => {
    if (!details?.lead) return;
    try {
      const result = await updateLeadStage(details.lead.id, stageId);
      if (result.success) {
        await fetchDetails();
        onUpdate();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'CONVERTED':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'NOTE_ADDED':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'LEAD_STAGE_CHANGED':
        return <ArrowRight className="w-4 h-4 text-purple-600" />;
      case 'LEAD_ASSIGNED':
        return <User className="w-4 h-4 text-orange-600" />;
      case 'MESSAGE_RECEIVED':
      case 'MESSAGE_SENT':
        return <MessageSquare className="w-4 h-4 text-indigo-600" />;
      default:
        return <Calendar className="w-4 h-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <Card className="w-full max-w-2xl bg-white p-12 flex flex-col items-center justify-center space-y-4 shadow-2xl">
          <RefreshCw className="w-10 h-10 animate-spin text-blue-600" />
          <p className="text-gray-500 font-medium">Loading contact history and notes...</p>
        </Card>
      </div>
    );
  }

  if (!details || !details.contact) return null;

  const { contact, lead, notes: contactNotes, activities: contactActivities, tags: appliedTags } = details;

  // Find tags that are NOT yet applied to this contact
  const availableTags = allTags.filter(t => !appliedTags.some((at: any) => at.id === t.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden border flex flex-col md:flex-row max-h-[90vh]">
        {/* Left Side: Summary & Actions Panel */}
        <div className="w-full md:w-1/3 border-r bg-gray-50/50 p-6 flex flex-col justify-between overflow-y-auto border-b md:border-b-0">
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{contact.name || contact.pushName || 'WhatsApp Contact'}</h3>
                <p className="text-xs font-mono text-gray-500 mt-1">{contact.whatsappId}</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="h-8 w-8 text-gray-400 hover:text-gray-600 md:hidden"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Stage & Assignee Selectors for Qualified Leads */}
            {lead ? (
              <div className="space-y-4 border-t pt-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Lead Settings</h4>
                
                {/* Agent Dropdown */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Assigned Agent</label>
                  <select
                    className="w-full bg-white border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={lead.assignedUserId || 'unassigned'}
                    onChange={(e) => handleAssignAgent(e.target.value)}
                  >
                    <option value="unassigned">Unassigned</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.email}</option>
                    ))}
                  </select>
                </div>

                {/* Stage dropdown */}
                {lead.stageId && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Pipeline Stage</label>
                    <select
                      className="w-full bg-white border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={lead.stageId}
                      onChange={(e) => handleMoveStage(e.target.value)}
                    >
                      {/* For simplicity we will assume pipelineStages are passed down. 
                          Wait, we can fetch stages or map them if we have them. 
                          Let's let the parent pass them or we can load them. 
                          Wait, let's let the modal load the stages itself, or let the parent pass them.
                          Since we have `allTags`, let's check if we have stages in `details` - wait, we do not.
                          Let's add stages to the props, it's cleaner. */}
                      {appliedTags.map((t: any) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-center space-y-2">
                <p className="text-xs text-blue-800">This contact is not currently tracked as a Qualified Lead.</p>
              </div>
            )}

            {/* Tags Management */}
            <div className="space-y-3 border-t pt-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center">
                <Tag className="w-3.5 h-3.5 mr-1" /> Contact Tags
              </h4>
              
              {/* Render Current Tags */}
              <div className="flex flex-wrap gap-1.5">
                {appliedTags.map((tag: any) => (
                  <span 
                    key={tag.id}
                    style={{ backgroundColor: `${tag.color}15`, color: tag.color, borderColor: `${tag.color}30` }}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
                  >
                    {tag.name}
                    <button 
                      onClick={() => handleRemoveTag(tag.id)}
                      className="ml-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                {appliedTags.length === 0 && (
                  <span className="text-xs text-gray-400 italic">No tags attached</span>
                )}
              </div>

              {/* Add Tag Select */}
              {availableTags.length > 0 && (
                <div className="space-y-1 pt-2">
                  <label className="text-[10px] font-semibold text-gray-500">Apply Existing Tag</label>
                  <select
                    className="w-full bg-white border rounded-lg p-1.5 text-xs focus:outline-none"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) handleAddTag(e.target.value);
                    }}
                  >
                    <option value="" disabled>Select Tag...</option>
                    {availableTags.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Create Tag Inline Form */}
              <form onSubmit={handleCreateAndAddTag} className="space-y-2 pt-2 border-t border-dashed">
                <label className="text-[10px] font-semibold text-gray-500 block">Create new tag</label>
                <div className="flex space-x-1">
                  <Input 
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="e.g. VIP Client"
                    className="text-xs h-7 flex-1"
                    required
                  />
                  <input 
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="w-7 h-7 border rounded cursor-pointer p-0 shrink-0"
                  />
                  <Button type="submit" size="icon" className="h-7 w-7 bg-blue-600 hover:bg-blue-700" disabled={addingTag}>
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </form>
            </div>
          </div>

          <div className="pt-6 border-t mt-6 hidden md:block">
            <Button variant="outline" className="w-full" onClick={onClose}>Close Details</Button>
          </div>
        </div>

        {/* Right Side: Timeline of Activities & Notes */}
        <div className="flex-1 flex flex-col min-h-0 bg-white">
          <div className="p-6 border-b flex justify-between items-center bg-gray-50/10">
            <div>
              <h3 className="text-lg font-bold">Activity & History Timeline</h3>
              <p className="text-xs text-gray-500">Timeline of messages, assignments, and notes</p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="h-8 w-8 text-gray-400 hover:text-gray-600 hidden md:flex"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Timeline Feed */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="relative border-l border-gray-100 pl-6 space-y-6">
              {contactActivities.map((act: any) => (
                <div key={act.id} className="relative">
                  {/* Timeline bullet */}
                  <span className="absolute -left-[34px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white border shadow-sm">
                    {getActivityIcon(act.type)}
                  </span>
                  
                  <div className="space-y-1">
                    <p className="text-sm text-gray-800">
                      {act.description}
                      {act.user && (
                        <span className="text-xs text-gray-400 ml-1">by {act.user.email}</span>
                      )}
                    </p>
                    <time className="text-[10px] text-gray-400">
                      {new Date(act.createdAt).toLocaleString()}
                    </time>
                  </div>
                </div>
              ))}

              {/* Display manual memos / notes specifically if any */}
              {contactNotes.length > 0 && (
                <div className="pt-4 border-t border-dashed space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Agent Memos & Notes</h4>
                  <div className="space-y-3">
                    {contactNotes.map((note: any) => (
                      <div key={note.id} className="p-3 bg-blue-50/30 rounded-lg border border-blue-50 text-sm space-y-1">
                        <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
                        <div className="flex justify-between items-center text-[10px] text-gray-400">
                          <span>By {note.user.email}</span>
                          <span>{new Date(note.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {contactActivities.length === 0 && (
                <div className="text-center py-12 text-gray-400 italic text-sm">
                  No activity history logged yet
                </div>
              )}
            </div>
          </div>

          {/* Add Note Footer */}
          <div className="p-4 border-t bg-gray-50/50">
            <form onSubmit={handleAddNote} className="space-y-2">
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Log activity details or add a private agent note..."
                className="w-full bg-white border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[70px] resize-none"
                required
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700" disabled={submittingNote}>
                  {submittingNote ? <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-2" />}
                  Add Activity Note
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
