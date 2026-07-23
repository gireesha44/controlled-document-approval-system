# Controlled Document Approval System — ElevateBox Engineering Challenge

A full-stack, enterprise-grade Controlled Document Approval System engineered for data integrity, atomic audit logging, optimistic concurrency control (OCC), and strict server-side authorization.

---

## Quick Start & Running Locally

### Prerequisites
- Node.js `v18+` or `v20+` or `v22+`
- `npm`

### 1. Install Dependencies
```bash
npm install
```

### 2. Seed Database
Seeds initial users (`alice`, `bob`, `admin`, `viewer`) and sample documents in various workflow states:
```bash
npm run seed
# or directly:
node node_modules/tsx/dist/cli.mjs src/db/seed.ts
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Automated Test Suite
Executes 9 domain invariant tests covering all stories, permissions, OCC concurrency, and atomic transactions:
```bash
npm test
# or directly:
node node_modules/tsx/dist/cli.mjs tests/run_tests.ts
```

---

## Seeded Users & Logins

The application features a 1-click **Identity Switcher** header bar for rapid testing across all roles:

| User Name | Email | Role | Capabilities |
| :--- | :--- | :--- | :--- |
| **Alice Johnson** | `alice@example.com` | `author` | Create drafts, edit own drafts/rejected docs, submit own drafts |
| **Bob Smith** | `bob@example.com` | `reviewer` | Approve/reject submitted docs (excluding own), publish approved docs |
| **System Admin** | `admin@example.com` | `admin` | Full workflow access + archive active documents |
| **Valerie Viewer** | `viewer@example.com` | `viewer` | Read-only access to **published** documents only |

---

## Key System Features & Integrity Guarantees

### 1. Server-Side Permission & Role Enforcement
UI buttons adapt to user identity, but **all security checks are strictly enforced on the server**. Hitting API endpoints directly with invalid credentials or wrong roles triggers explicit HTTP `401`, `403`, or `422` error responses.

### 2. Optimistic Concurrency Control (OCC)
Prevents silent data loss when concurrent users review or update the same document. Every mutation validates `expectedVersion`. Stale writes (where `expectedVersion !== currentVersion`) fail immediately with a `409 Conflict` error and instructions to refresh.

### 3. Atomic Database Transactions & Audit Logs
Every document state change (`draft` → `submitted` → `approved` → `published` / `archived`) and its corresponding audit log entry are wrapped inside a single SQLite transaction (`rawDb.transaction(...)`). Neither state can drift out of sync.

### 4. Self-Review Blockade
The system enforces a conflict-of-interest check: even if an Author holds a Reviewer role, they are strictly blocked from approving or rejecting their own documents on the server.

### 5. Interactive UI Features
- **State Machine Map**: Visual highlight of active document state along the workflow pipeline.
- **Simulate OCC Conflict Button**: 1-click button in the UI drawer to simulate a stale client write and verify the server's 409 Conflict rejection.
- **Audit Timeline**: Real-time chronological audit trail for every document action.

---

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/             # REST endpoints (documents, mutations, seed)
│   │   ├── globals.css      # Styling & theme variables
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Interactive dashboard UI
│   ├── db/
│   │   ├── index.ts         # SQLite connection & WAL pragma
│   │   ├── schema.ts        # Drizzle ORM tables (users, documents, audit_logs)
│   │   └── seed.ts          # Database seed script
│   └── lib/
│       └── domain.ts        # Domain Core, State Machine & Business Rules
├── tests/
│   └── domain.test.ts       # Automated Vitest test suite
├── DESIGN.md                # System invariants & architectural decision notes
├── package.json
├── tsconfig.json
└── README.md
```
