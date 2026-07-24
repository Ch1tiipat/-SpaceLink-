# AGENTS.md — SpaceLink

Context file for AI coding agents working in this repository. Read this fully before any task.
If anything here conflicts with a prompt you were given, **stop and ask** — do not guess.

This is the **single source of truth for all agents on this project**. The team uses more than one
tool — Codex and Claude Code — and both read this file. Do not create a second instruction file
(CLAUDE.md, .cursorrules, copilot-instructions.md). Two files drift apart, and a stale rule that an
agent still trusts is worse than no rule at all. Everything goes here.

---

## 1. What this project is

SpaceLink is a **multi-tenant SaaS PWA marketplace for booking vendor booths at markets and events in Thailand**.
Organizations (market owners, malls, universities) sign up as tenants, design a reusable venue layout, open events, and vendors book individual booths, upload a payment slip, and get auto-confirmed.

It is a **university capstone project** (course 1101910 โครงงานเทคโนโลยีดิจิทัล-1, Software Engineering track, semester 1/2569). Final delivery 12–16 Oct 2026. Team of 3 students. This is not a commercial production system — favour clarity and correctness over cleverness, because a grader and future teammates must be able to read the code.

**Primary language of the team is Thai.** Code, identifiers, comments, and commit messages are **English**. UI copy is **Thai**. Do not translate UI strings to English.

---

## 2. Non-negotiable rules

Violating any of these breaks work that has already been reviewed and signed off by the team.

### 2.1 The Prisma schema is frozen
- `apps/api/prisma/schema.prisma` is **v4**, reviewed against 90 requirement items (Jira SCRUM-16) and approved.
- **Do NOT add, remove, or rename any model, field, enum, relation, `@map`, or `@@map`.**
- **Do NOT regenerate or rewrite the schema from scratch**, even if asked to "set up Prisma".
- If a task appears to require a schema change: **stop, explain what is missing and why, and wait for approval.** Schema changes go through the team, not through you.
- The **only** approved edit is adding `directUrl` to the datasource block (see §6.2). Nothing else.

### 2.2 Do not run destructive or state-changing database commands
Never run without an explicit, task-specific instruction:
- `prisma migrate reset`, `prisma db push`, `prisma db pull`, any `DROP`/`TRUNCATE`
- `prisma migrate dev` / `migrate deploy` — migrations are run by a human

`npx prisma generate` and `npx prisma validate` are always safe.

### 2.3 Do not invent scope
Build **only** what the current task asks for. Do not add "helpful" extras: no logging libraries, no Swagger, no Docker, no rate limiting, no test framework, no CI, no extra endpoints, no refactors of untouched files — unless the task says so.
This project has a history of deliberate scope discipline (an entire admin feature was rejected to keep scope tight). Respect it.

### 2.4 Do not install packages beyond the list you were given
If you believe a package is needed, name it and ask first.

### 2.5 Never write real secrets to disk
`.env` is gitignored and holds real values. `.env.example` holds **placeholders only**. Never copy a real key, password, or connection string into `.env.example`, into code, into a comment, or into a commit message.

### 2.6 Verify, do not assert
Do not say "done" or "should work". Run the command, paste the real output, report the exit code. If the exit code is non-zero, **stop** and report — do not attempt more than **two** fix cycles before asking a human.

---

## 3. Repository layout

```
spacelink/
├─ apps/
│  ├─ api/       NestJS backend  → Railway/Render   (created in Step 1)
│  └─ web/       Next.js 14 PWA  → Vercel           (NOT created yet — SCRUM-20)
├─ prototype/    The original static HTML/JS/CSS prototype. Reference and demo only.
├─ CLAUDE.md
├─ README.md
└─ .gitignore
```

**Design documents are deliberately not in this repository.** The master spec, ERD, design system
brief, schema change log, and status reports are kept outside version control (`docs/` is gitignored).
Everything you need to work in this codebase is in this file. If a task seems to require information
from one of those documents, **stop and ask** — do not infer it and do not reconstruct it from the code.

**About `prototype/`:** it is plain HTML, CSS, and vanilla JS with `localStorage` as its data store — no build step, no framework, no `package.json`. It is **not** the frontend that will ship. Treat it as a design artifact: read it to understand intended screens and flows, but **never modify it**, never import from it, and never wire it to the API. The real frontend will be scaffolded separately in `apps/web`.

**`apps/web` and `apps/api` are fully independent.** Each has its own `package.json`, `node_modules`, `tsconfig.json`, and lockfile. This is **not** an npm-workspaces monorepo — do not add a root `package.json`, do not add a `workspaces` field, do not hoist dependencies. Always `cd` into the app directory before running npm commands.

---

## 4. Tech stack (frozen — do not substitute)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router) + React + Tailwind CSS + `next-pwa` | Zone map rendered as inline SVG |
| Backend | NestJS + TypeScript | REST, not GraphQL |
| ORM | Prisma | |
| Database | PostgreSQL on **Supabase Pro** | |
| File storage | **Supabase Storage** | Payment slips, venue map images. Not Cloudinary — the old proposal says Cloudinary, it is outdated. |
| Auth | **Supabase Auth** (see §7) | **Email OTP / magic link.** Phone OTP requires a paid third-party SMS provider — out of budget, not in this phase. `phone` stays a profile field only. |
| AI | **Gemini API — Flash / Flash-Lite only** | **Pro tier is forbidden** (cost control). Always have a rule-based fallback. |
| Slip verification | SlipOK API (OK BASIC, free tier) | |
| Push | `web-push` + VAPID | |
| Hosting | Vercel (web) · Railway or Render (api) | |

Budget ceiling is ~1,000–1,500 THB/month. Do not introduce paid services.

---

## 5. Domain model — quick reference

**Ownership chain:**
`Organization` → `Venue` (reusable layout) → `Zone` (area / product category) → `Booth` (the bookable unit, e.g. `A01`) → `Booking`

**`Event` is the thing being booked into.** An Organization hosts an Event at a Venue for a date range; a Booking links one Vendor's Shop to one Booth for one Event.

**Do not confuse these two:**
- `Event` = a market/fair being run by an org (what vendors book into)
- `Subscription` = the org's billing record to the platform (org → us)

**Terms that no longer exist** — if you see them in an old ticket, comment, or prompt, they are stale:
- `slot` → it is `Booth`
- `tenant` → the entity is `Organization`
- `BoothHold` table → removed; hold lives on `Booking.holdExpiresAt`
- `ApprovalMode` / manual approval → removed entirely (§8)

**Roles.** `UserRole` on `app_user` is `SUPER_ADMIN | ORG_ADMIN | VENDOR` (platform-level).
`OrgMembership.role` is `OWNER | ADMIN` and defines **which organizations** an ORG_ADMIN may act on. Both live in our database, **never in the JWT**.

**Schema size:** 26 models, 18 enums. The annotated source and the rationale for every design
decision are held outside this repository by the team. `apps/api/prisma/schema.prisma` is the only
in-repo source of truth for structure.

---

## 6. Database conventions

### 6.1 Naming
- Prisma model = `PascalCase`; table and column = `snake_case` via `@@map` / `@map`
- **In TypeScript always use the Prisma client names** (`prisma.user`, `booking.holdExpiresAt`), never the raw table names — except inside raw SQL, where `snake_case` is correct
- The `User` model maps to table **`app_user`** (`user` is reserved in Postgres)
- PK is `uuid`, timestamps are `timestamptz`
- **Money is `Decimal(10,2)`. Never use `Float` or `number` for money.** Convert with `.toString()` at the API boundary, never with `parseFloat`.

### 6.2 The one approved schema edit
Supabase requires a pooled URL for the app and a direct URL for migrations. Add **only** this to the existing `datasource` block:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### 6.3 Invariants — enforced in backend code, not by Prisma
Prisma and foreign keys cannot express these. Every one must be enforced in a service method (and, where noted, additionally in SQL).

1. **Venue match** — `booking.booth.zone.venue` must equal `booking.event.venue`
2. **Date range** — booking start/end must fall inside event start/end
3. **No double-booking** — one active booking per `(event, booth)`, active = `PENDING_PAYMENT` or `CONFIRMED`. Schema has a full `@@unique`; a **partial unique index** replacing it is pending in `prisma/sql/`
4. **Config authority** — `platform_config` writable by SUPER_ADMIN only; `org_config` by that org's ORG_ADMIN only
5. **Blacklist** — `app_user.is_blacklisted` is a cache derived from accumulated `penalty.points`; never treat it as the source of truth
6. **Quota** — active bookings per vendor per event ≤ `org_config.booking_quota_per_vendor`, falling back to `platform_config.default_booking_quota` (default 2)
7. **Slip** — `verified_slip.amount` should equal `booking.booth_price`; `trans_ref` must be unique (duplicate-slip protection)
8. **Hold expiry** — a `PENDING_PAYMENT` booking past `hold_expires_at` is auto-cancelled by a scheduled job with `cancelled_by_role = SYSTEM`
9. **Refund** — `refund_request.approved_amount` ≤ `booking.booth_price`

**Derived, never stored as authoritative:** booth tier (S/A/B/C), shop badges, average rating.

### 6.4 `PrismaService` must connect lazily
Do **not** call `$connect()` inside `onModuleInit()`. Prisma opens a connection on the first query by itself. Eager connecting makes the whole application fail to boot whenever the database is unreachable — which is the current state of this project, and will also be true on any teammate's machine before they finish Supabase setup.

Implement `onModuleDestroy()` with `$disconnect()` only. The server must start successfully with an unreachable database; a query then fails with a clear error at request time, which is the correct behaviour.

---

## 7. Authentication architecture (DECIDED — Option A)

**Supabase Auth is the identity provider. NestJS verifies tokens; it does not issue them.**

Do **not** build any of the following. They were considered and rejected:
- `POST /auth/register`, `POST /auth/login`
- bcrypt or any password hashing
- a `passwordHash` column
- `@nestjs/jwt` signing, `JWT_SECRET` as a signing key

**How it works:**
1. The browser calls Supabase Auth directly (`signInWithOtp({ email })`) and receives a Supabase JWT
2. Every API request carries `Authorization: Bearer <supabase_jwt>`
3. `SupabaseAuthGuard` verifies the signature and extracts `sub` — this is `app_user.auth_user_id`
4. **Just-in-time provisioning:** if no `app_user` row matches that `auth_user_id`, create one (role defaults to `VENDOR`)
5. `RolesGuard` reads `app_user.role` **from the database**
6. `OrgScopeGuard` checks `OrgMembership` **from the database** for any org-scoped route

**Guard order:** `SupabaseAuthGuard` → provisioning → `RolesGuard` → `OrgScopeGuard`

**Critical:** role and org membership are **not** in the Supabase JWT. Reading them from a token claim will silently break multi-tenant isolation. Always query the database.

`SUPABASE_SERVICE_ROLE_KEY` is backend-only. It must never appear in `apps/web`, in any `NEXT_PUBLIC_*` variable, or in any client-side bundle.

---

## 8. Booking flow (v3 — there is NO manual approval step)

1. Vendor selects a booth → a `Booking` is created **immediately** with status `PENDING_PAYMENT`. The unique `(event, booth)` constraint locks the booth at this moment. `holdExpiresAt = now() + 5 minutes`.
2. Vendor uploads a payment slip → a `VerifiedSlip` row is created → SlipOK is called
3. SlipOK returns `VERIFIED` → the system **automatically** sets `status = CONFIRMED` and `confirmedAt`. **No human approves anything.**
4. SlipOK returns `INVALID` / `DUPLICATE` / `ERROR` → status stays `PENDING_PAYMENT`; the vendor may retry until the hold expires
5. Hold expires while still `PENDING_PAYMENT` → scheduled job cancels it with `cancelledByRole = SYSTEM`, releasing the booth
6. **Payment-exempt path:** an ORG_ADMIN may create a booking directly as `CONFIRMED` with `isPaymentExempt = true` and a reason, skipping the slip entirely

`BookingStatus`: `PENDING_PAYMENT | CONFIRMED | CANCELLED | NO_SHOW | COMPLETED`
`cancelledByRole`: `VENDOR | ORG_ADMIN | SYSTEM` — one `CANCELLED` status, the actor is a separate field

Because bookings may be payment-exempt, **never assume a `CONFIRMED` booking has a payment record.** Any code or UI copy about payment must be conditional.

---

## 9. Environment variables (`apps/api`)

```
DATABASE_URL=      # Supabase pooled — port 6543, ends with ?pgbouncer=true&connection_limit=1
DIRECT_URL=        # Supabase direct/session — port 5432, used for migrations only
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
PORT=3000
```

**Copy real values from the Supabase dashboard. Never hand-write them.** The pooled and direct URLs use different ports and different usernames; a typed-from-memory string will fail in ways that look like application bugs.

**Placeholder values are expected right now.** Until a teammate finishes Supabase setup, `.env` holds deliberately fake values (`postgresql://placeholder:placeholder@localhost:5432/placeholder`, `SUPABASE_JWT_SECRET="placeholder"`, and so on). This is intentional and correct — it lets the project build, boot, and be committed before the database exists. **Do not "fix" these values, do not try to guess real ones, and do not treat them as a misconfiguration.**

Validate env at boot and fail fast with a clear message if a variable is **missing**. A missing variable must never surface as a runtime `undefined`. Validation checks presence, not whether the credentials actually work.

---

## 10. Commands

```bash
# backend
cd apps/api
npm install
npx prisma generate      # safe, run freely
npx prisma validate      # safe
npm run build            # the real gate — must exit 0
npm run start:dev

# frontend
cd apps/web
npm install
npm run dev
npm run build
```

`npm run build` is the acceptance check for every backend task. TypeScript must compile with zero errors.

---

## 11. How to work in this repo

1. **Plan before acting.** For any task touching more than two files, list the files you will create or modify and wait for approval.
2. **One task, one commit.** Message format: `SCRUM-18: setup NestJS + Prisma skeleton`.
3. **Read before writing.** Open the file first; never overwrite a file you have not read.
4. **Match existing structure.** Every NestJS module is `x.module.ts` / `x.controller.ts` / `x.service.ts` / `dto/`. Follow it exactly, including in new modules.
5. **Report honestly.** If something did not work, say so plainly. A wrong "done" costs the team far more than a clear failure.
6. **Ask when the task contradicts this file.** Old tickets and old prompts contain stale terms (§5). This file wins.

---

## 12. Current state (update this section as things change)

| | Status |
|---|---|
| Architecture design | Done |
| ERD + schema v4 | Done, frozen |
| Schema review vs requirements (SCRUM-16) | Done |
| Frontend prototype (`prototype/`) | Exists as static HTML/JS/CSS with `localStorage`. Books at **Zone** level, has a fake login and a fake admin approval step — all three are obsolete under schema v4. Reference only. |
| `apps/web` (real Next.js frontend) | **Not created yet** — SCRUM-20 |
| Supabase project | **Not created yet** |
| Database tables | **Do not exist yet** — no migration has ever been run |
| Backend API | Not started (Sprint 6, SCRUM-18 onwards) |
| Supplementary SQL (`prisma/sql/`) | Partial — review-rating CHECK written; partial unique index, blacklist trigger, hold-expiry check still to do |
| Seed data | Not started |

**What this means in practice:**
- `npm run build` and `npm run start:dev` **must succeed** even with no database. Prisma connects lazily (§6.4) and `.env` holds placeholders (§9). A booting server is the expected outcome, not a lucky one.
- Any command that actually opens a connection **will** fail: `prisma migrate`, `prisma studio`, or any endpoint that runs a query. This is expected — **it is not a code defect.** Report it and move on; do not attempt to fix it.
- Never run `prisma migrate` yourself. A human runs the first migration after creating the Supabase project.
- Runtime tests that need real data or a real token are **deferred**. Verify with `npm run build` and, where applicable, an unauthenticated `401` response.

---

## 13. Glossary (Thai ↔ code)

| Thai | Code / English |
|---|---|
| องค์กร / ผู้เช่าระบบ | `Organization` |
| สถานที่ / ผัง | `Venue` |
| โซน | `Zone` |
| บูธ / ล็อก / แผง | `Booth` |
| งาน / อีเวนต์ | `Event` |
| การจอง | `Booking` |
| ผู้ขาย / พ่อค้าแม่ค้า | Vendor (`UserRole.VENDOR`) |
| ผู้ดูแลองค์กร | `UserRole.ORG_ADMIN` |
| ผู้ดูแลแพลตฟอร์ม | `UserRole.SUPER_ADMIN` |
| ร้านค้า | `Shop` |
| สลิป / หลักฐานการชำระเงิน | `VerifiedSlip` |
| รอชำระเงิน | `PENDING_PAYMENT` |
| ยืนยันการจอง | `CONFIRMED` |
| ยกเลิก | `CANCELLED` |
| ยกเว้นค่าเช่า | `isPaymentExempt` |
| คำร้องคืนเงิน | `RefundRequest` |
| บทลงโทษ / แบล็กลิสต์ | `Penalty` / `isBlacklisted` |
| ประกาศ | `Announcement` |

---

## 14. Security rules

This system holds real personal data: payment slips showing sender names and bank details, contact
information, and behavioural records (penalties, blacklist). Treat the rules below as hard requirements,
not suggestions. If a task cannot be completed without breaking one of them, stop and say so.

### 14.1 Payment slips are the most sensitive asset
- The Supabase Storage bucket holding slips is **private**. Never make it public, never make it "public
  for now", never disable its policy to debug something.
- Never store or return a permanent public URL to a slip. Serve slips through a **short-lived signed URL
  generated on the server, after an authorization check.**
- Only three parties may read a slip: the vendor who owns that booking, an ORG_ADMIN of the organization
  hosting the event, and SUPER_ADMIN. Everyone else gets 404 — not 403, which would confirm existence.
- `verified_slip.slipok_raw` contains the payer's name and bank. **Never return it to a vendor and never
  log it.** Admin-facing responses only.

### 14.2 Multi-tenant isolation
- Derive `organizationId` from the authenticated user's `OrgMembership`, **never from a client-supplied
  path param, query string, or body field.** A request saying `orgId=X` proves nothing.
- Where a route must take an org id in the path, still verify membership against the database before
  reading or writing anything.
- Every org-scoped Prisma query needs an explicit `where` filter on the org relation. A missing filter is
  a data leak across tenants, not a bug that shows up as an error.
- The same applies to booking lookups by `bookingCode`. The code is short and guessable — always check
  ownership as well.

### 14.3 Secrets
- `SUPABASE_SERVICE_ROLE_KEY` bypasses all row-level security. Backend only. It must never appear in
  `apps/web`, in any `NEXT_PUBLIC_*` variable, in an API response, in a log line, or in a commit.
- Never log JWTs, `DATABASE_URL`, or any SlipOK credential — including inside an error handler.
- Never write real secrets into `.env.example`, code comments, commit messages, or documentation.
- If you believe a secret has been committed, stop and tell the team immediately. Rotating the key is
  cheap; a leaked service role key is total database access.

### 14.4 Input and query safety
- `ValidationPipe` runs with `whitelist: true`, so undeclared fields are stripped. Every request body
  therefore needs a DTO — an endpoint without one accepts nothing useful.
- Use Prisma's query builder. If raw SQL is unavoidable, use the tagged-template `$queryRaw`.
  **`$queryRawUnsafe` and `$executeRawUnsafe` are forbidden in this project.**
- Validate uploaded slip images by MIME type and size on the **server**. Never trust the filename or
  content-type sent by the client; generate the stored object name yourself.

### 14.5 What not to expose
- A vendor may see their own profile, their own bookings, and public event/booth data. Nothing else.
- Do not return other users' email or phone to a vendor. Organization contact details are published
  deliberately; personal contacts are not.
- Reviews display `reviewerDisplayName`; when it is null the review is anonymous. Never fall back to the
  real name or email to fill the gap.
- `blacklistReason` and penalty details are admin-facing. Never return them in a vendor-facing response.

### 14.6 Authorization is server-side, always
Hiding a button in the frontend is not access control. Every protected action needs its guard and its
ownership check in the API, even when the UI already prevents it.
