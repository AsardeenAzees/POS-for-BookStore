# Phase 1 POS Audit Report

Audit date: 2026-07-21  
Scope: React/Vite web app, Express API, Prisma/PostgreSQL schema and migrations, seed workflow, Docker Compose, security/RBAC, POS/inventory/customer/report/receipt/desired-item/SMS flows.

## Executive Summary

Phase 1 is suitable for a controlled client demonstration using PostgreSQL plus the mock or Text.lk dry-run SMS path. The audit preserved the existing architecture and features while correcting material authorization, financial-integrity, stock-concurrency, notification-policy, logging, dependency, and usability problems.

It is not yet recommended for an unattended production rollout. Production readiness still requires organization-specific user/password administration, deployment hardening/monitoring/backups, acceptance testing with real shop staff and hardware, and final confirmation of the Text.lk API parameters.

## Completed Phase 1 Features

- JWT login with active-user checks and five seeded roles: Admin, Manager, Cashier, Inventory Staff, Delivery Staff.
- Server-side role authorization and branch-aware data access.
- Product, category, SKU/barcode search, duplicate warnings, and branch stock initialization.
- Stock in, stock out, physical-count adjustment, movement reason, staff attribution, and movement history.
- Cash/digital-placeholder POS checkout with server-authoritative prices, bounded discounts, stock validation, invoice sequence, payments, digital receipt, and stock movements.
- Customer records, Sri Lankan phone normalization, notification preferences, and purchase history.
- Dashboard and reports for daily sales, product sales, low stock, branch stock, employee sales, and CSV export.
- Thermal/A4 receipt views and browser printing.
- Desired-item capture, branch-aware matching, approval, notification logging, and state tracking.
- Mock/Text.lk provider abstraction with dry-run, timeout, safe failure handling, retry control, masked provider data, and notification logs.
- Business/SMS settings with Admin write access and Manager read-only access.
- Helmet, CORS from environment, request-size limits, rate limiting, centralized safe errors, and audit logging.
- Responsive light/dark UI with role-aware navigation and route guards.

## Issues Fixed in This Audit

### Business and data integrity

- Replaced client-authoritative unit prices with product prices loaded inside checkout.
- Bounded line discounts by line value and bill discounts by subtotal.
- Rejected duplicate product lines in a sale.
- Added serializable/retry checkout and manual-stock transactions to prevent lost updates and overselling.
- Added a per-branch/per-day atomic invoice sequence and migration.
- Made stock `ADJUSTMENT` mean the new physical on-hand quantity; manual APIs no longer accept reserved `SALE`/`RETURN` movement types.
- Made sale completion independent of post-sale SMS/database notification failures.
- Corrected report totals to use completed sales and the caller's permitted branch scope.
- Fixed product duplicate checks that previously matched every product when optional fields were blank.
- Made product creation and branch stock-row creation transactional.
- Normalized customer phone/WhatsApp values before persistence.

### RBAC and branch isolation

- Restricted sales, receipts, stock, stock movements, notifications, desired requests, reports, and branch lists by role and assigned branch; Admin retains global branch scope.
- Prevented Cashier/Inventory/Delivery roles from reading Admin audit logs or settings.
- Prevented branch staff from creating sales, stock changes, desired requests, approvals, or status changes for other branches.
- Restricted manual SMS to Admin and notification logs/retries to Admin/Manager with branch checks.
- Added role-aware navigation, protected frontend routes, role-specific home behavior, and Manager read-only settings.

### SMS and desired-item reliability

- Kept `SMS_PROVIDER=mock` and `TEXTLK_DRY_RUN=true` as safe defaults.
- Rechecked customer preferences at actual send/retry time.
- Limited retries to failed notifications and added an atomic retry claim to reduce duplicate sends.
- Prevented sends of terminal notifications.
- Made desired-item matching branch-aware and atomically claim open requests before creating notifications.
- Derived desired-request status from the actual notification result rather than send intent.
- Validated matched product and request state before persisting approval.
- Added notification send/failure audit records and provider-response field redaction.
- Removed the prefilled valid-looking SMS test phone number.

### Security, dependencies, and diagnostics

- Stopped returning raw internal exception messages to clients; Prisma conflicts/not-found errors are mapped safely.
- Reduced HTTP logs to route/status/timing/user and request field names, avoiding customer, sale, SMS, credential, and token values.
- Equalized the login password-check path for unknown accounts and retained login success/failure audit records.
- Made production seed execution require `SEED_USER_PASSWORD`; documented defaults remain local-development only.
- Updated dependency resolution to remove all `npm audit` findings, including the vulnerable development command parser and body parser.
- Added focused phone, branch-permission, sale-total/discount, and desired-item matching tests.

### UI/UX

- Added POS loading/error states, visible branch stock, out-of-stock controls, stock-bounded quantities, guarded checkout, and an empty-cart prompt.
- Replaced raw report JSON with readable tables plus loading/empty/error states.
- Added inventory/customer search and clearer physical-count adjustment wording.
- Added user-facing error handling for settings, notifications, inventory, customers, receipt loading, and desired-item actions.
- Disabled duplicate notification retry clicks and hid actions users cannot perform.

## Remaining Phase 1 Gaps

- User/role/branch administration, password change/reset, forced first-login rotation, session revocation, and MFA are not implemented. Seed accounts are for local/demo use.
- Sale cancellation, return/refund, void approval, cash-drawer balancing, shift open/close, and reconciliation workflows are not implemented.
- Digital payment remains a `PENDING` placeholder; no payment gateway, settlement, or webhook verification exists.
- Automated tests cover pure rules but not PostgreSQL concurrency, full HTTP RBAC matrices, CSV downloads, or browser print layout. These are included in the manual checklist below.
- Audit writes are best-effort application records in the same database, not an immutable external audit trail.
- Backup/restore, production observability, retention/privacy policies, and disaster recovery are deployment work, not implemented application workflows.
- Product/customer editing and deactivation UX is limited; creation and operational use are present.

## Phase 2 — Not Built in This Audit

- Customer website
- Online reservation with 48-hour expiry
- COD order approval workflow
- Delivery staff workflow
- WhatsApp chatbot
- n8n automation webhooks
- OCR invoice/image upload with human review
- Offline/manual sheet upload recovery
- Mobile app

The existing API/database/provider patterns are usable extension points, but Phase 2 needs explicit order/reservation state models, idempotency keys, webhook authentication, delivery assignment, upload quarantine/review, and mobile/offline synchronization design before implementation.

## Risk List

| Risk | Current control | Required follow-up |
| --- | --- | --- |
| Real Text.lk request parameters remain unconfirmed | Mock default, dry-run default, timeout, masked logs, sale failure isolation | Confirm against the provider, test in a non-production account, then enable deliberately. |
| Demo seed credentials used outside local development | Production seed requires `SEED_USER_PASSWORD`; login form is blank | Add user management/password rotation and remove demo accounts before deployment. |
| JWT is stored in browser local storage | React escaping, no raw HTML sinks, short configurable expiry | Prefer secure cookie/session or a hardened token lifecycle before public internet exposure. |
| Financial/stock concurrency not load-tested | Serializable transactions, guarded decrement, atomic invoice counter | Add PostgreSQL integration tests with parallel checkout/movement requests. |
| Audit trail is not tamper-evident | Server-attributed audit records and login/notification events | Export to append-only logging/SIEM and add alerting/retention rules. |
| Production operations are undefined | Docker health check and `/health` endpoint | Define TLS/reverse proxy, secrets manager, backups, monitoring, restore drills, and patch cadence. |

## Manual Test Checklist

### Setup and authentication

- [ ] Copy `.env.example` to `.env`, keep mock/dry-run SMS, start PostgreSQL, migrate, and seed.
- [ ] Log in as each seeded role using the configured local `SEED_USER_PASSWORD` (or documented local default).
- [ ] Confirm Admin sees all modules/branches.
- [ ] Confirm Manager sees the assigned branch, reports, notifications, and read-only settings.
- [ ] Confirm Cashier lands on POS and cannot open settings, reports, inventory mutation, notifications, or audit logs.
- [ ] Confirm Inventory Staff lands on Inventory and cannot change business/SMS/security settings.
- [ ] Confirm Delivery Staff sees the Phase 2 notice and cannot access POS/admin data.

### Products and inventory

- [ ] Search products by name, SKU, barcode, author, and publisher.
- [ ] Run duplicate checks with name only, SKU only, barcode only, and all blank.
- [ ] Create a product and confirm a zero stock row exists for every active branch.
- [ ] Record stock in/out with a reason and confirm user, before/after quantity, branch, and time.
- [ ] Set a physical-count adjustment to zero and a positive value.
- [ ] Attempt stock out beyond availability and confirm no movement is committed.
- [ ] Attempt cross-branch stock access/mutation as branch staff and confirm rejection.

### POS and receipts

- [ ] Confirm out-of-stock products cannot be added and cart quantity cannot exceed visible branch stock.
- [ ] Attempt a crafted checkout with a false `unitPrice`, excessive discount, duplicate product line, or foreign branch and confirm rejection/server price enforcement.
- [ ] Complete cash and digital-placeholder sales; confirm invoice, payment status, receipt snapshot, stock decrement, movement reference, and audit record.
- [ ] Print both thermal and A4 layouts from desktop and tablet widths.
- [ ] Run two parallel final-unit checkouts and confirm only one completes.

### Customers, desired items, and SMS

- [ ] Create customers using `07XXXXXXXX`, `+947XXXXXXXX`, and `947XXXXXXXX`; confirm storage as `947XXXXXXXX`.
- [ ] Confirm invalid/non-mobile numbers are rejected and duplicate normalized phones conflict cleanly.
- [ ] Confirm `UNSUBSCRIBED` blocks invoice and stock-alert sends; `INVOICE_ONLY` blocks stock alerts.
- [ ] Add a desired request, add matching stock in the same branch, and confirm pending review/notification log.
- [ ] Add matching stock in another branch and confirm it does not match the request.
- [ ] Approve a matched request in mock mode and confirm a dry-run notification log and correct request state.
- [ ] Use invoice SMS, test SMS, desired-item approval, and failed retry paths; confirm logs and audit records.
- [ ] Confirm retry is unavailable for sent/skipped notifications and duplicate clicks do not double-send.

### Reports, export, UI, and security

- [ ] Reconcile daily/product/employee totals against completed seeded/test sales.
- [ ] Confirm Manager reports/exports contain only the assigned branch and Admin reports contain all branches.
- [ ] Open every CSV in Excel/LibreOffice; confirm UTF-8 text, headers, and formula-like cells are inert.
- [ ] Verify dashboard loading/empty/error states, light/dark mode, 1024px tablet layout, and narrow mobile layout.
- [ ] Confirm API errors contain safe user messages while server logs contain no passwords, tokens, customer bodies, receipts, or SMS message content.
- [ ] Confirm `.env` remains ignored and no real token appears in Git history or generated frontend assets.

## Recommended Next Development Order

1. Complete the manual Phase 1 checklist with shop staff and add HTTP/PostgreSQL integration tests for checkout concurrency and the full RBAC matrix.
2. Add production user administration, password rotation/reset, session revocation, and deployment operations (TLS, backups, monitoring, secrets).
3. Implement returns/refunds, void approval, shifts, cash reconciliation, and product/customer maintenance if required by the client's operating process.
4. Confirm Text.lk parameters in an isolated provider account; keep mock/dry-run until confirmation is signed off.
5. Design a shared order/reservation state machine, then build the customer website, 48-hour reservations, and COD approval.
6. Add delivery assignment/status and the Delivery Staff workspace.
7. Add authenticated n8n webhooks and WhatsApp automation with idempotency and consent controls.
8. Add OCR/human review and offline/manual recovery imports with quarantine, deduplication, and audit trails.
9. Build the mobile app/offline synchronization only after the API workflows and conflict rules are stable.

## Verification Commands

```bash
npm install
docker compose up -d postgres
npm run prisma:generate --workspace @pos/api
npm run db:migrate --workspace @pos/api
npm run db:seed --workspace @pos/api
npm test
npm run lint
npm run build
npm audit --audit-level=moderate
```
