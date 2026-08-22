# AccountEase — PRD & Implementation Log

## Original Problem Statement
Full-stack **AccountEase** web app for shop owners to maintain digital khata (accounts) for customers across one or more shops. Login (JWT), Organizations page, Customers page per organization, Ledger page per customer, WhatsApp share, print preview, mobile-first. Data model per problem statement.

## Architecture Decisions (this session)
- **Stack pivoted from Spring Boot → FastAPI (Python)** because this container has no Java/Maven and Supervisor is pre-wired to `uvicorn`. Same PostgreSQL (Supabase) + same REST contract expected by the frontend.
- **Database**: Supabase Postgres via the transaction pooler (`aws-0-ap-southeast-1.pooler.supabase.com:6543`), asyncpg driver, statement_cache disabled for PgBouncer compatibility. Tables auto-created at startup.
- **Auth**: username + password with bcrypt, JWT (Bearer token in `Authorization` header, 7-day access). Fallback cookie read supported.
- **Frontend**: React with axios client, `localStorage`-backed token, single-file `App.js` split into logical components (Login / Organizations / Customers / Ledger + modals).

## Users
- **Shop owner** (single-role in this build) — signs in, manages multiple shops, adds/edits customers, records daily transactions, shares statements over WhatsApp, prints receipts.

## Core Requirements (from problem statement)
- Login with credentials, JWT session, invalid credentials error.
- Organizations page: list, search, add, count of customers per shop.
- Customers page: list, search by name/mobile, add, per-row print preview, click row → Ledger.
- Ledger page: personal details, date-range filter, records list newest-first (accordion), WhatsApp share per record and share-all, floating "+" to add records, print all, edit + delete existing records.
- Cross-owner authorization guaranteed on every endpoint.
- Mobile-first responsive UI, empty/loading/error states.

## What's Implemented (2026-08-22)
### Backend (`/app/backend`)
- `server.py` — FastAPI app, auto-creates tables + seeds demo owner on startup.
- `models.py` — SQLAlchemy ORM: Owner, Organization, Customer, Transaction (UUID PKs, cascade deletes).
- `schemas.py` — Pydantic request/response models.
- `auth.py` — bcrypt password hashing, JWT create/verify, `get_current_owner` dependency.
- `database.py` — async engine + session factory (Supabase pooler compatible).
- Endpoints (all `/api` prefixed):
  - `POST /auth/login`, `GET /auth/me`
  - `GET/POST /organizations` (with `?q=` search + customer_count)
  - `GET/POST /organizations/{org_id}/customers` (with `?q=` searches name OR mobile), `GET /customers/{id}`, `DELETE /customers/{id}`
  - `GET/POST /customers/{id}/transactions` (with `?from=&to=` date filter), `PATCH/DELETE /transactions/{id}`
- Cross-owner isolation via ORM joins that always filter by `Organization.owner_id == current_owner.id`.
- Latest-balance-per-customer resolved with a **single `DISTINCT ON` query** (fixes N+1).

### Frontend (`/app/frontend/src`)
- `api.js` — axios wrapper, auto-attaches Bearer token, `apiErr()` normalises 422 array errors to strings.
- `App.js` — 4 pages + 5 modals. Real API-backed with:
  - **Optimistic list updates** on create/delete + auto refresh in background.
  - **AbortController** dedup for StrictMode double-mount.
  - **"refreshing…" indicator** when background refresh is in flight.
  - Login/logout, session persistence via `localStorage`.
  - Add & Edit ledger record (transaction edit is now implemented).
  - Print preview per customer + print-all in ledger.
  - WhatsApp share (pre-fills recipient mobile when available).
  - Close-account confirmation flow.

### Config & Ops
- `/app/backend/.env` — Supabase pooler DATABASE_URL (URL-encoded password), JWT_SECRET, DEMO_USERNAME/DEMO_PASSWORD.
- `/app/memory/test_credentials.md` — demo credentials + seeded data documented.
- Supervisor already configured for `uvicorn server:app`; no config changes required.

## Testing (iteration 4 – testing agent)
- Backend: **30/30 pytest tests pass** — auth, CRUD, cross-owner isolation, cascade delete, date filter, ordering.
- Frontend: **All 20 requested end-to-end flows verified working** against the real API through Playwright.
- Zero blocking defects. Post-mutation staleness fixed via optimistic updates + refreshing indicator. Testids stable.

## Known Trade-offs / Future Work
### P1 backlog
- **Reduce cross-region latency** (Supabase pooler in ap-southeast-1). Options: move DB closer, cache list responses.
- **Organization edit + delete** endpoints & UI (currently create-only).
- Server-side **pagination + debounced search** for very large ledgers.
- Split `App.js` into per-page files (`pages/Login.jsx`, etc.) once feature growth demands it.

### P2 / nice-to-have
- Custom cross-platform date picker (dd/mm/yyyy) to replace native input for consistency.
- True PDF export (currently uses browser print dialog).
- Login rate-limiting / brute-force lockout.
- Rotate JWT into httpOnly cookie with explicit CORS origin.
- Uniqueness constraint on mobile within a shop.
- Multi-staff roles.

## Test Credentials
See `/app/memory/test_credentials.md`.
