# Railway Deployment

This repo deploys as three Railway services:

- `receptionist-api`: NestJS API, Twilio webhooks, Google Calendar OAuth callback
- `receptionist-web`: Next.js portal/admin UI
- `Postgres`: Railway PostgreSQL database

## 1. Create Railway Services

1. Create an empty Railway project.
2. Add a PostgreSQL database service.
3. Add an API service from this GitHub repo.
4. Add a Web service from this same GitHub repo.
5. Generate public domains for both API and Web.

Use the repo root as the root directory for both app services because this is an npm workspace monorepo.

## 2. API Service Settings

Set the API service config file path to:

```text
/railway.api.json
```

Equivalent settings if entering them manually:

```text
Build command: npm run railway:build:api
Pre-deploy command: npm run railway:db:push
Start command: npm run railway:start:api
Healthcheck path: /api/health
```

API variables:

```text
NODE_ENV=production
HOST=0.0.0.0
APP_URL=https://YOUR_WEB_DOMAIN
DATABASE_URL=${{Postgres.DATABASE_URL}}
DIRECT_URL=${{Postgres.DATABASE_URL}}
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REDIRECT_URI=https://YOUR_API_DOMAIN/api/calendar/google/callback
CALENDAR_TOKEN_ENCRYPTION_KEY=base64-encoded-32-byte-key
```

Optional API variables:

```text
OPENAI_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
RESEND_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
REDIS_URL=
```

Generate a calendar encryption key locally with:

```bash
openssl rand -base64 32
```

## 3. Web Service Settings

Set the Web service config file path to:

```text
/railway.web.json
```

Equivalent settings if entering them manually:

```text
Build command: npm run railway:build:web
Start command: npm run railway:start:web
Healthcheck path: /signin
```

Web variables:

```text
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://YOUR_API_DOMAIN
NEXT_PUBLIC_APP_NAME=Receptionist AI
```

`NEXT_PUBLIC_API_URL` must be present before the web build runs because Next.js bundles public variables into the client build.

## 4. Google Cloud OAuth Update

In Google Cloud Console, open the OAuth 2.0 client and add this Authorized redirect URI:

```text
https://YOUR_API_DOMAIN/api/calendar/google/callback
```

If the app is still in Google testing mode, add every testing Gmail account under OAuth consent screen test users.

## 5. Seed DeltaPrompt AI

After the API deploys and the database has been pushed, run this one-off command in the API service:

```bash
npm run seed:deltaprompt
```

Then sign in through the Web domain:

```text
admin@deltaprompt.ai
DeltaPrompt@2026
```

## 6. Production Notes

- Keep `railway:db:push` only while the schema is evolving quickly. Before real customer data, switch to Prisma migrations and a `prisma migrate deploy` pre-deploy command.
- Manual two-way Google sync works now through `Sync now`. Automatic Google push webhooks should be added after the Railway API domain is live.
- Twilio voice webhooks should use the API domain once deployed.
