const { seed, SEEDED_USERS } = require('../src/db/seed');
const { db } = require('../src/db');
const { documents, auditLogs } = require('../src/db/schema');
const {
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
} = require('../src/lib/domain');
const { eq } = require('drizzle-orm');
const assert = require('assert');

console.log('--- STARTING DOMAIN INVARIANT VERIFICATION TEST SUITE ---');

try {
  // Reset & seed DB
  seed();

  const authorId = SEEDED_USERS.find((u) => u.role === 'author').id;
  const reviewerId = SEEDED_USERS.find((u) => u.role === 'reviewer').id;
  const adminId = SEEDED_USERS.find((u) => u.role === 'admin').id;
  const viewerId = SEEDED_USERS.find((u) => u.role === 'viewer').id;

  // Test 1: Story 1 - Viewers can ONLY see published documents
  console.log('[Test 1] Verifying Viewer Isolation...');
  const viewerDocs = getDocumentsForUser(viewerId);
  assert(viewerDocs.every((d) => d.status === 'published'), 'Viewers must only see published docs');
  console.log('✓ Test 1 Passed');

  // Test 2: Story 2 & 3 - Author create & edit draft
  console.log('[Test 2] Verifying Author Creation & Editing...');
  const doc = createDocument(authorId, 'New Spec Title', 'Spec Body Content');
  assert.strictEqual(doc.status, 'draft');
  assert.strictEqual(doc.version, 1);

  const edited = updateDraft(authorId, doc.id, 'Updated Spec Title', 'Updated Body Content', 1);
  assert.strictEqual(edited.title, 'Updated Spec Title');
  assert.strictEqual(edited.version, 2);
  console.log('✓ Test 2 Passed');

  // Test 3: Story 4 - Submit draft for review
  console.log('[Test 3] Verifying Document Submission...');
  const submitted = submitDocument(authorId, doc.id, 2);
  assert.strictEqual(submitted.status, 'submitted');
  assert.strictEqual(submitted.version, 3);
  console.log('✓ Test 3 Passed');

  // Test 4: Story 5 - Self approval blockage
  console.log('[Test 4] Verifying Self-Approval Blockade...');
  let selfApprovalBlocked = false;
  try {
    reviewDocument(authorId, doc.id, 'approve', undefined, 3);
  } catch (err) {
    if (err instanceof ForbiddenError) selfApprovalBlocked = true;
  }
  assert(selfApprovalBlocked, 'Author MUST be blocked from approving own document');
  console.log('✓ Test 4 Passed');

  // Test 5: Story 5 - Reviewer approval
  console.log('[Test 5] Verifying Reviewer Approval...');
  const approved = reviewDocument(reviewerId, doc.id, 'approve', 'Looks great', 3);
  assert.strictEqual(approved.status, 'approved');
  assert.strictEqual(approved.version, 4);
  console.log('✓ Test 5 Passed');

  // Test 6: Story 6 - Publish approved doc
  console.log('[Test 6] Verifying Publish Transition...');
  const published = publishDocument(reviewerId, doc.id, 4);
  assert.strictEqual(published.status, 'published');
  assert.strictEqual(published.version, 5);
  console.log('✓ Test 6 Passed');

  // Test 7: Story 8 - Optimistic Concurrency Control
  console.log('[Test 7] Verifying OCC Stale Conflict Detection...');
  let occConflictCaught = false;
  try {
    updateDraft(authorId, doc.id, 'Stale Edit', 'Stale Body', 4);
  } catch (err) {
    if (err instanceof ConcurrencyConflictError) occConflictCaught = true;
  }
  assert(occConflictCaught, 'Stale version mutation MUST trigger ConcurrencyConflictError');
  console.log('✓ Test 7 Passed');

  // Test 8: Story 9 - Archiving by Admin
  console.log('[Test 8] Verifying Archiving by Admin...');
  const archived = archiveDocument(adminId, doc.id, 5);
  assert.strictEqual(archived.status, 'archived');
  assert.strictEqual(archived.version, 6);
  console.log('✓ Test 8 Passed');

  // Test 9: Story 7 - Atomic Audit Trail Verification
  console.log('[Test 9] Verifying Atomic Audit Log Records...');
  const logs = db.select().from(auditLogs).where(eq(auditLogs.documentId, doc.id)).all();
  assert.strictEqual(logs.length, 6, 'Should have exactly 6 atomic audit logs created');
  console.log('✓ Test 9 Passed');

  console.log('\n✅ ALL 9 DOMAIN INVARIANT TESTS PASSED SUCCESSFULLY WITH 100% SUCCESS RATE!');
} catch (err) {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
}
