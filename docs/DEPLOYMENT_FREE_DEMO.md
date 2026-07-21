# Free Demo Deployment: Vercel + Render + Neon

This guide deploys the existing monorepo as:

- React/Vite frontend on Vercel
- Express API on a Render Free Web Service
- PostgreSQL database on Neon Free
- Source code on GitHub

This setup is suitable for demonstrations and evaluation only. Free hosting is not appropriate for real production POS data or business-critical shop operation.

## Before You Start

Create free accounts at [GitHub](https://github.com/), [Neon](https://neon.com/), [Render](https://render.com/), and [Vercel](https://vercel.com/). Keep the repository root as the build root on both Render and Vercel because this project uses npm workspaces and `packages/shared`.

The repository requests Node.js 22 through its root `engines` field so both hosting platforms use a runtime compatible with the installed Vite version.

Run these checks locally from the repository root:

```powershell
npm install
npm run prisma:generate --workspace @pos/api
npm run lint
npm run build
npm audit --audit-level=moderate
```

Never place a real database URL, JWT secret, seed password, or SMS token in a tracked file.

## Step 1: Push Code to GitHub

Review the working tree before publishing it:

```powershell
git status
git add .
git commit -m "Prepare free demo deployment"
git branch -M main
```

Create an empty GitHub repository without generating another README or `.gitignore`. Connect it and push:

```powershell
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git push -u origin main
```

If `origin` already exists, inspect it with `git remote -v` and do not add it again. Confirm on GitHub that no `.env` file or credential was uploaded.

## Step 2: Create the Neon PostgreSQL Database

1. In Neon, create a new project for the POS demo.
2. Choose a region near the Render service region when possible.
3. Open the project's connection details.
4. Copy both connection strings:
   - **Pooled connection:** hostname normally contains `-pooler`; use this for the running Render API.
   - **Direct connection:** hostname does not contain `-pooler`; use this for Prisma migrations and the one-time seed.
5. Ensure the URLs include `sslmode=require`.

This Prisma schema intentionally uses only `DATABASE_URL`. `DIRECT_URL` is reserved in `.env.example` for a future dual-URL setup and is not currently required. For migration commands, temporarily put the Neon direct URL in `DATABASE_URL`. For Render runtime, use the pooled URL in `DATABASE_URL`.

Do not save either URL in Git.

## Step 3: Configure the Render Backend

The repository contains [`render.yaml`](../render.yaml). The easiest setup is a Render Blueprint:

1. In Render, select **New > Blueprint**.
2. Connect the GitHub repository.
3. Select the repository's root `render.yaml`.
4. Keep the repository **Root Directory blank** so commands run from the monorepo root.
5. Choose the Free instance when prompted.
6. Enter the requested secret values:
   - `DATABASE_URL`: Neon **pooled** connection URL.
   - `CORS_ORIGIN`: temporarily use `http://localhost:5173`, or the expected Vercel production URL if already known.
   - `SEED_USER_PASSWORD`: a strong demo password used only when you manually seed.
7. Render generates `JWT_SECRET`; do not replace it with a short or predictable value.

The committed Render settings are:

```text
Root Directory: repository root (blank)
Build Command: npm ci --include=dev && npm run prisma:generate --workspace @pos/api && npm run build --workspace @pos/api
Start Command: npm run start --workspace @pos/api
Health Check Path: /health
Instance Type: Free
```

The API binds to `0.0.0.0` and uses Render's `PORT` automatically. Docker is not used on Render. Migrations and seed data are deliberately not run in the start command.

If you configure a Web Service manually instead of using the Blueprint, copy the commands and environment values above exactly.

`--include=dev` is required during the API build because TypeScript, Prisma CLI, and the Express/CORS type declarations are build-time development dependencies. Render can still run the compiled service with `NODE_ENV=production`; these packages are needed to create `dist`, not by the `start` command.

## Step 4: Run the Prisma Migrations Against Neon

Render Free services do not provide an interactive shell, so run production migrations from your trusted local checkout. Use the Neon **direct** connection string for this command.

PowerShell:

```powershell
$env:DATABASE_URL = Read-Host "Paste the Neon direct connection URL"
npm run db:deploy --workspace @pos/api
Remove-Item Env:DATABASE_URL
```

Bash/zsh:

```bash
read -s -p "Neon direct connection URL: " DATABASE_URL
export DATABASE_URL
npm run db:deploy --workspace @pos/api
unset DATABASE_URL
```

The command uses `prisma migrate deploy`. Never use `prisma migrate dev`, `prisma db push`, or `prisma migrate reset` against the demo database.

For future schema changes, commit a reviewed migration locally and rerun `db:deploy` against Neon before relying on the new API version.

## Step 5: Seed Production Demo Data Once

Use the Neon direct URL again and choose a strong password for the five demo users. Do not use `Password123!` on a deployed database.

PowerShell:

```powershell
$env:DATABASE_URL = Read-Host "Paste the Neon direct connection URL"
$env:SEED_USER_PASSWORD = Read-Host "Choose a strong demo-user password"
$env:NODE_ENV = "production"
npm run db:seed --workspace @pos/api
Remove-Item Env:DATABASE_URL, Env:SEED_USER_PASSWORD, Env:NODE_ENV
```

Bash/zsh:

```bash
read -s -p "Neon direct connection URL: " DATABASE_URL
echo
read -s -p "Strong demo-user password: " SEED_USER_PASSWORD
echo
export DATABASE_URL SEED_USER_PASSWORD NODE_ENV=production
npm run db:seed --workspace @pos/api
unset DATABASE_URL SEED_USER_PASSWORD NODE_ENV
```

The seed uses unique-key upserts and no-op updates for existing demo users, products, and stock. Rerunning it creates missing seed records without duplicating or resetting existing stock, passwords, or role assignments. It should still be treated as a controlled administrative command, not a startup task.

## Step 6: Verify the Render API

Wait for the Render deployment to finish, then open:

```text
https://YOUR-RENDER-SERVICE.onrender.com/health
```

Expected response:

```json
{ "ok": true }
```

If the first request is slow, allow the Free service time to wake. Check Render **Logs** if health does not return HTTP 200.

## Step 7: Deploy the Vercel Frontend

The repository contains [`vercel.json`](../vercel.json), including the Vite build and React Router SPA fallback.

1. In Vercel, select **Add New > Project**.
2. Import the same GitHub repository.
3. Keep **Root Directory** at the repository root; do not select `apps/web`.
4. Use the Vite framework preset.
5. The committed settings resolve to:

```text
Install Command: npm install
Build Command: npm run build --workspace @pos/web
Output Directory: apps/web/dist
```

The root directory is intentional. Setting it to `apps/web` can hide the root workspace lockfile and `packages/shared` during the build.

## Step 8: Set `VITE_API_URL` in Vercel

In Vercel **Project Settings > Environment Variables**, add:

```text
Name: VITE_API_URL
Value: https://YOUR-RENDER-SERVICE.onrender.com
Environment: Production
```

Do not add `/api` and do not use `localhost`. Apply it to Preview only if preview deployments are intentionally supported. Redeploy the frontend after changing a Vite environment variable because it is embedded at build time.

## Step 9: Set Render `CORS_ORIGIN` to the Vercel URL

After Vercel gives you the stable production URL, open Render **Environment** and set:

```text
CORS_ORIGIN=https://YOUR-PROJECT.vercel.app
```

Use the exact scheme and hostname with no trailing slash. Save the value and allow Render to redeploy/restart the API.

The API supports multiple explicit origins as a comma-separated list, for example:

```text
https://YOUR-PROJECT.vercel.app,http://localhost:5173
```

Do not use `*` for the demo. Random Vercel preview URLs will not be allowed unless each origin is explicitly configured.

## Step 10: Test the Live Demo

Use the Vercel production URL and the password chosen during Step 5.

1. Sign in as each required seeded role.
2. Confirm Cashier cannot access Settings or Reports.
3. Open POS, select an in-stock product, and complete a small cash sale.
4. Confirm the receipt opens and browser print preview works.
5. Confirm branch stock decreased and a stock movement was recorded.
6. Add or adjust inventory with a reason.
7. Open Dashboard and Reports and verify the new sale totals.
8. Open Settings and confirm `mock` is the SMS provider.
9. Run a test SMS or invoice SMS and verify a notification log is created without sending a real message.
10. Reopen `/reports` or a receipt URL directly to confirm the Vercel SPA rewrite works.

Delete obviously artificial sale/customer data before presenting the final demo if it would confuse the audience.

## Environment Variable Reference

### Render API

| Variable                    | Demo value or source                                | Required        |
| --------------------------- | --------------------------------------------------- | --------------- |
| `DATABASE_URL`              | Neon pooled connection URL                          | Yes             |
| `JWT_SECRET`                | Render-generated strong secret                      | Yes             |
| `JWT_EXPIRES_IN`            | `12h`                                               | Yes             |
| `CORS_ORIGIN`               | Exact Vercel production URL                         | Yes             |
| `SMS_PROVIDER`              | `mock`                                              | Yes             |
| `SMS_AUTO_SEND_INVOICE`     | `false`                                             | Yes             |
| `SMS_AUTO_SEND_STOCK_ALERT` | `false`                                             | Yes             |
| `TEXTLK_DRY_RUN`            | `true`                                              | Yes             |
| `SEED_USER_PASSWORD`        | Strong demo password; only used by manual seed      | Seed only       |
| `PORT`                      | Supplied automatically by Render                    | No manual value |
| `DIRECT_URL`                | Reserved; not consumed by the current Prisma schema | No              |
| `TEXTLK_API_TOKEN`          | Leave unset for mock demo                           | No              |

### Vercel Web

| Variable       | Value                                      |
| -------------- | ------------------------------------------ |
| `VITE_API_URL` | `https://YOUR-RENDER-SERVICE.onrender.com` |

## Common Errors and Fixes

### Browser reports a CORS error

- Confirm Render `CORS_ORIGIN` exactly matches the browser's Vercel origin.
- Include `https://`; remove paths and trailing slashes.
- Restart/redeploy Render after changing it.
- A Vercel preview URL is a different origin from the production URL.

### Prisma migration fails

- Confirm `DATABASE_URL` is the Neon direct, non-`-pooler` URL for migration commands.
- Confirm `sslmode=require` is present.
- Run `npm run prisma:generate --workspace @pos/api`, then retry `npm run db:deploy --workspace @pos/api`.
- Do not solve a production migration failure with `migrate reset` or `db push`.

### Render service is sleeping or the first request is slow

Render Free web services sleep after inactivity and can take roughly a minute to wake. Open the `/health` URL first and wait for HTTP 200 before opening the POS frontend. This is normal for a free demo and is not acceptable for an always-on shop POS.

### Render build cannot find Express types or reports implicit `any`

- Confirm the build command begins with `npm ci --include=dev`.
- Do not use plain `npm install` when `NODE_ENV=production` is present during the build, because npm can omit TypeScript and `@types/*` development dependencies.
- Commit and push the updated `render.yaml`, allow the Blueprint to sync, then choose **Manual Deploy > Clear build cache & deploy**.

### Frontend calls localhost or the wrong backend

- Ensure Vercel has `VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com`.
- Do not append `/api`.
- Redeploy Vercel after changing the variable.
- Inspect the failed request URL in the browser network panel.

### Database connection failed

- Confirm the full Neon URL is stored in Render without accidental spaces or quotes added by the dashboard.
- Confirm the database/branch still exists and `sslmode=require` is present.
- Use the pooled URL for Render runtime and the direct URL for administrative migration/seed commands.
- Check Neon connection limits and Render logs for the Prisma error code.

### Seed reports duplicates or is rerun

The current seed is idempotent for its stable unique keys. Rerun only after migrations succeed and always provide `SEED_USER_PASSWORD`. If manually created data conflicts with a seed SKU, barcode, phone, or email, inspect the conflict instead of deleting production-like data or resetting the database.

### Vercel returns 404 on a nested route

Confirm the root `vercel.json` was used and that the deployment includes its SPA rewrite. The Vercel project Root Directory must remain the repository root for this configuration.

## Security and Demo Operations Checklist

- Never commit `.env` files; only commit `.env.example` placeholders.
- Never expose or paste the Text.lk token into Vercel, frontend code, logs, GitHub, or screenshots.
- Use a long randomly generated `JWT_SECRET` and rotate it if exposed.
- Keep `SMS_PROVIDER=mock` and `TEXTLK_DRY_RUN=true` for this demo.
- Change default seeded passwords before any hosted or real production use.
- Restrict access to the Render, Neon, Vercel, and GitHub accounts and enable MFA.
- Use Neon export/backup capabilities before retaining any important demonstration data.
- Do not store real customer PII, payment details, or live shop records on free demo services.
- Do not use Render/Vercel/Neon free hosting for a live business-critical POS.

## Deployment Order Summary

1. Push the reviewed repository to GitHub.
2. Create Neon and copy pooled/direct URLs.
3. Create the Render API from `render.yaml` with the pooled URL.
4. Apply migrations to Neon using the direct URL and `db:deploy`.
5. Seed once using the direct URL and a strong demo password.
6. Verify Render `/health`.
7. Import the repository into Vercel with repository-root settings.
8. Set `VITE_API_URL` and redeploy Vercel.
9. Set Render `CORS_ORIGIN` to the stable Vercel URL.
10. Run the live acceptance checklist.

Official references: [Render Blueprints](https://render.com/docs/blueprint-spec), [Render free services](https://render.com/docs/free), [Vercel monorepos](https://vercel.com/docs/monorepos), [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Neon pooling](https://neon.com/docs/connect/connection-pooling), and [Prisma production migrations](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production).
