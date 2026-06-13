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
