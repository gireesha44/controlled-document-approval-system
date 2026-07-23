# 📄 Controlled Document Approval System
### ElevateBox Engineering Challenge

A full-stack document approval workflow built with **Next.js**, **TypeScript**, **Drizzle ORM**, and **SQLite**, focusing on **server-side authorization**, **workflow integrity**, **audit logging**, **atomic transactions**, and **optimistic concurrency control**.

---

## 🚀 Tech Stack

- Next.js
- TypeScript
- Drizzle ORM
- SQLite
- Tailwind CSS
- Vitest

---

## ⚙️ Setup

```bash
git clone <repository-url>
cd controlled-document-approval-system

npm install
npm run seed
npm run dev
```

Open: **http://localhost:3000**

---

## 🧪 Run Tests

```bash
npm test
```

---

## 👥 Seeded Users

| User | Role |
|------|------|
| alice@example.com | Author |
| bob@example.com | Reviewer |
| admin@example.com | Admin |
| viewer@example.com | Viewer |

Use the **Identity Switcher** in the application to test different roles.

---

## ✅ Key Features

- Server-side role-based authorization
- Strict document workflow state machine
- Immutable audit history
- Atomic state changes with audit logging
- Optimistic concurrency control (409 Conflict)
- Role-specific dashboards
- Automated domain tests

---

## 📂 Project Structure

```
src/
 ├── app/        # UI & API Routes
 ├── db/         # Database & Seed
 └── lib/        # Business Logic

tests/
DESIGN.md
README.md
```

---

## 📖 Documentation

- **DESIGN.md** explains:
  - System invariants
  - Authorization model
  - Concurrency handling
  - Transaction strategy
  - Design decisions

---

## ✅ Assignment Coverage

- Seeded Login
- Draft Creation & Editing
- Submit → Review → Publish Workflow
- Archive Workflow
- Audit History
- Optimistic Concurrency Control
- Server-side Authorization
- Atomic Transactions
- Automated Tests
