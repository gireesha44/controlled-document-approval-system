import { describe, it, expect, beforeEach } from 'vitest';
import { seed, SEEDED_USERS } from '../src/db/seed';
import { db } from '../src/db';
import { documents, auditLogs } from '../src/db/schema';
import {
  createDocument,
  updateDraft,
  submitDocument,
  reviewDocument,
  publishDocument,
  archiveDocument,
  getDocumentsForUser,
  getDocumentById,
  ForbiddenError,
  InvalidTransitionError,
  ConcurrencyConflictError,
  ValidationError,
  UnauthorizedError,
} from '../src/lib/domain';
import { eq } from 'drizzle-orm';

describe('Controlled Document Approval System - Domain Invariants', () => {
  beforeEach(() => {
    seed();
  });

  it('Story 1 & Rule 3: Viewer can ONLY see published documents', () => {
    const viewerId = SEEDED_USERS.find((u) => u.role === 'viewer')!.id;
    const authorId = SEEDED_USERS.find((u) => u.role === 'author')!.id;

    const viewerDocs = getDocumentsForUser(viewerId);
    expect(viewerDocs.length).toBeGreaterThan(0);
    expect(viewerDocs.every((d) => d.status === 'published')).toBe(true);

    // Viewer attempting to access a draft document by ID directly
    const draftDoc = db.select().from(documents).where(eq(documents.status, 'draft')).get()!;
    expect(() => getDocumentById(viewerId, draftDoc.id)).toThrow(ForbiddenError);
  });

  it('Story 2 & 3: Author can create & edit draft document', () => {
    const authorId = SEEDED_USERS.find((u) => u.role === 'author')!.id;

    const doc = createDocument(authorId, 'New Security Spec', 'Detailed security guidelines.');
    expect(doc.status).toBe('draft');
    expect(doc.version).toBe(1);

    // Verify Audit Log created atomically
    const logs = db.select().from(auditLogs).where(eq(auditLogs.documentId, doc.id)).all();
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe('CREATED');

    // Author edits draft
    const updatedDoc = updateDraft(authorId, doc.id, 'Updated Security Spec', 'Updated body content.', 1);
    expect(updatedDoc.title).toBe('Updated Security Spec');
    expect(updatedDoc.version).toBe(2);
  });

  it('Story 2 & Rule 4: Non-authors cannot create drafts & empty titles are rejected', () => {
    const reviewerId = SEEDED_USERS.find((u) => u.role === 'reviewer')!.id;
    const authorId = SEEDED_USERS.find((u) => u.role === 'author')!.id;

    expect(() => createDocument(reviewerId, 'Title', 'Body')).toThrow(ForbiddenError);
    expect(() => createDocument(authorId, '   ', 'Body')).toThrow(ValidationError);
  });

  it('Story 4: Author submits draft for review', () => {
    const authorId = SEEDED_USERS.find((u) => u.role === 'author')!.id;
    const doc = createDocument(authorId, 'Doc to Submit', 'Body text');

    const submitted = submitDocument(authorId, doc.id, doc.version);
    expect(submitted.status).toBe('submitted');
    expect(submitted.version).toBe(2);

    // Non-owner trying to submit
    const otherUser = SEEDED_USERS.find((u) => u.role === 'reviewer')!.id;
    expect(() => submitDocument(otherUser, doc.id, submitted.version)).toThrow(ForbiddenError);
  });

  it('Story 5 & Rule 6: Reviewer approves document; Author CANNOT approve own document', () => {
    const authorId = SEEDED_USERS.find((u) => u.role === 'author')!.id;
    const reviewerId = SEEDED_USERS.find((u) => u.role === 'reviewer')!.id;

    const doc = createDocument(authorId, 'Review Test', 'Body text');
    const submitted = submitDocument(authorId, doc.id, 1);

    // Author attempting self-approval (even if author identity is passed) -> MUST throw ForbiddenError
    expect(() => reviewDocument(authorId, doc.id, 'approve', undefined, 2)).toThrow(ForbiddenError);

    // Reviewer approves
    const approved = reviewDocument(reviewerId, doc.id, 'approve', 'Looks great!', 2);
    expect(approved.status).toBe('approved');
    expect(approved.version).toBe(3);
  });

  it('Story 5 & Rule 7: Rejection REQUIRES a comment', () => {
    const authorId = SEEDED_USERS.find((u) => u.role === 'author')!.id;
    const reviewerId = SEEDED_USERS.find((u) => u.role === 'reviewer')!.id;

    const doc = createDocument(authorId, 'Reject Test', 'Body text');
    submitDocument(authorId, doc.id, 1);

    // Reject without comment -> throw ValidationError
    expect(() => reviewDocument(reviewerId, doc.id, 'reject', '   ', 2)).toThrow(ValidationError);

    // Reject with comment -> succeed
    const rejected = reviewDocument(reviewerId, doc.id, 'reject', 'Needs citations', 2);
    expect(rejected.status).toBe('rejected');
  });

  it('Story 6 & Rule 8: Only approved documents can be published', () => {
    const authorId = SEEDED_USERS.find((u) => u.role === 'author')!.id;
    const reviewerId = SEEDED_USERS.find((u) => u.role === 'reviewer')!.id;

    const doc = createDocument(authorId, 'Publish Test', 'Body text');

    // Attempt to publish directly from draft -> throw InvalidTransitionError
    expect(() => publishDocument(reviewerId, doc.id, 1)).toThrow(InvalidTransitionError);

    // Submit -> Approve -> Publish
    submitDocument(authorId, doc.id, 1);
    reviewDocument(reviewerId, doc.id, 'approve', 'Approved', 2);

    const published = publishDocument(reviewerId, doc.id, 3);
    expect(published.status).toBe('published');
    expect(published.version).toBe(4);
  });

  it('Story 8: Optimistic Concurrency Control rejects stale writes', () => {
    const authorId = SEEDED_USERS.find((u) => u.role === 'author')!.id;
    const reviewerId = SEEDED_USERS.find((u) => u.role === 'reviewer')!.id;

    const doc = createDocument(authorId, 'Concurrency Test', 'Body text');
    submitDocument(authorId, doc.id, 1); // Current DB version is 2

    // User A approves document (updating DB version to 3)
    reviewDocument(reviewerId, doc.id, 'approve', 'Approved', 2);

    // User B (stale page holding version 2) tries to reject document
    expect(() => reviewDocument(reviewerId, doc.id, 'reject', 'Reject comment', 2)).toThrow(
      ConcurrencyConflictError
    );
  });

  it('Story 9: Admin can archive documents from active states', () => {
    const authorId = SEEDED_USERS.find((u) => u.role === 'author')!.id;
    const adminId = SEEDED_USERS.find((u) => u.role === 'admin')!.id;

    const doc = createDocument(authorId, 'Archive Test', 'Body text');

    const archived = archiveDocument(adminId, doc.id, 1);
    expect(archived.status).toBe('archived');

    // Attempting to edit or submit archived doc -> throw error
    expect(() => updateDraft(authorId, doc.id, 'Edit Title', 'Body', 2)).toThrow(ForbiddenError);
  });
});
