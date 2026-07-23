import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role', { enum: ['author', 'reviewer', 'admin', 'viewer'] }).notNull(),
});

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  status: text('status', {
    enum: ['draft', 'submitted', 'approved', 'rejected', 'published', 'archived'],
  }).notNull().default('draft'),
  authorId: text('author_id').notNull().references(() => users.id),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull().references(() => documents.id),
  actorId: text('actor_id').notNull().references(() => users.id),
  action: text('action').notNull(), // e.g. 'CREATED', 'UPDATED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PUBLISHED', 'ARCHIVED', 'REOPENED'
  previousStatus: text('previous_status'),
  newStatus: text('new_status'),
  comment: text('comment'),
  timestamp: text('timestamp').notNull(),
});

export type User = typeof users.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

export type Role = 'author' | 'reviewer' | 'admin' | 'viewer';
export type DocumentStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'published' | 'archived';
