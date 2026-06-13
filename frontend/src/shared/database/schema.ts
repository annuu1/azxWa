import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
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

export const leads = sqliteTable('leads', {
  id: text('id').primaryKey().$defaultFn(() => uuidv4()),
  organizationId: text('organization_id').references(() => organizations.id).notNull(),
  contactId: text('contact_id').references(() => contacts.id).notNull(),
  status: text('status', { enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'] }).default('NEW'),
  source: text('source'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
