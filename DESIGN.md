# DESIGN.md — Controlled Document Approval System

## Technical Architecture & Core Invariants

### 1. What are the most important invariants in your system?
- **Valid State Machine Transitions Only**: A document can strictly follow the defined graph (`draft` → `submitted` → `approved` / `rejected` → `published` / `archived`). Direct jumps (e.g., `draft` → `published`) are rejected.
- **Server-Enforced Role Authorization**: UI hides buttons for convenience, but server endpoints independently re-verify identity and permissions before any operation.
- **Viewer Public Isolation**: Viewers can strictly read documents in `published` status. Non-published documents cannot be accessed by viewers via list or direct ID requests.
- **Self-Approval Blocked**: Reviewers cannot approve or reject documents they authored (`doc.authorId !== actor.id`).
- **Mandatory Rejection Comment**: A rejection transition requires a non-empty string comment.
- **Optimistic Concurrency Control (OCC)**: Every mutation checks `expectedVersion === doc.version`. Stale writes return a `409 Conflict` response.
- **Atomic Audit Trail**: A document state update and its corresponding audit log entry are written together inside a single database transaction. Neither can exist without the other.

---

### 2. Which invariants are enforced by the database, and which by application code?
- **Database Enforced**:
  - Entity primary key uniqueness (`id`).
  - Foreign key constraints (`author_id` → `users.id`, `document_id` → `documents.id`, `actor_id` → `users.id`).
  - Schema enum check constraints (`status`, `role`).
  - Transaction atomicity & isolation (SQLite WAL mode & `rawDb.transaction(...)`).
- **Application Enforced**:
  - Workflow state machine transition validation.
  - Role-based authorization & self-approval prevention checks.
  - Non-empty content & comment validation.
  - Version equality checking for Optimistic Concurrency Control (OCC).

---

### 3. How do permissions work?
Every domain function requires an explicit `actorId`. The server looks up the user's role (`author`, `reviewer`, `admin`, `viewer`) from the database:
1. **Viewer**: View-only access limited strictly to `published` status documents.
2. **Author**: Can create drafts, edit own drafts or own rejected docs, submit own drafts, and reopen own rejected docs.
3. **Reviewer**: Can approve or reject submitted documents (excluding own documents) and publish approved documents.
4. **Admin**: Can perform reviewer actions plus archive any document from active states.

---

### 4. How do you prevent stale or conflicting updates?
We implement **Optimistic Concurrency Control (OCC)** via an integer `version` column:
- Every document mutation request accepts `expectedVersion`.
- The database update query checks: `WHERE id = :id AND version = :expectedVersion`.
- If the current version in DB does not equal `expectedVersion`, a `ConcurrencyConflictError` (HTTP 409) is thrown.
- The UI catches this and presents a clear error message instructing the user to refresh their view without silently overwriting data.

---

### 5. How do you keep audit events consistent with document state changes?
State changes and audit events are executed inside an **atomic database transaction**:
```ts
return rawDb.transaction(() => {
  db.update(documents).set({ status, version: nextVersion }).where(...).run();
  db.insert(auditLogs).values({ documentId, actorId, action, ... }).run();
})();
```
If either operation fails or encounters an exception, SQLite rolls back the entire transaction, guaranteeing 100% consistency with no orphaned state changes or missing audit records.

---

### 6. What failure cases did you consider?
- **Stale Write / Race Conditions**: Prevented via OCC version checking.
- **Unauthorized Direct API Requests**: Prevented via server-side session lookup & role checks on every handler.
- **Partial DB Failures / Network Interruptions**: Prevented via atomic transactions.
- **Self-Review Security Hole**: Prevented by checking `doc.authorId === actor.id` during review.
- **Bypassing Rejection Reason**: Prevented by validating non-empty comment string on rejection.

---

### 7. What would you improve with more time?
- Add full document version history diffing (viewing side-by-side text diffs across version iterations).
- Support soft restore/reopening from `archived` state for admins.
- Add real-time SSE / WebSocket updates when another user submits or approves a document.

---

### 8. What would need to change for a real production system?
- **Authentication**: Replace seeded session header with standard session cookies or JWT tokens signed by an identity provider (e.g. NextAuth, Better Auth, or Auth0).
- **Database Scaling**: Migrate SQLite database to a distributed PostgreSQL instance (e.g., Supabase / Neon / AWS Aurora) with connection pooling.
- **Distributed Locking / Queueing**: For high-concurrency enterprise deployments, use Redis advisory locks or background worker queues for notifications.

---

## Technical Reflection (Learning Story)
*Exploring Rust & Database Storage Engines*: Outside standard web frameworks, studying Rust and LSM-tree storage engines (like RocksDB) taught me how database immutability and WAL (Write-Ahead Logging) achieve crash recovery and linearizable consistency. Understanding how databases serialize writes at the storage layer inspired the strict transaction boundary and append-only audit trail design in this system.
