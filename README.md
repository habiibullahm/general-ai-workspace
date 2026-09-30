# Nibie

A provider-independent general-purpose AI chat workspace. The repository and infrastructure project remain named `general-ai-workspace`; product requirements and implementation guidance are maintained in [`docs/`](docs/).

## Local development

Requires Node.js 20.9 or newer and npm.

```bash
npm ci
npm run dev
```

Available checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`.

## Supabase and database setup

1. Create or select a Supabase project and copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_APP_URL` to the app's canonical origin, and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the Nibie Supabase project API settings. Do not use a secret/service-role key in the app.
3. Add `${NEXT_PUBLIC_APP_URL}/auth/callback` to the Supabase Auth redirect URL allowlist so email confirmation can return to the server callback.
4. Set `DATABASE_URL` to the project's PostgreSQL connection string. It is used only by Drizzle migrations; keep it server-side.
5. Apply schema changes with `npm run db:migrate`.

The initial migration creates the user, conversation, and message tables, creates user rows from Supabase Auth sign-ups, and enables owner-scoped RLS. Normal application data access must use the cookie-bound Supabase client and publishable key so Postgres evaluates RLS as the signed-in user. Do not use service-role or privileged direct database connections for user-data requests.

RLS integration tests require a disposable PostgreSQL database named exactly `general_ai_workspace_test`; they reset its app/auth schemas. Configure `TEST_DATABASE_URL` only for that dedicated test database, then run `npm run test:integration`. Never point this variable at staging or production.
