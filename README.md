# Sri Lanka Cloud POS

Production-oriented first version of a reusable cloud POS and inventory management system for Sri Lankan retail businesses. The seed data starts with a bookshop, but the data model supports textiles, jewellery, stationery, grocery, and other branch-based businesses.

## Project Owner

**Asardeen Azees**

Project owner and maintainer of Sri Lanka Cloud POS.

## Stack

- Web: React + TypeScript + Vite
- API: Express + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Auth: JWT + role-based access control
- Local database: Docker Compose PostgreSQL

## What Is Included

- Shared backend and shared database for POS now and future client website/mobile/automation clients
- Roles: Admin, Manager, Cashier, Inventory Staff, Delivery Staff, and a restricted read-only Demo Viewer
- Branch-aware products and stock
- Product/category management API with duplicate-check endpoint
- Stock in, stock out, adjustment, sale movements, low-stock notification events
- POS cart, product/SKU/barcode search, cash checkout, digital payment placeholder
- Invoice number generation and digital receipt payloads
- Customer records, notification preferences, purchase history API
- SMS notification module with provider abstraction, mock mode, and verified Text.lk API v3 delivery
- Reports: daily sales, product sales, low stock, branch stock, employee sales
- Audit logging for successful write actions
- Responsive dashboard with light/dark mode
- Professional thermal and A4 receipt views with browser printing
- Desired item request workflow with stock-available SMS notifications
- Text.lk API v3 provider with Bearer authentication, dry-run mode, retry, timeout, and masked logging
- Admin settings for business profile, SMS flags, provider selection, and test SMS
- CSV exports for sales, branch stock, products, customers, desired item requests, and SMS logs

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create the API environment file:

```bash
cp apps/api/.env.example apps/api/.env
```

On Windows PowerShell:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
```

Set `DATABASE_URL` in that local file to the Docker database before running Prisma:

```env
DATABASE_URL="postgresql://pos_user:pos_password@localhost:5432/pos_db?schema=public"
```

3. Start PostgreSQL:

```bash
docker compose up -d postgres
```

4. Run database migration and seed data:

```bash
npm run db:migrate --workspace @pos/api -- --name init
npm run db:seed --workspace @pos/api
```

5. Start the API:

```bash
npm run dev --workspace @pos/api
```

6. Start the web app in another terminal:

```bash
npm run dev --workspace @pos/web
```

Open:

- Web app: http://localhost:5173
- API health: http://localhost:4000/health

## Local Development Test Users

For local development only, seeded users use this password unless `SEED_USER_PASSWORD` is set:

```text
Password123!
```

| Role | Branch scope | Email | Intended sample access |
| --- | --- | --- | --- |
| Admin | All branches | admin@bookshop.lk | Full system administration |
| Manager | Colombo | manager@bookshop.lk | Dashboard, POS, inventory, customers, reports and notifications |
| Manager | Kandy | manager.kandy@bookshop.lk | Same manager workflow, restricted to Kandy data |
| Cashier | Colombo | cashier@bookshop.lk | POS checkout, receipts, customers and desired-item capture |
| Cashier | Kandy | cashier.kandy@bookshop.lk | Same cashier workflow, restricted to Kandy data |
| Inventory Staff | Colombo | inventory.colombo@bookshop.lk | Products, stock movements and desired-item views |
| Inventory Staff | Kandy | inventory@bookshop.lk | Same inventory workflow, restricted to Kandy data |
| Delivery Staff | Colombo | delivery.colombo@bookshop.lk | Phase 2 delivery-workflow placeholder |
| Delivery Staff | Kandy | delivery@bookshop.lk | Phase 2 delivery-workflow placeholder |
| Demo Viewer | All branches, read-only | demo@bookshop.lk | Read-only dashboards, inventory, invoices and reports |

The public demo login is `demo@bookshop.lk` / `DemoView@2026!`. It can view dashboards, inventory, invoices, and reports but cannot create, update, delete, check out sales, change stock, send notifications, or change settings. This intentionally public read-only credential is separate from all staff and administrator credentials.

The seed command refuses to create fresh production users without explicit passwords. Set a strong `SEED_USER_PASSWORD` and `DEMO_VIEWER_PASSWORD` before running `db:seed` with `NODE_ENV=production`. Existing staff passwords are preserved by the idempotent seed while names, roles, branch assignments, and active status are repaired to match the sample definitions. The dedicated demo password is synchronized from `DEMO_VIEWER_PASSWORD` so the published read-only credential remains usable.

Role behavior in the current Phase 1 implementation:

- Admin has global branch access and can manage settings and SMS tests.
- Managers are restricted to their assigned branch and can use operational dashboards, POS, inventory, reports, and notification workflows.
- Cashiers are restricted to their assigned branch and can perform checkout, issue receipts, manage customers, and capture desired-item requests.
- Inventory Staff are restricted to their assigned branch and can manage products and recorded stock movements.
- Delivery Staff accounts are seeded for future compatibility, but their operational delivery workspace is intentionally deferred to Phase 2.
- Demo Viewer has global read visibility while backend middleware blocks every data-changing request.

### Apply Sample Users to Neon

Run production migrations and the idempotent seed from a trusted local PowerShell terminal using the Neon direct connection URL:

```powershell
$env:DATABASE_URL = Read-Host "Paste Neon direct DATABASE_URL"
$env:NODE_ENV = "production"
$env:SEED_USER_PASSWORD = Read-Host "Password for newly created staff accounts"
$env:DEMO_VIEWER_PASSWORD = "DemoView@2026!"

npm.cmd run db:deploy --workspace @pos/api
npm.cmd run db:seed --workspace @pos/api

Remove-Item Env:DATABASE_URL
Remove-Item Env:NODE_ENV
Remove-Item Env:SEED_USER_PASSWORD
Remove-Item Env:DEMO_VIEWER_PASSWORD
```

`SEED_USER_PASSWORD` is applied only when a staff sample account is first created. Rerunning the seed does not reset existing staff passwords. Never commit a Neon connection URL or production password.

## Useful Commands

```bash
npm run lint
npm test
npm run build
npm run prisma:generate --workspace @pos/api
npm run db:migrate --workspace @pos/api -- --name init
npm run db:deploy --workspace @pos/api
npm run db:seed --workspace @pos/api
```

## Environment Variables

`apps/api/.env.example` contains safe placeholders. For local Docker development, populate `DATABASE_URL` with the local value shown in Setup. Replace `JWT_SECRET` before using any deployed environment.

```env
DATABASE_URL=""
DIRECT_URL=""
JWT_SECRET="replace-with-strong-secret"
JWT_EXPIRES_IN="12h"
PORT=4000
CORS_ORIGIN="http://localhost:5173"
SMS_PROVIDER=mock
SMS_AUTO_SEND_INVOICE=false
SMS_AUTO_SEND_STOCK_ALERT=false
TEXTLK_API_BASE_URL="https://app.text.lk/api/v3"
TEXTLK_API_TOKEN=""
TEXTLK_SENDER_ID="TextLKDemo"
TEXTLK_DRY_RUN=true
TEXTLK_SEND_ENDPOINT="/sms/send"
TEXTLK_TIMEOUT_MS=10000
TEXTLK_MESSAGE_TYPE="plain"
SEED_USER_PASSWORD=""
DEMO_VIEWER_PASSWORD="DemoView@2026!"
```

For the web app, copy `apps/web/.env.example` when you need to override its local API URL. Vercel must set `VITE_API_URL` to the Render service URL.

### Deployment Variable Ownership

- **Render API:** `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, and all `SMS_*` / `TEXTLK_*` runtime variables.
- **Vercel web:** only `VITE_API_URL=https://sri-lanka-pos-api.onrender.com` is required for the current frontend.
- `TEXTLK_API_TOKEN`, database URLs, JWT secrets, and seed passwords must never be added to Vercel or frontend source code.
- After any token or database credential exposure, regenerate or rotate it before deployment.

## Free Demo Deployment

The monorepo is prepared for a free demonstration deployment using Vercel for the frontend, a Render Free Web Service for the API, Neon PostgreSQL, and GitHub source hosting.

Follow the complete beginner-friendly instructions in [`docs/DEPLOYMENT_FREE_DEMO.md`](docs/DEPLOYMENT_FREE_DEMO.md). The guide includes the exact build/start commands, Neon migration and one-time seed process, environment variables, CORS setup, troubleshooting, security checklist, and live acceptance test.

After deploying the demo-role migration, run the seed once more against Neon with `DEMO_VIEWER_PASSWORD="DemoView@2026!"` to create or repair the read-only `demo@bookshop.lk` account. Existing staff users and passwords are preserved; the seed synchronizes only the dedicated demo password and enforces its restricted role and active status.

Free hosting is for demonstration only and must not be used for live business-critical POS data.

## Text.lk SMS Configuration

Real Text.lk secrets must only be placed in `apps/api/.env`. Do not commit that file and do not paste real API tokens into documentation, screenshots, or support tickets.

Use `SMS_PROVIDER=mock` for safe local/demo operation. To use the verified Text.lk API v3 integration, set `SMS_PROVIDER=textlk` and change `TEXTLK_DRY_RUN` to `false` only when you intentionally want to send a real SMS.

The Text.lk adapter uses the documented SMS endpoint and request body:

- `TEXTLK_API_BASE_URL`, default `https://app.text.lk/api/v3`
- `TEXTLK_SEND_ENDPOINT`, default `/sms/send`
- `TEXTLK_MESSAGE_TYPE`

The final URL is built as:

```text
https://app.text.lk/api/v3/sms/send
```

It sends:

```json
{
  "recipient": "947XXXXXXXX",
  "sender_id": "YOUR_APPROVED_SENDER_ID",
  "type": "plain",
  "message": "Invoice message"
}
```

Authorization is sent only in the `Authorization: Bearer TEXTLK_API_TOKEN` header. The API token is never included in the JSON body.

`TextLKDemo` can be used for testing when the Text.lk account supports it. Replace it later with a Sender ID approved for your account. Add the Sender ID in Admin Settings or set `TEXTLK_SENDER_ID` in `apps/api/.env`.

The UI shows only token status, never the full token. Provider responses are stored as safe/masked JSON.

To test from the terminal:

```bash
npm run test:textlk-sms --workspace @pos/api -- 0758396064
```

The dedicated command uses the same Text.lk provider as the application. With `TEXTLK_DRY_RUN=true`, it prints a safe payload and does not send. With `TEXTLK_DRY_RUN=false`, it sends a real SMS. Its default message is `POS SMS API test successful.` You may append a custom message after the phone number.

If the command prints `Text.lk mode: dry-run`, no API request is made. To intentionally test a real send, put a newly generated token in `apps/api/.env`, set `TEXTLK_DRY_RUN=false`, restart the API, and rerun the command. In Admin Settings select `Text.lk`; the test button now states whether it will run a dry-run or send a real SMS. The provider selected in the form is used for the test immediately, while **Save settings** persists it for invoice and desired-item SMS.

If a token is ever exposed in Git, logs, screenshots, or chat, revoke it and generate a replacement in Text.lk immediately.

To send a test SMS from the app: sign in as Admin, open Settings, enable SMS, choose Mock or Text.lk, enter `0758396064` or `94758396064`, and click Test SMS. Check Notifications for sent, dry-run, failed, or skipped status.

## Invoice SMS

After a sale, the POS opens the receipt page. Staff can click `Send SMS Invoice`. For a registered customer with a valid saved phone number, the invoice uses that number. For a walk-in sale or a customer without a phone number, the receipt asks staff for a Sri Lankan mobile number and an optional customer name before sending. The normalized phone is saved as a lightweight walk-in customer/contact record and linked to the sale without duplicating an existing contact with the same phone number.

If invoice auto-send is enabled in Settings and SMS is enabled, the backend queues/sends the invoice SMS automatically after checkout. Mock and Text.lk dry-run modes remain safe for development: they create the notification log without sending a real SMS.

SMS sending is a post-sale side effect. If SMS fails, the sale is not rolled back. The failed attempt is stored in Notifications and can be retried by Admin/Manager.

Sri Lankan phone numbers are normalized before SMS:

- `07XXXXXXXX` -> `947XXXXXXXX`
- `+947XXXXXXXX` -> `947XXXXXXXX`
- `947XXXXXXXX` stays unchanged

## Desired Item Workflow

1. Staff opens Desired Item Requests.
2. Staff records customer name, phone, requested item, branch, and notes.
3. When inventory staff adds or adjusts matching stock, the backend checks open requests by exact/partial product name, SKU, or barcode.
4. If approval is required, the request becomes pending review.
5. Admin/Manager can approve and send SMS.
6. Unsubscribed customers do not receive stock-alert SMS.

WhatsApp is kept as a placeholder flag for future integration.

## Printing and Exports

Receipt page supports thermal receipt layout and A4 invoice layout using browser print. Reports and key tables support authenticated CSV export from the UI.

## Future-Ready Design Notes

The database already has stable extension points for:

- Client website and mobile app using the same API/database
- Online order source tracking through `Sale.source`
- Reservations/COD workflows through future sale/order status extensions
- Delivery workflow with seeded delivery role
- WhatsApp provider addition through the notification provider pattern
- n8n automation through notification/audit/sale events
- OCR invoice upload with human review through future inventory movement references

## Verification Status

Passing:

```bash
npm run lint
npm run build --workspace @pos/api
npm run build --workspace @pos/web
npm run build --workspace @pos/shared
npm audit --audit-level=moderate
```

Included: an offline-generated initial Prisma SQL migration at `apps/api/prisma/migrations/20260706120000_init/migration.sql`.

Also included: additive migration `apps/api/prisma/migrations/20260706143000_business_sms_desired_items/migration.sql` for settings, SMS logs, and desired item requests.

Completed in this run: local PostgreSQL migration and seed verification with Docker Compose.

See [`docs/PHASE1_AUDIT_REPORT.md`](docs/PHASE1_AUDIT_REPORT.md) for requirements coverage, remaining Phase 1 gaps, deferred Phase 2 scope, risks, and the manual acceptance checklist.
