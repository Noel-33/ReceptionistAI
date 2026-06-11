# ReceptionistAI Operations Runbook

This runbook documents the procedures used to develop, configure, deploy, and verify the DeltaPrompt AI Receptionist portal.

The current product is a business portal and admin portal for DeltaPrompt AI's AI Receptionist service. It includes account sign-in, business dashboard views, call and AI settings surfaces, a knowledge base area, appointment management, Google Calendar connection, calendar health checks, and one-way plus two-way Google Calendar sync behavior.

Keep this file safe but not secret. It intentionally names environment variables and procedures without storing private credentials, tokens, database passwords, OAuth client secrets, or production account passwords.

## 1. System Overview

### Services

The project is deployed on Railway as separate services from the same repository:

| Service | Purpose | Public URL |
| --- | --- | --- |
| `portal` | Next.js web portal used by business users and admins | `https://portal-production-7bc2.up.railway.app` |
| `ReceptionistAI` | Backend API for auth, business data, appointments, Google Calendar, and integrations | `https://receptionistai-production-9aa7.up.railway.app` |
| `Postgres` | Railway PostgreSQL database | Private to Railway, exposed to services by env vars |

The root of the API service can return `Cannot GET /`. That is normal for the API. Verify the API with:

```bash
curl https://receptionistai-production-9aa7.up.railway.app/api/health
```

Use the web portal URL for browser access:

```text
https://portal-production-7bc2.up.railway.app/signin
```

### Major Portals

The web app contains two main experiences:

- Business portal: used by DeltaPrompt AI business users to manage calls, AI settings, knowledge base content, appointments, calendar sync, billing, and team areas.
- Admin portal: used by the platform admin to choose a business workspace, review account details, check system status, and manage the same business calendar from an admin context.

### Core Calendar Behavior

Google Calendar support is server-side OAuth. The backend stores encrypted calendar tokens, creates Google Calendar events when portal appointments are created, updates Google events when portal appointments are edited, deletes or cancels Google events when portal appointments are canceled, and can import external Google Calendar changes back into the portal during a sync.

The production Google OAuth callback must point to the API service, not the web portal:

```text
https://receptionistai-production-9aa7.up.railway.app/api/calendar/google/callback
```

For local development, the callback usually points to the local API:

```text
http://localhost:4000/api/calendar/google/callback
```

## 2. Repository Structure

Important files and folders:

| Path | Purpose |
| --- | --- |
| `apps/api` | Backend API service |
| `apps/web` | Next.js web portal |
| `prisma/schema.prisma` | Database schema |
| `package.json` | Workspace scripts for local runs, Railway builds, seeding, and Prisma |
| `.env.example` | Example environment variables |
| `railway.api.json` | Railway config for the API service |
| `railway.web.json` | Railway config for the web service |
| `RAILWAY_DEPLOYMENT.md` | Railway-specific deployment guide |
| `PROJECT_OPERATIONS_RUNBOOK.md` | This full operations guide |

## 3. Local Development Procedure

### Prerequisites

Install:

- Node.js 22 or compatible current LTS
- npm
- Git
- PostgreSQL locally, or use a Railway Postgres URL
- Railway CLI if you want to run with Railway variables

### Install Dependencies

From the repo root:

```bash
npm install
```

### Local Environment File

Create a local `.env` file from `.env.example`.

Required local values:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DIRECT_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
APP_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_NAME=Receptionist AI
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/calendar/google/callback
CALENDAR_TOKEN_ENCRYPTION_KEY=your-32-byte-or-longer-secret
HOST=0.0.0.0
NODE_ENV=development
```

Optional integration values:

```bash
OPENAI_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
RESEND_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
REDIS_URL=
```

Do not commit `.env`.

### Database Setup

For quick local setup or a new Railway prototype database:

```bash
npx prisma db push --schema prisma/schema.prisma
```

Then seed the DeltaPrompt workspace:

```bash
npm run seed:deltaprompt
```

For production-grade schema changes, prefer Prisma migrations:

```bash
npx prisma migrate dev --name describe_change
npx prisma migrate deploy
```

Use `db push` for prototyping and early setup. Use `migrate deploy` for production once migrations are established.

### Run Locally

Run the API:

```bash
npm run start:api
```

Run the web portal:

```bash
npm run start:web
```

If using dev scripts instead of production start scripts, use the scripts already defined in `package.json`.

Expected local URLs:

```text
API: http://localhost:4000
Web: http://localhost:3000
```

Check local API health:

```bash
curl http://localhost:4000/api/health
```

Open local web:

```text
http://localhost:3000/signin
```

## 4. Google Calendar Setup Procedure

### Google Cloud Project

1. Open Google Cloud Console.
2. Select the correct project for DeltaPrompt AI.
3. Go to APIs and Services.
4. Enable Google Calendar API.
5. Go to OAuth consent screen.
6. Set the app name, support email, developer contact email, and audience.
7. If the app is in testing mode, add test users who should be able to connect calendars.
8. Go to Credentials.
9. Create an OAuth 2.0 Client ID.
10. Choose Web application.

### Authorized Redirect URIs

Add local callback for development:

```text
http://localhost:4000/api/calendar/google/callback
```

Add production callback for Railway:

```text
https://receptionistai-production-9aa7.up.railway.app/api/calendar/google/callback
```

The redirect URI must match exactly. A different scheme, host, port, or path can cause `redirect_uri_mismatch`.

### Required Scopes

Use the smallest scope that supports the product's behavior.

Recommended current scope:

```text
https://www.googleapis.com/auth/calendar.events
```

This allows the app to view and edit events across calendars. If the product later needs calendar list selection, add:

```text
https://www.googleapis.com/auth/calendar.calendarlist.readonly
```

If the product only checks availability and does not create events, use:

```text
https://www.googleapis.com/auth/calendar.freebusy
```

### OAuth Variables

Set these on the API service:

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://receptionistai-production-9aa7.up.railway.app/api/calendar/google/callback
CALENDAR_TOKEN_ENCRYPTION_KEY=...
APP_URL=https://receptionistai-production-9aa7.up.railway.app
```

Do not put Google client secrets in the web service. OAuth token exchange belongs on the API.

### Testing Google Connection

1. Sign in to the portal.
2. Go to Calendar Sync.
3. Click Connect Google Calendar.
4. Choose the desired Google account.
5. Grant calendar permissions.
6. Confirm the portal shows the connected email.
7. Create a test appointment in the portal.
8. Open Google Calendar and confirm the event appears.
9. Edit the appointment in the portal and confirm the Google event changes.
10. Delete or cancel the appointment and confirm the Google event is removed or canceled.
11. Create an event directly in Google Calendar.
12. Run Sync Now in the portal.
13. Confirm the Google-created event appears in the portal if it meets the sync rules.

## 5. Railway Deployment Procedure

### Services Required

The Railway project should have:

- `ReceptionistAI` service for the API
- `portal` service for the web app
- `Postgres` service for the database

### Public Networking

The API and web services need public domains.

For the API service:

```text
https://receptionistai-production-9aa7.up.railway.app
```

For the web service:

```text
https://portal-production-7bc2.up.railway.app
```

Railway should provide a `PORT` variable automatically. The app must listen on:

```text
0.0.0.0:$PORT
```

The API also uses:

```bash
HOST=0.0.0.0
```

### Railway Variables for API Service

Set these on `ReceptionistAI`:

```bash
APP_URL=https://receptionistai-production-9aa7.up.railway.app
DATABASE_URL=${{Postgres.DATABASE_URL}}
DIRECT_URL=${{Postgres.DATABASE_URL}}
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://receptionistai-production-9aa7.up.railway.app/api/calendar/google/callback
CALENDAR_TOKEN_ENCRYPTION_KEY=your-generated-secret
HOST=0.0.0.0
NODE_ENV=production
```

Optional API variables:

```bash
OPENAI_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
RESEND_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
REDIS_URL=
```

Important: `DATABASE_URL=${{Postgres.DATABASE_URL}}` and `DIRECT_URL=${{Postgres.DATABASE_URL}}` are correct when the API service references the Railway Postgres service. Do not paste `localhost` database URLs into production service variables.

### Railway Variables for Web Service

Set these on `portal`:

```bash
APP_URL=https://portal-production-7bc2.up.railway.app
NEXT_PUBLIC_API_URL=https://receptionistai-production-9aa7.up.railway.app
NEXT_PUBLIC_APP_NAME=Receptionist AI
NODE_ENV=production
```

The web service does not need `DATABASE_URL`, `DIRECT_URL`, `GOOGLE_CLIENT_SECRET`, or `CALENDAR_TOKEN_ENCRYPTION_KEY`.

Because `NEXT_PUBLIC_*` values are compiled into the Next.js bundle, redeploy the web service after changing `NEXT_PUBLIC_API_URL`.

### Railway Config Files

Use:

```text
railway.api.json
railway.web.json
```

The API service should build and start with API-specific scripts.

The web service should build and start with web-specific scripts.

If a service deploys successfully but opens the wrong app, check that the Railway service is using the matching config file and start command.

### Database Initialization on Railway

After adding Postgres and setting API database variables:

```bash
npx prisma db push --schema prisma/schema.prisma
npm run seed:deltaprompt
```

When using Railway CLI:

```bash
railway link
railway run npx prisma db push --schema prisma/schema.prisma
railway run npm run seed:deltaprompt
```

If the CLI is linked to multiple services, select the API service or pass the service explicitly.

### Redeploy Procedure

After changing variables or code:

```bash
railway redeploy --service ReceptionistAI --yes
railway redeploy --service portal --yes
```

Then verify both services.

### Production Verification

API health:

```bash
curl https://receptionistai-production-9aa7.up.railway.app/api/health
```

Expected result includes:

```json
{
  "status": "ok"
}
```

Sign-in API:

```bash
curl -X POST https://receptionistai-production-9aa7.up.railway.app/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@deltaprompt.ai","password":"REDACTED"}'
```

Do not store the real password in this file.

Portal:

```text
https://portal-production-7bc2.up.railway.app/signin
```

After sign-in, check:

- Dashboard loads.
- Admin portal loads if the account has admin access.
- Appointments page loads.
- Calendar Sync page shows Google connection status.
- New appointment can be created.
- A created appointment appears in Google Calendar.
- Sync Now imports eligible external Google events.

## 6. Calendar Sync Operating Procedure

### Connect a Calendar

1. Sign in as the business owner or admin.
2. Open Calendar Sync.
3. Click Connect Google Calendar.
4. Complete Google OAuth.
5. Confirm the connected account email appears.
6. Click Check if the health panel is available.

### Create Appointment from Portal

1. Open Appointments.
2. Click New Appointment.
3. Enter title, date and time, duration, customer name, phone, optional email, service type, status, and notes.
4. Save.
5. Confirm the event appears in the portal calendar.
6. Confirm the event appears in the connected Google Calendar.

### Edit Appointment from Portal

1. Click an existing appointment.
2. Change time, duration, customer info, notes, or status.
3. Save.
4. Confirm the Google event updates.

### Cancel or Delete Appointment

1. Open the appointment.
2. Cancel or delete it.
3. Confirm the portal status changes.
4. Confirm the Google Calendar event is canceled or removed according to the app behavior.

### Import External Google Events

1. Create a normal event directly in Google Calendar.
2. Return to the portal.
3. Click Sync Now.
4. Confirm the sync result says how many events were imported, updated, or canceled.
5. Check the portal calendar.

### Calendar Health Panel

The health panel should answer:

- Is a calendar connected?
- Which Google account is connected?
- When did the last sync run?
- Did the last sync succeed?
- How many events were imported, updated, or canceled?
- What was the latest error, if any?

Use this panel first when calendar sync does not behave as expected.

## 7. Troubleshooting

### Browser Shows `Cannot GET /`

Cause: You opened the API service root.

Fix:

- Use `/api/health` to check the API.
- Use the `portal` service URL for the web app.

Correct URLs:

```text
API health: https://receptionistai-production-9aa7.up.railway.app/api/health
Web portal: https://portal-production-7bc2.up.railway.app/signin
```

### Sign-In Shows Internal Server Error

Likely causes:

- `DATABASE_URL` is missing or wrong.
- `DATABASE_URL` points to localhost in Railway.
- Prisma schema was not pushed to the database.
- DeltaPrompt seed data was not created.
- API service was not redeployed after variable changes.

Fix:

1. Confirm API service has:

```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
DIRECT_URL=${{Postgres.DATABASE_URL}}
```

2. Run schema setup:

```bash
npx prisma db push --schema prisma/schema.prisma
```

3. Run seed:

```bash
npm run seed:deltaprompt
```

4. Redeploy API.
5. Test `/api/health`.
6. Test sign-in API.

### Web Portal Calls Localhost in Production

Symptom:

- Browser developer tools show requests to `localhost:4000`.
- Production login or calendar actions fail.

Cause:

- `NEXT_PUBLIC_API_URL` is wrong or was changed without redeploying the web service.

Fix:

```bash
NEXT_PUBLIC_API_URL=https://receptionistai-production-9aa7.up.railway.app
```

Then redeploy `portal`.

### Google OAuth Shows `access_denied`

Likely cause:

- Google OAuth app is in testing mode and the selected Google account is not listed as a test user.

Fix:

1. Go to Google Cloud Console.
2. Open OAuth consent screen.
3. Add the Google account under test users.
4. Save.
5. Try Connect Google Calendar again.

### Google OAuth Shows `redirect_uri_mismatch`

Likely cause:

- `GOOGLE_REDIRECT_URI` does not exactly match an authorized redirect URI in Google Cloud Console.

Fix:

1. In Railway API service, confirm:

```bash
GOOGLE_REDIRECT_URI=https://receptionistai-production-9aa7.up.railway.app/api/calendar/google/callback
```

2. In Google Cloud Console, add the exact same URI under the OAuth client.
3. Redeploy API.
4. Retry OAuth.

### Calendar Connects but Appointment Does Not Appear in Google

Likely causes:

- OAuth token is missing required scope.
- Token refresh failed.
- Calendar API is not enabled.
- Appointment save succeeded locally but Google event creation failed.
- `CALENDAR_TOKEN_ENCRYPTION_KEY` changed after tokens were stored.
- API logs contain a Google API error.

Fix:

1. Click Check in the calendar health panel.
2. Review API logs in Railway.
3. Confirm Google Calendar API is enabled.
4. Disconnect and reconnect Google Calendar to refresh scopes.
5. Create a new test appointment.
6. If tokens cannot decrypt after an encryption key change, reconnect the calendar.

### Sync Now Imports 0 Events

This can be valid if no eligible Google events exist in the sync window.

Check:

- The Google event is on the connected account's calendar.
- The Google event is not outside the app's sync window.
- The Google event is not already linked or ignored.
- The event has a normal start and end time.
- The health panel shows a successful sync.

### Railway Service Has No Public URL

Fix:

1. Open the service in Railway.
2. Go to Settings.
3. Go to Networking.
4. Under Public Networking, click Generate Domain.
5. Use the correct service port if Railway asks for it.

For this project:

- Web service normally listens on the web start script port.
- API service should listen on `0.0.0.0:$PORT`.

### Wrong Service Has Wrong Variables

API-only variables:

- `DATABASE_URL`
- `DIRECT_URL`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `CALENDAR_TOKEN_ENCRYPTION_KEY`
- Twilio, OpenAI, Stripe, Redis, Resend secret values

Web-only variables:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_APP_NAME`

Shared safe values:

- `NODE_ENV`
- `APP_URL`, but use the service's own public URL

## 8. Secret Handling Procedure

### Never Commit

Never commit:

- `.env`
- Google client secret JSON files
- Railway database URLs with passwords
- Twilio auth tokens
- OpenAI API keys
- Stripe keys
- Resend keys
- Calendar encryption keys
- Production passwords

### Rotation Procedure

If a secret is exposed:

1. Rotate it at the provider.
2. Update Railway service variables.
3. Redeploy affected services.
4. Test the affected integration.
5. Remove the secret from shell history, docs, screenshots, and chats when possible.
6. If committed to Git, rotate the secret even if the commit is later removed.

### Google Client Secret Rotation

1. Open Google Cloud Console.
2. Go to Credentials.
3. Open the OAuth 2.0 client.
4. Create or rotate the client secret.
5. Update `GOOGLE_CLIENT_SECRET` on the API service.
6. Redeploy API.
7. Test Google Calendar connect.

### Calendar Token Encryption Key

`CALENDAR_TOKEN_ENCRYPTION_KEY` protects stored Google tokens.

Do not change it casually. If it changes, existing connected calendars may need to reconnect because stored tokens may no longer decrypt.

## 9. Admin Portal Procedure

### Access

1. Open the portal sign-in page.
2. Sign in with an account that has admin privileges.
3. Navigate to `/admin` if needed.

Production admin path:

```text
https://portal-production-7bc2.up.railway.app/admin
```

### Business Workspace Review

1. Use the workspace selector.
2. Choose DeltaPrompt AI.
3. Review account profile.
4. Review usage and plan details.
5. Review system status.
6. Use the embedded business calendar area to create, edit, or review appointments without switching portals.

### Admin Calendar Management

Admin calendar actions should follow the same backend sync rules as the business portal:

- Creating an appointment creates a Google Calendar event.
- Editing an appointment updates the Google event.
- Canceling an appointment cancels or removes the Google event.
- Sync Now imports eligible Google Calendar changes.

If the admin calendar works but the business portal calendar does not, compare the API requests and selected business ID.

## 10. Release Procedure

### Before Code Changes

1. Check git status.
2. Confirm which service the change affects: API, web, or both.
3. Avoid editing unrelated files.
4. Keep secrets out of commits.

### After Code Changes

Run relevant local checks:

```bash
npm run lint
npm run build
```

If build scripts are split:

```bash
npm run railway:build:api
npm run railway:build:web
```

For database changes:

```bash
npx prisma generate
npx prisma db push --schema prisma/schema.prisma
```

For production migration workflow:

```bash
npx prisma migrate dev --name describe_change
npx prisma migrate deploy
```

### Deploy

1. Push code to GitHub.
2. Wait for Railway auto-deploy, or redeploy manually.
3. Check Railway logs.
4. Verify API health.
5. Verify portal page load.
6. Verify sign-in.
7. Verify calendar connect and appointment creation if calendar code changed.

## 11. Recommended Hardening Roadmap

The product works as a prototype-to-production portal, but these are the recommended next steps:

1. Move production schema changes from `prisma db push` to committed Prisma migrations and `prisma migrate deploy`.
2. Add Google push notifications or scheduled background sync so external Google changes arrive automatically instead of only on manual Sync Now.
3. Add a calendar selector for users with multiple Google calendars.
4. Add sync conflict handling for cases where the same appointment changes in the portal and Google.
5. Add admin-facing sync logs with raw Google error codes hidden behind a details drawer.
6. Add email or SMS alerts when calendar sync fails repeatedly.
7. Add role-based permission gates around admin calendar actions.
8. Add automated end-to-end tests for sign-in, appointment creation, Google connect mock flow, and admin workspace calendar actions.
9. Add production monitoring for API health, database connectivity, and failed calendar jobs.
10. Add a formal incident procedure for OAuth secret exposure, database outage, and Twilio webhook failures.

## 12. Quick Command Reference

Install:

```bash
npm install
```

Push schema:

```bash
npx prisma db push --schema prisma/schema.prisma
```

Seed DeltaPrompt:

```bash
npm run seed:deltaprompt
```

Run API:

```bash
npm run start:api
```

Run web:

```bash
npm run start:web
```

API health local:

```bash
curl http://localhost:4000/api/health
```

API health production:

```bash
curl https://receptionistai-production-9aa7.up.railway.app/api/health
```

Redeploy API:

```bash
railway redeploy --service ReceptionistAI --yes
```

Redeploy web:

```bash
railway redeploy --service portal --yes
```

Use Railway variables locally:

```bash
railway run npm run start:api
```

## 13. Official References

- Railway variables: `https://docs.railway.com/variables`
- Railway public networking: `https://docs.railway.com/public-networking`
- Railway PostgreSQL: `https://docs.railway.com/databases/postgresql`
- Google OAuth web server flow: `https://developers.google.com/identity/protocols/oauth2/web-server`
- Google Calendar API scopes: `https://developers.google.com/workspace/calendar/api/auth`
- Prisma `db push`: `https://www.prisma.io/docs/orm/reference/prisma-cli-reference#db-push`
- Prisma production migrations: `https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production`
