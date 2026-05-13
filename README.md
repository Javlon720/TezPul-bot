
# Telegram SaaS Referral System

Production-ready Telegram SaaS referral backend using Node.js, PostgreSQL, dotenv, pg, axios, and node-telegram-bot-api.

## Features

- User and admin bot separation
- Backend-only business logic
- Environment validation and startup checks
- PostgreSQL schema with referrals, payments, campaigns, admin channels, and user state machine
- Reliable webhook or polling startup
- Safe Telegram send wrapper with retry and block handling
- Central callback router and stateful user flow
- Language support for uz, ru, en

## Required Environment Variables

Fill `.env` with:

```env
USER_BOT_TOKEN=
ADMIN_BOT_TOKEN=
WEBHOOK_URL=
WEBHOOK_PORT=3000
WEBHOOK_SECRET=
DATABASE_URL=postgresql://user:password@localhost:5432/telegram_saas
SUPER_ADMIN_ID=
NODE_ENV=development
LOG_LEVEL=info
```

## Run

```bash
pnpm install
pnpm start
```

## Structure

- `src/app.js` — application entry point
- `src/config/index.js` — validated config loader
- `src/db/pool.js` — PostgreSQL pool and transaction helper
- `src/db/schema/schema.sql` — schema definition
- `src/db/migrations/001_initial.sql` — initial schema migration
- `src/db/queries/` — database queries by domain
- `src/core/` — business engines and routers
- `src/bots/` — user and admin bot modules
- `src/services/` — startup and i18n services
- `src/utils/` — logger, validators, safe Telegram send
- `locales/` — translated messages
