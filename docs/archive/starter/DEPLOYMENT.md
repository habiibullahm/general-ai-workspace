# DEPLOYMENT — Nibie

> How changes reach production and how readiness is decided. A successful build is not production-ready.

## Project-specific overrides

> Written for this project. Where these notes and the generated sections below disagree, these notes win.

Target READY FOR PILOT. Preserve locked architecture: Next.js, PostgreSQL, configurable AI provider, Vercel; modular monolith, server-side provider calls, owner-scoped conversations, no vector search. Use Supabase Auth with server-managed cookie sessions, Supabase PostgreSQL, and Drizzle for schema/migrations. Attachment storage provider/limits and exact AI provider/model IDs remain deferred. Do not require source imports, RAG readiness, factual-source evaluation, or no-answer metrics. Model secrets stay server-side; document adapter-specific environment names when provider is selected.

## Target

| Field | Value |
| --- | --- |
| Deployment type | Public application |
| Platform | Vercel |
| Environments | local → staging → production |

## Production workflow

```text
Implementation
↓
Lint / Typecheck
↓
Tests
↓
AI Evaluation
↓
Security Review
↓
Production Readiness
↓
Staging
↓
Migration
↓
E2E
↓
Staging Evaluation
↓
Deploy Production
↓
Production Smoke Test
↓
Monitoring
```

## Stages

| Stage | Purpose | Commands / checks | Exit criteria |
| --- | --- | --- | --- |
| Implementation | Build the vertical slice, then complete the in-scope features. | Follow BUILD_PROMPT.md | All PRD.md acceptance criteria implemented. |
| Lint / Typecheck | Catch defects before tests run. | `npm run lint`<br>`npm run typecheck` | Zero errors. |
| Tests | Unit and integration tests for modules and API. | `npm test` | All tests pass. |
| AI Evaluation | Measure AI behaviour against EVALUATION.md thresholds. | `npm run eval -- --dataset curated,held-out,regression` | Every category meets its target. |
| Security Review | Dependencies, secrets, input validation, authorization, prompt injection. | `npm audit --audit-level=high`<br>Scan for committed secrets (e.g., gitleaks) | No high/critical findings open. |
| Production Readiness | Production build, config validation, error handling, logging. | `npm run build` | Build succeeds with production config; required env vars documented. |
| Staging | Deploy to a staging environment on Vercel. | Vercel preview deployment from the release branch | Staging is reachable and healthy. |
| Migration | Apply versioned database migrations. | `npm run db:migrate` | Schema version matches the release. |
| E2E | Critical user journeys in a real browser against staging. | `npx playwright test` | All critical journeys pass. |
| Staging Evaluation | Re-run held-out and regression datasets against staging data and config. | `npm run eval -- --target staging --dataset held-out,regression` | Thresholds met on staging. |
| Deploy Production | Release the verified build. | Promote the verified build to Vercel production | Production serves the new version. |
| Production Smoke Test | Verify the critical path on the live URL. | `npm run test:smoke -- --base-url "$PRODUCTION_URL"` | Smoke suite passes; otherwise roll back. |
| Monitoring | Watch application and provider reliability, latency, and cost. | Dashboards + alerts (see Monitoring) | Alerts routed to an owner. |

## Environment variables

Names only. Values live in the platform’s secret store and are never committed.

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Canonical app origin used for auth confirmation callbacks |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key; RLS protects user data |
| `DATABASE_URL` | Server-only PostgreSQL migration connection |
| `AI_BASE_URL` | Provider endpoint (OpenAI-compatible or adapter-specific) |
| `AI_API_KEY` | Server-side only |
| `AI_MODEL_FAST` | Provider model mapped to the `Fast` mode in the model picker; server-only. Optional (see below) |
| `AI_MODEL_BALANCED` | Provider model mapped to the `Balanced` mode; server-only. Optional (see below) |
| `AI_MODEL_REASONING` | Provider model mapped to the `Reasoning` mode; server-only. Optional (see below) |
| `AI_REASONING_MODES` | Optional. Comma-separated modes (for example `Reasoning`) whose provider model has been verified to honour a reasoning effort. Empty or unset hides the Reasoning control |
| `AI_PROVIDER` | Server-side adapter name; currently `openai-compatible` |
| `RATE_LIMIT_PER_MINUTE` | Requests per client per minute |
| `APP_ENV` | development \| staging \| production |

The `openai-compatible` adapter sends server-side streaming requests to `${AI_BASE_URL}/chat/completions` using the configured model mapping and an authorization bearer token. Keep every `AI_*` variable server-only; diagnostics may name missing variables but must never include their values.

### Model picker and reasoning control

The composer offers only the modes that have a model configured: set any one or more of `AI_MODEL_FAST`, `AI_MODEL_BALANCED`, `AI_MODEL_REASONING` (at least one is required). The client can only name `Fast`, `Balanced` or `Reasoning`; the provider model id is resolved on the server, and a mode that is not configured is rejected with a 400. The model name shown next to each mode is the configured value; the provider URL and key never leave the server.

The Reasoning control (Auto / Low / Medium / High) is shown only for modes listed in `AI_REASONING_MODES`, and the route rejects a non-Auto effort for any other mode. Only list a mode after verifying that its provider model validates and honours `reasoning_effort`; a provider that accepts any value (including an invalid one) does not count as support. `Auto` never sends the parameter.

## Release gate

### M4 authenticated verification

Production deploys from `main` through the Git-connected Vercel project `nibie` at https://nibie-ai.vercel.app. M4 and M5 are merged into `main`; the former `master` branch has been retired and its full history lives in `main`.

Apply the additive chat-generation migration after testing it on the dedicated loopback database. Runtime RPCs use the authenticated Supabase client and RLS; migration credentials must never be used for normal user-data requests.

Run `npm run test:chat:e2e` with `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` for a dedicated confirmed test account. Store credentials in a gitignored local environment file or the secret store. `E2E_BASE_URL` optionally targets a deployment; otherwise the test uses the local dev server. The command fails if test credentials are missing. The general browser suite skips this credential-dependent case when credentials are absent; that skip does not satisfy M4 acceptance.

The test verifies login, conversation creation, real provider SSE, terminal persistence, refresh/reopen, and sign-in again. Provider configuration must be real, and the six required `AI_*` variables must be available server-side. Sensitive Vercel variables pulled as `[SENSITIVE]` are not usable local configuration.

M4 passed this journey and is merged. Rate limiting, evaluation, request tracing, and remaining release hardening follow the working core slice and remain required before production release.

### Pilot gate

Target: **READY FOR PILOT** · Current state: **NOT READY**

- [ ] Implementation — All in-scope PRD features implemented
- [ ] Lint / Typecheck — Zero lint and type errors
- [ ] Tests — Unit and integration tests pass
- [ ] Database — Migrations applied; schema verified
- [ ] Evaluation — Curated + held-out evaluation thresholds met
- [ ] Security — Security review complete, no high/critical findings
- [ ] Staging — Deployed and healthy in staging
- [ ] E2E — Critical journeys pass against staging
- [ ] Staging Evaluation — Evaluation passes on staging
- [ ] Deployment — Deployed to production
- [ ] Production Smoke — Smoke tests pass on the live URL

Out of scope for this target (required only for a later release level): Monitoring, Rollback.

## Release states

| State | Requires |
| --- | --- |
| NOT READY | Default until the staging items pass |
| READY FOR STAGING | All previous items plus: Implementation, Lint / Typecheck, Tests, Database, Evaluation, Security |
| READY FOR PUBLIC DEMO | All previous items plus: Staging, E2E, Staging Evaluation |
| READY FOR PILOT | All previous items plus: Deployment, Production Smoke |
| PRODUCTION READY | All previous items plus: Monitoring, Rollback |

## Monitoring

- Request error rate
- Stream failure rate and abort rate
- Provider latency and application/API latency
- Token usage and cost per conversation
- Rate-limit rejections
- Smoke test status after each deploy

## Rollback

- Keep the previous production build/image available.
- Roll back when smoke tests fail or error rate exceeds the alert threshold.
- Migrations are backward compatible for one release so the previous build can run.
