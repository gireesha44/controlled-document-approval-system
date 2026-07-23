import { db, initDb } from './index';
import { users, documents, auditLogs } from './schema';
import { eq } from 'drizzle-orm';

export const SEEDED_USERS = [
  {
    id: 'usr_alice',
    email: 'alice@example.com',
    name: 'Alice Johnson',
    role: 'author' as const,
  },
  {
    id: 'usr_bob',
    email: 'bob@example.com',
    name: 'Bob Smith',
    role: 'reviewer' as const,
  },
  {
    id: 'usr_admin',
    email: 'admin@example.com',
    name: 'System Admin',
    role: 'admin' as const,
  },
  {
    id: 'usr_viewer',
    email: 'viewer@example.com',
    name: 'Valerie Viewer',
    role: 'viewer' as const,
  },
];

export function seed() {
  initDb();

  // Clear existing data
  db.delete(auditLogs).run();
  db.delete(documents).run();
  db.delete(users).run();

  // Insert Users
  for (const u of SEEDED_USERS) {
    db.insert(users).values(u).run();
  }

  const now = new Date().toISOString();

  // Seed sample documents representing each state for quick verification
  const sampleDocs = [
    {
      id: 'doc_1',
      title: 'Q3 Financial & System Security Compliance Report',
      body: 'This document details the quarterly audit of security procedures, identity governance, and access logs across regional data centers.',
      status: 'published' as const,
      authorId: 'usr_alice',
      version: 3,
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      updatedAt: now,
    },
    {
      id: 'doc_2',
      title: 'API Version 2.0 Architectural Specification',
      body: 'Proposal for migrating core API endpoints to gRPC/REST hybrid with strict OpenAPI schemas and rate limits.',
      status: 'submitted' as const,
      authorId: 'usr_alice',
      version: 2,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      updatedAt: now,
    },
    {
      id: 'doc_3',
      title: 'Draft: Employee Remote Work Guidelines 2026',
      body: 'Initial proposal for updating remote work allowances and equipment stipend guidelines for remote engineers.',
      status: 'draft' as const,
      authorId: 'usr_alice',
      version: 1,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: now,
    },
    {
      id: 'doc_4',
      title: 'Database Failover & Recovery Protocol',
      body: 'Standard Operating Procedure (SOP) for automated database failover across multi-region read replicas.',
      status: 'approved' as const,
      authorId: 'usr_alice',
      version: 3,
      createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      updatedAt: now,
    },
  ];

  for (const doc of sampleDocs) {
    db.insert(documents).values(doc).run();
  }

  // Seed Audit Logs for sample documents
  const sampleAuditLogs = [
    // doc_1 audit history
    {
      id: 'log_101',
      documentId: 'doc_1',
      actorId: 'usr_alice',
      action: 'CREATED',
      previousStatus: null,
      newStatus: 'draft',
      comment: 'Initial draft created',
      timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: 'log_102',
      documentId: 'doc_1',
      actorId: 'usr_alice',
      action: 'SUBMITTED',
      previousStatus: 'draft',
      newStatus: 'submitted',
      comment: 'Submitted for quarterly review',
      timestamp: new Date(Date.now() - 86400000 * 4).toISOString(),
    },
    {
      id: 'log_103',
      documentId: 'doc_1',
      actorId: 'usr_bob',
      action: 'APPROVED',
      previousStatus: 'submitted',
      newStatus: 'approved',
      comment: 'Reviewed and verified security controls',
      timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: 'log_104',
      documentId: 'doc_1',
      actorId: 'usr_admin',
      action: 'PUBLISHED',
      previousStatus: 'approved',
      newStatus: 'published',
      comment: 'Published to public compliance registry',
      timestamp: now,
    },

    // doc_2 audit history
    {
      id: 'log_201',
      documentId: 'doc_2',
      actorId: 'usr_alice',
      action: 'CREATED',
      previousStatus: null,
      newStatus: 'draft',
      comment: 'Created architecture proposal draft',
      timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'log_202',
      documentId: 'doc_2',
      actorId: 'usr_alice',
      action: 'SUBMITTED',
      previousStatus: 'draft',
      newStatus: 'submitted',
      comment: 'Ready for architecture team review',
      timestamp: new Date(Date.now() - 86400000 * 1).toISOString(),
    },

    // doc_3 audit history
    {
      id: 'log_301',
      documentId: 'doc_3',
      actorId: 'usr_alice',
      action: 'CREATED',
      previousStatus: null,
      newStatus: 'draft',
      comment: 'Initial draft started',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
    },

    // doc_4 audit history
    {
      id: 'log_401',
      documentId: 'doc_4',
      actorId: 'usr_alice',
      action: 'CREATED',
      previousStatus: null,
      newStatus: 'draft',
      comment: 'Created failover protocol draft',
      timestamp: new Date(Date.now() - 86400000 * 4).toISOString(),
    },
    {
      id: 'log_402',
      documentId: 'doc_4',
      actorId: 'usr_alice',
      action: 'SUBMITTED',
      previousStatus: 'draft',
      newStatus: 'submitted',
      comment: 'Submitted for lead reviewer approval',
      timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: 'log_403',
      documentId: 'doc_4',
      actorId: 'usr_bob',
      action: 'APPROVED',
      previousStatus: 'submitted',
      newStatus: 'approved',
      comment: 'Approved SOP procedures',
      timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ];

  for (const log of sampleAuditLogs) {
    db.insert(auditLogs).values(log).run();
  }

  console.log('Successfully seeded database with users, documents, and audit logs.');
}

if (require.main === module) {
  seed();
}
