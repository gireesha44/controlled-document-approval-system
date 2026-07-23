import { db, rawDb } from '../db';
import { users, documents, auditLogs, User, Document, AuditLog, DocumentStatus, Role } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { crypto } from 'node:crypto';

// Custom Typed Domain Errors
export class DomainError extends Error {
  constructor(message: string, public statusCode: number = 400, public code: string = 'DOMAIN_ERROR') {
    super(message);
    this.name = 'DomainError';
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string = 'Permission denied for this action') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class InvalidTransitionError extends DomainError {
  constructor(fromStatus: DocumentStatus, toStatus: DocumentStatus) {
    super(`Invalid state transition from '${fromStatus}' to '${toStatus}'.`, 422, 'INVALID_TRANSITION');
    this.name = 'InvalidTransitionError';
  }
}

export class ConcurrencyConflictError extends DomainError {
  constructor(currentVersion: number, expectedVersion: number) {
    super(
      `Concurrency Conflict: The document has been updated by another user (current version: v${currentVersion}, your page version: v${expectedVersion}). Please refresh to review the latest changes.`,
      409,
      'CONCURRENCY_CONFLICT'
    );
    this.name = 'ConcurrencyConflictError';
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string = 'Document') {
    super(`${entity} not found.`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

// Helper to generate unique IDs
function generateId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${Date.now()}_${rand}`;
}

// Helper to fetch user actor or throw
function getActor(actorId: string): User {
  if (!actorId) throw new UnauthorizedError();
  const user = db.select().from(users).where(eq(users.id, actorId)).get();
  if (!user) throw new UnauthorizedError(`User with ID '${actorId}' not found.`);
  return user;
}

// Helper to fetch document or throw
function getDoc(documentId: string): Document {
  const doc = db.select().from(documents).where(eq(documents.id, documentId)).get();
  if (!doc) throw new NotFoundError('Document');
  return doc;
}

/**
 * Story 1 & Document Listing Guard
 * Viewers can ONLY see published documents.
 */
export function getDocumentsForUser(actorId: string) {
  const actor = getActor(actorId);

  if (actor.role === 'viewer') {
    return db.select().from(documents).where(eq(documents.status, 'published')).all();
  }

  // Authors, Reviewers, Admins see all documents (or role relevant filtering)
  return db.select().from(documents).all();
}

/**
 * Fetch a single document by ID with strict server-side permission check.
 */
export function getDocumentById(actorId: string, documentId: string) {
  const actor = getActor(actorId);
  const doc = getDoc(documentId);

  // SERVER-SIDE PERMISSION RULE: Viewers can ONLY view published documents
  if (actor.role === 'viewer' && doc.status !== 'published') {
    throw new ForbiddenError('Viewers can only access published documents.');
  }

  const logs = db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.documentId, documentId))
    .orderBy(desc(auditLogs.timestamp))
    .all();

  const author = db.select().from(users).where(eq(users.id, doc.authorId)).get();

  return {
    ...doc,
    authorName: author ? author.name : 'Unknown Author',
    auditLogs: logs,
  };
}

/**
 * Story 2: Create A Draft Document
 * - Only Author role can create.
 * - Title & Body non-empty validation.
 * - Atomic transaction created doc + CREATED audit event.
 */
export function createDocument(actorId: string, title: string, body: string) {
  const actor = getActor(actorId);

  if (actor.role !== 'author') {
    throw new ForbiddenError('Only users with the Author role can create draft documents.');
  }

  const trimmedTitle = title?.trim();
  const trimmedBody = body?.trim();

  if (!trimmedTitle) throw new ValidationError('Document title cannot be empty.');
  if (!trimmedBody) throw new ValidationError('Document body cannot be empty.');

  const docId = generateId('doc');
  const logId = generateId('log');
  const now = new Date().toISOString();

  // ATOMIC DB TRANSACTION: Create document + record audit event in 1 transaction
  return rawDb.transaction(() => {
    const newDoc: Document = {
      id: docId,
      title: trimmedTitle,
      body: trimmedBody,
      status: 'draft',
      authorId: actor.id,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(documents).values(newDoc).run();

    const auditEntry: AuditLog = {
      id: logId,
      documentId: docId,
      actorId: actor.id,
      action: 'CREATED',
      previousStatus: null,
      newStatus: 'draft',
      comment: 'Initial draft created.',
      timestamp: now,
    };

    db.insert(auditLogs).values(auditEntry).run();

    return newDoc;
  })();
}

/**
 * Story 3: Edit A Draft Document
 * - Only owner can edit.
 * - Only in 'draft' or 'rejected' state.
 * - Enforces Optimistic Concurrency Control (expectedVersion).
 * - Atomic update + AUDIT LOG.
 */
export function updateDraft(
  actorId: string,
  documentId: string,
  title: string,
  body: string,
  expectedVersion: number
) {
  const actor = getActor(actorId);
  const doc = getDoc(documentId);

  // Permission: Only the author/owner can edit
  if (doc.authorId !== actor.id) {
    throw new ForbiddenError('Only the document owner can edit this draft.');
  }

  // State rule: Must be in draft or rejected
  if (doc.status !== 'draft' && doc.status !== 'rejected') {
    throw new ForbiddenError(`Cannot edit a document in '${doc.status}' state. Only draft or rejected documents can be edited.`);
  }

  // Optimistic Concurrency Check
  if (doc.version !== expectedVersion) {
    throw new ConcurrencyConflictError(doc.version, expectedVersion);
  }

  const trimmedTitle = title?.trim();
  const trimmedBody = body?.trim();

  if (!trimmedTitle) throw new ValidationError('Document title cannot be empty.');
  if (!trimmedBody) throw new ValidationError('Document body cannot be empty.');

  const logId = generateId('log');
  const now = new Date().toISOString();

  return rawDb.transaction(() => {
    const updatedVersion = doc.version + 1;

    db.update(documents)
      .set({
        title: trimmedTitle,
        body: trimmedBody,
        version: updatedVersion,
        updatedAt: now,
      })
      .where(and(eq(documents.id, documentId), eq(documents.version, expectedVersion)))
      .run();

    db.insert(auditLogs)
      .values({
        id: logId,
        documentId: documentId,
        actorId: actor.id,
        action: 'EDITED',
        previousStatus: doc.status,
        newStatus: doc.status,
        comment: 'Document content updated by author.',
        timestamp: now,
      })
      .run();

    return getDoc(documentId);
  })();
}

/**
 * Story 4: Submit A Document For Review
 * - Move draft/rejected -> submitted.
 * - Only owner can submit.
 * - Validates OCC version.
 * - Atomic status update + audit event.
 */
export function submitDocument(actorId: string, documentId: string, expectedVersion: number) {
  const actor = getActor(actorId);
  const doc = getDoc(documentId);

  // Ownership rule: Only owner can submit
  if (doc.authorId !== actor.id) {
    throw new ForbiddenError('Only the document author can submit this document for review.');
  }

  // Valid transition check: draft -> submitted or rejected -> submitted
  if (doc.status !== 'draft' && doc.status !== 'rejected') {
    throw new InvalidTransitionError(doc.status, 'submitted');
  }

  // Concurrency check
  if (doc.version !== expectedVersion) {
    throw new ConcurrencyConflictError(doc.version, expectedVersion);
  }

  const logId = generateId('log');
  const now = new Date().toISOString();

  return rawDb.transaction(() => {
    const nextVersion = doc.version + 1;

    db.update(documents)
      .set({
        status: 'submitted',
        version: nextVersion,
        updatedAt: now,
      })
      .where(and(eq(documents.id, documentId), eq(documents.version, expectedVersion)))
      .run();

    db.insert(auditLogs)
      .values({
        id: logId,
        documentId: documentId,
        actorId: actor.id,
        action: 'SUBMITTED',
        previousStatus: doc.status,
        newStatus: 'submitted',
        comment: 'Submitted for reviewer approval.',
        timestamp: now,
      })
      .run();

    return getDoc(documentId);
  })();
}

/**
 * Story 5: Review A Submitted Document (Approve or Reject)
 * - Only Reviewers (or Admin) can review.
 * - CRITICAL BUSINESS RULE: Reviewers CANNOT approve/reject their own documents!
 * - Rejection REQUIRES a non-empty comment.
 * - Valid transition: submitted -> approved OR submitted -> rejected.
 * - OCC version check & atomic transaction.
 */
export function reviewDocument(
  actorId: string,
  documentId: string,
  decision: 'approve' | 'reject',
  comment: string | undefined,
  expectedVersion: number
) {
  const actor = getActor(actorId);
  const doc = getDoc(documentId);

  // Role check: must be reviewer or admin
  if (actor.role !== 'reviewer' && actor.role !== 'admin') {
    throw new ForbiddenError('Only reviewers or admins can approve/reject documents.');
  }

  // CRITICAL RULE: Authors cannot approve/reject their own documents even if they hold a reviewer role!
  if (doc.authorId === actor.id) {
    throw new ForbiddenError('Conflict of Interest: You cannot review or approve your own document.');
  }

  // OCC Version check — MUST come before state check so stale concurrent writes
  // get a clear 409 Conflict even when the state has changed under them.
  if (doc.version !== expectedVersion) {
    throw new ConcurrencyConflictError(doc.version, expectedVersion);
  }

  // State check: document must be in 'submitted' state
  if (doc.status !== 'submitted') {
    const targetStatus = decision === 'approve' ? 'approved' : 'rejected';
    throw new InvalidTransitionError(doc.status, targetStatus);
  }

  // Rejection requires comment check
  const trimmedComment = comment?.trim();
  if (decision === 'reject' && !trimmedComment) {
    throw new ValidationError('A comment is required when rejecting a document.');
  }

  const newStatus: DocumentStatus = decision === 'approve' ? 'approved' : 'rejected';
  const actionName = decision === 'approve' ? 'APPROVED' : 'REJECTED';
  const logId = generateId('log');
  const now = new Date().toISOString();

  return rawDb.transaction(() => {
    const nextVersion = doc.version + 1;

    db.update(documents)
      .set({
        status: newStatus,
        version: nextVersion,
        updatedAt: now,
      })
      .where(and(eq(documents.id, documentId), eq(documents.version, expectedVersion)))
      .run();

    db.insert(auditLogs)
      .values({
        id: logId,
        documentId: documentId,
        actorId: actor.id,
        action: actionName,
        previousStatus: 'submitted',
        newStatus: newStatus,
        comment: trimmedComment || (decision === 'approve' ? 'Approved by reviewer.' : 'Rejected by reviewer.'),
        timestamp: now,
      })
      .run();

    return getDoc(documentId);
  })();
}

/**
 * Story 6: Publish An Approved Document
 * - Only approved documents can be published.
 * - Triggers transition: approved -> published.
 * - Allowed for Reviewer or Admin.
 * - OCC version check & atomic transaction with audit log.
 */
export function publishDocument(actorId: string, documentId: string, expectedVersion: number) {
  const actor = getActor(actorId);
  const doc = getDoc(documentId);

  // Role check: reviewer or admin
  if (actor.role !== 'reviewer' && actor.role !== 'admin') {
    throw new ForbiddenError('Only reviewers or admins can publish documents.');
  }

  // State check: approved -> published ONLY
  if (doc.status !== 'approved') {
    throw new InvalidTransitionError(doc.status, 'published');
  }

  // OCC version check
  if (doc.version !== expectedVersion) {
    throw new ConcurrencyConflictError(doc.version, expectedVersion);
  }

  const logId = generateId('log');
  const now = new Date().toISOString();

  return rawDb.transaction(() => {
    const nextVersion = doc.version + 1;

    db.update(documents)
      .set({
        status: 'published',
        version: nextVersion,
        updatedAt: now,
      })
      .where(and(eq(documents.id, documentId), eq(documents.version, expectedVersion)))
      .run();

    db.insert(auditLogs)
      .values({
        id: logId,
        documentId: documentId,
        actorId: actor.id,
        action: 'PUBLISHED',
        previousStatus: 'approved',
        newStatus: 'published',
        comment: 'Document published to public view.',
        timestamp: now,
      })
      .run();

    return getDoc(documentId);
  })();
}

/**
 * Story 9: Archive A Document
 * - Only Admin can archive.
 * - Can archive from draft, submitted, approved, or published.
 * - OCC version check & atomic transaction with audit log.
 */
export function archiveDocument(actorId: string, documentId: string, expectedVersion: number) {
  const actor = getActor(actorId);
  const doc = getDoc(documentId);

  // Role check: Admin only
  if (actor.role !== 'admin') {
    throw new ForbiddenError('Only system administrators can archive documents.');
  }

  // State check: terminal state archived cannot be re-archived
  if (doc.status === 'archived') {
    throw new InvalidTransitionError('archived', 'archived');
  }

  // OCC version check
  if (doc.version !== expectedVersion) {
    throw new ConcurrencyConflictError(doc.version, expectedVersion);
  }

  const logId = generateId('log');
  const now = new Date().toISOString();

  return rawDb.transaction(() => {
    const nextVersion = doc.version + 1;

    db.update(documents)
      .set({
        status: 'archived',
        version: nextVersion,
        updatedAt: now,
      })
      .where(and(eq(documents.id, documentId), eq(documents.version, expectedVersion)))
      .run();

    db.insert(auditLogs)
      .values({
        id: logId,
        documentId: documentId,
        actorId: actor.id,
        action: 'ARCHIVED',
        previousStatus: doc.status,
        newStatus: 'archived',
        comment: 'Document archived by administrator.',
        timestamp: now,
      })
      .run();

    return getDoc(documentId);
  })();
}

/**
 * Story 7: View Audit History
 * Fetches all audit logs for a document in reverse chronological order.
 */
export function getDocumentAuditHistory(actorId: string, documentId: string) {
  const actor = getActor(actorId);
  const doc = getDoc(documentId);

  if (actor.role === 'viewer' && doc.status !== 'published') {
    throw new ForbiddenError('Viewers can only view audit logs of published documents.');
  }

  const logs = db
    .select({
      id: auditLogs.id,
      documentId: auditLogs.documentId,
      actorId: auditLogs.actorId,
      actorName: users.name,
      actorRole: users.role,
      action: auditLogs.action,
      previousStatus: auditLogs.previousStatus,
      newStatus: auditLogs.newStatus,
      comment: auditLogs.comment,
      timestamp: auditLogs.timestamp,
    })
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.actorId, users.id))
    .where(eq(auditLogs.documentId, documentId))
    .orderBy(desc(auditLogs.timestamp))
    .all();

  return logs;
}
