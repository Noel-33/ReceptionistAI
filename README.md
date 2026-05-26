# Receptionist AI

This repository contains the first application foundation for the Receptionist AI platform.

## Structure

- `apps/web`: Next.js customer and admin portal
- `apps/api`: NestJS backend API and background job entrypoint foundation
- `packages/config`: shared configuration placeholders
- `prisma`: database schema

## Local Setup

1. Copy `.env.example` to `.env`
2. Install dependencies with `npm install`
3. Run the web app with `npm run dev:web`
4. Run the API with `npm run dev:api`

## DeltaPrompt AI Portal

The DeltaPrompt AI business portal is seeded through the same multi-tenant framework as every other business account.

1. Make sure the database is migrated.
2. Run `npm run seed:deltaprompt` from the repo root.
3. Start the API with `npm run dev:api`.
4. Start the web app with `npm run dev:web`.
5. Open `http://localhost:3000/signin`.

Seeded login:

- Email: `admin@deltaprompt.ai`
- Password: `DeltaPrompt@2026`

The seed creates or refreshes the DeltaPrompt AI business profile, AI settings, lead-capture knowledge base, Growth billing setup, telephony placeholders, and demo call logs. After signing in, review `Knowledge Base` first, then add the Twilio Account SID, Auth Token, and testing phone number in `Telephony`.

## Current Scope

This initial scaffold includes:

- monorepo workspace setup
- Next.js app shell
- NestJS API shell
- Prisma starter schema
- environment template

No production features should be built or deployed without explicit approval.
