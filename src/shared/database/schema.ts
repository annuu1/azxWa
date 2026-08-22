import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { v4 as uuidv4 } from 'uuid';

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey().$defaultFn(() => uuidv4()),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => uuidv4()),
  organizationId: text('organization_id').references(() => organizations.id),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: text('role', { enum: ['SUPER_ADMIN', 'ORG_ADMIN', 'AGENT'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const whatsappSessions = sqliteTable('whatsapp_sessions', {
  id: text('id').primaryKey().$defaultFn(() => uuidv4()),
  organizationId: text('organization_id').references(() => organizations.id).notNull(),
  sessionId: text('session_id').notNull().unique(),
  status: text('status').default('DISCONNECTED'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey().$defaultFn(() => uuidv4()),
  organizationId: text('organization_id').references(() => organizations.id).notNull(),
  whatsappId: text('whatsapp_id').notNull(),
  name: text('name'),
  pushName: text('push_name'),
  isGroup: integer('is_group', { mode: 'boolean' }).default(false),
  aiEnabled: integer('ai_enabled', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const pipelines = sqliteTable('pipelines', {
  id: text('id').primaryKey().$defaultFn(() => uuidv4()),
  organizationId: text('organization_id').references(() => organizations.id).notNull(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const pipelineStages = sqliteTable('pipeline_stages', {
  id: text('id').primaryKey().$defaultFn(() => uuidv4()),
  pipelineId: text('pipeline_id').references(() => pipelines.id).notNull(),
  name: text('name').notNull(),
  position: integer('position').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const leads = sqliteTable('leads', {
  id: text('id').primaryKey().$defaultFn(() => uuidv4()),
  organizationId: text('organization_id').references(() => organizations.id).notNull(),
  contactId: text('contact_id').references(() => contacts.id).notNull(),
  status: text('status', { enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'] }).default('NEW'),
  stageId: text('stage_id').references(() => pipelineStages.id),
  assignedUserId: text('assigned_user_id').references(() => users.id),
  source: text('source'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey().$defaultFn(() => uuidv4()),
  organizationId: text('organization_id').references(() => organizations.id).notNull(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#3b82f6'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const contactTags = sqliteTable('contact_tags', {
  contactId: text('contact_id').references(() => contacts.id).notNull(),
  tagId: text('tag_id').references(() => tags.id).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.contactId, table.tagId] })
}));

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey().$defaultFn(() => uuidv4()),
  organizationId: text('organization_id').references(() => organizations.id).notNull(),
  contactId: text('contact_id').references(() => contacts.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const activities = sqliteTable('activities', {
  id: text('id').primaryKey().$defaultFn(() => uuidv4()),
  organizationId: text('organization_id').references(() => organizations.id).notNull(),
  contactId: text('contact_id').references(() => contacts.id).notNull(),
  type: text('type').notNull(), // 'MESSAGE_RECEIVED', 'MESSAGE_SENT', 'NOTE_ADDED', 'LEAD_STAGE_CHANGED', 'LEAD_ASSIGNED', 'CONVERTED'
  description: text('description').notNull(),
  userId: text('user_id').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const campaigns = sqliteTable('campaigns', {
  id: text('id').primaryKey().$defaultFn(() => uuidv4()),
  organizationId: text('organization_id').references(() => organizations.id).notNull(),
  name: text('name').notNull(),
  messageTemplate: text('message_template').notNull(),
  targetTagId: text('target_tag_id').references(() => tags.id),
  sessionId: text('session_id').notNull(),
  scheduledAt: integer('scheduled_at', { mode: 'timestamp' }),
  status: text('status', { enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PAUSED', 'CANCELLED'] }).default('PENDING').notNull(),
  minDelay: integer('min_delay').default(5).notNull(),
  maxDelay: integer('max_delay').default(20).notNull(),
  minBatchDelay: integer('min_batch_delay').default(30).notNull(),
  maxBatchDelay: integer('max_batch_delay').default(120).notNull(),
  minBatchSize: integer('min_batch_size').default(35).notNull(),
  maxBatchSize: integer('max_batch_size').default(50).notNull(),
  mediaUrl: text('media_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const queueJobs = sqliteTable('queue_jobs', {
  id: text('id').primaryKey().$defaultFn(() => uuidv4()),
  organizationId: text('organization_id').references(() => organizations.id).notNull(),
  campaignId: text('campaign_id').references(() => campaigns.id),
  sessionId: text('session_id').notNull(),
  recipientWhatsappId: text('recipient_whatsapp_id').notNull(),
  message: text('message').notNull(),
  status: text('status', { enum: ['PENDING', 'PROCESSING', 'SENT', 'FAILED'] }).default('PENDING').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  maxAttempts: integer('max_attempts').default(3).notNull(),
  error: text('error'),
  scheduledFor: integer('scheduled_for', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  mediaUrl: text('media_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const templates = sqliteTable('templates', {
  id: text('id').primaryKey().$defaultFn(() => uuidv4()),
  organizationId: text('organization_id').references(() => organizations.id).notNull(),
  name: text('name').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const aiSettings = sqliteTable('ai_settings', {
  id: text('id').primaryKey().$defaultFn(() => uuidv4()),
  organizationId: text('organization_id').references(() => organizations.id).notNull().unique(),
  enabled: integer('enabled', { mode: 'boolean' }).default(false).notNull(),
  provider: text('provider').default('groq').notNull(), // 'groq' | 'openrouter'
  model: text('model').default('llama-3.8b-instant').notNull(),
  apiKey: text('api_key'),
  systemPrompt: text('system_prompt').default('You are a helpful customer engagement and sales assistant. Keep your responses concise, helpful, and friendly.').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const knowledgeSources = sqliteTable('knowledge_sources', {
  id: text('id').primaryKey().$defaultFn(() => uuidv4()),
  organizationId: text('organization_id').references(() => organizations.id).notNull(),
  name: text('name').notNull(),
  type: text('type').default('FILE').notNull(), // 'FILE' | 'URL' | 'FAQ'
  status: text('status').default('COMPLETED').notNull(), // 'PROCESSING' | 'COMPLETED' | 'FAILED'
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const knowledgeChunks = sqliteTable('knowledge_chunks', {
  id: text('id').primaryKey().$defaultFn(() => uuidv4()),
  organizationId: text('organization_id').references(() => organizations.id).notNull(),
  sourceId: text('source_id').references(() => knowledgeSources.id, { onDelete: 'cascade' }).notNull(),
  title: text('title'), // e.g. section title, page name, or FAQ question
  content: text('content').notNull(), // chunk text or FAQ answer
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const workflows = sqliteTable('workflows', {
  id: text('id').primaryKey().$defaultFn(() => uuidv4()),
  organizationId: text('organization_id').references(() => organizations.id).notNull(),
  name: text('name').notNull(),
  triggerType: text('trigger_type').notNull(), // 'MESSAGE_RECEIVED' | 'LEAD_CREATED' | 'LEAD_UPDATED' | 'CAMPAIGN_COMPLETED'
  enabled: integer('enabled', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const workflowNodes = sqliteTable('workflow_nodes', {
  id: text('id').primaryKey().$defaultFn(() => uuidv4()),
  workflowId: text('workflow_id').references(() => workflows.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull(), // 'TRIGGER' | 'CONDITION' | 'ACTION'
  nodeType: text('node_type').notNull(), // e.g. 'contains_text', 'has_tag', 'send_message', 'add_tag', 'assign_user'
  config: text('config').notNull(), // JSON config parameters
  x: integer('x').default(0).notNull(),
  y: integer('y').default(0).notNull(),
});

export const workflowEdges = sqliteTable('workflow_edges', {
  id: text('id').primaryKey().$defaultFn(() => uuidv4()),
  workflowId: text('workflow_id').references(() => workflows.id, { onDelete: 'cascade' }).notNull(),
  sourceNodeId: text('source_node_id').notNull(),
  targetNodeId: text('target_node_id').notNull(),
  sourceHandle: text('source_handle'), // e.g. 'true' or 'false'
});

export const workflowLogs = sqliteTable('workflow_logs', {
  id: text('id').primaryKey().$defaultFn(() => uuidv4()),
  organizationId: text('organization_id').references(() => organizations.id).notNull(),
  workflowId: text('workflow_id').references(() => workflows.id, { onDelete: 'cascade' }).notNull(),
  contactId: text('contact_id').references(() => contacts.id),
  status: text('status').notNull(), // 'SUCCESS' | 'FAILED'
  details: text('details'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
