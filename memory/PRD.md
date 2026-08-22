# AccountEase Product Handoff

## Original problem statement
Build AccountEase, a mobile-first shop accounting and customer ledger application for one or more organizations. Required stack: Java Spring Boot REST API, React frontend, PostgreSQL database, username/password JWT session management. Required flows: login, organizations, customers, customer ledger with manual running balances, search, date filtering, print previews, WhatsApp sharing, validation, responsive loading/empty/error states, authorization, and pagination. Out of scope: staff roles, GST/tax invoicing, payments, inventory.

## Architecture decisions
- React client in `/app/frontend` with a focused single-page navigation flow for login → organizations → customers → ledger.
- Spring Boot 3.3 / Java 17 source in `/app/backend`, PostgreSQL schema initialization in `src/main/resources/schema.sql`.
- Manual balances are stored directly; no automatic DEBIT/CREDIT calculation was introduced.
- Demo owner is `rajesh` / `demo123`.
- Print uses browser print styling; WhatsApp uses encoded `wa.me/?text=` links.
- The preview currently uses seeded local React state for the interactive demo while backend wiring is completed.

## Implemented
- Polished responsive login screen with masked password/show toggle, demo credentials, friendly errors, and sign out.
- Organizations page with search, shop cards, customer counts, add-shop modal, and empty state.
- Customers page with name/mobile search, add-customer modal, mobile layout, row navigation, and print-preview modal.
- Customer ledger with personal details, manual balance, date-range filtering, expandable records, single-record print/share, all-filtered-record WhatsApp share, and empty state.
- Spring Boot project foundation, REST route surface, PostgreSQL schema, seed owner/shop, and API request records.
- Verified production React build, desktop login/shop flow, mobile ledger flow, date filtering, and no mobile horizontal overflow.

## Prioritized backlog
- P0: Configure the runtime to launch Spring Boot instead of the starter FastAPI process, and provide `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, and `JWT_SECRET`.
- P0: Wire React data hooks to Spring Boot so organizations, customers, and transactions persist to PostgreSQL rather than local preview state.
- P0: Activate and verify the signed-token filter plus owner-scoped SQL checks already added to the Spring source.
- P1: Connect the new ledger record plus form to `POST /api/customers/{customerId}/transactions`, then add server-side pagination/debounced search.
- P2: Add PDF export generation and richer statement sharing with customer mobile prefilling.

## Activation status
- Hosted PostgreSQL settings and a generated `JWT_SECRET` are now present in `/app/backend/.env`.
- Activation could not be completed in this workspace: Java/Maven are not installed and `/etc/supervisor/conf.d/supervisord.conf` is read-only and still launches the starter FastAPI server on port 8001.
- The live preview therefore remains **MOCKED local state**; database persistence and JWT runtime verification are still pending an environment that can launch Spring Boot.