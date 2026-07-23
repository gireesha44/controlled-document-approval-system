# 📄 Controlled Document Approval System
### ElevateBox Engineering Challenge

A full-stack document approval workflow built with **Next.js**, **TypeScript**, **Drizzle ORM**, and **SQLite**, demonstrating **server-side authorization**, **workflow state management**, **audit logging**, **transactional consistency**, and **optimistic concurrency control**.

---

## 🚀 Tech Stack

- Next.js
- TypeScript
- Drizzle ORM
- SQLite
- Tailwind CSS
- Vitest

---

## ⚙️ Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install dependencies

```bash
npm install
```

### Seed the database

```bash
npm run seed
```

### Start the development server

```bash
npm run dev
```

Open **http://localhost:3000**

---

## 🧪 Run Tests

```bash
npm test
```

The test suite validates workflow rules, permissions, audit logging, optimistic concurrency control, and state transitions.

---

## 👥 Seeded Users

| Email | Role |
|--------|------|
| `alice@example.com` | Author |
| `bob@example.com` | Reviewer |
| `admin@example.com` | Admin |
| `viewer@example.com` | Viewer |

Use the built-in **Identity Switcher** to test the application with different roles.

---

## ✅ Features

- Role-based server-side authorization
- Document workflow state machine
- Draft → Submit → Review → Publish lifecycle
- Archive workflow
- Immutable audit history
- Atomic state changes with audit logging
- Optimistic concurrency control (409 Conflict)
- Automated domain tests

---

## 📂 Project Structure

```
src/
├── app/          # UI & API Routes
├── db/           # Database, Schema & Seed
└── lib/          # Domain Logic

tests/            # Domain Tests
DESIGN.md         # Architecture & Design Decisions
README.md
```

---

## 📖 Documentation

See **DESIGN.md** for:

- System invariants
- Authorization model
- Workflow validation
- Transaction strategy
- Optimistic concurrency
- Design decisions and trade-offs

---

## ✅ Assignment Coverage

- ✔ Seeded Login
- ✔ Draft Creation & Editing
- ✔ Submit for Review
- ✔ Approve / Reject
- ✔ Publish
- ✔ Archive
- ✔ Audit History
- ✔ Optimistic Concurrency Control
- ✔ Server-side Authorization
- ✔ Atomic Transactions
- ✔ Automated Tests
