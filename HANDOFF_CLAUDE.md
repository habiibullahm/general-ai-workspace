# Nibie handoff to Claude Code

Handoff date: 2026-10-01. Further implementation was stopped at the user's request. Preserve the existing work; finish M4 acceptance before starting M5 or M6.

## PROJECT

- Product: Nibie, a persistent general-purpose AI chat workspace.
- Canonical repository: https://github.com/habiibullahm/nibie-ai
- Previous URL: https://github.com/habiibullahm/general-ai-workspace redirects to the same repository. Both names were verified to resolve to the same GitHub repository ID during handoff; `origin` is normalized to the canonical URL.
- Active implementation branch: `feat/m4-ai-streaming`.
- Integration baseline: `master` at `130eea2ffce749f2769706d81144b18b6a175480`.
- M4 implementation checkpoint: `c1d1656d01b1120db1530cac848e0ce8ab7e6efa`.
- This handoff adds a documentation-only commit after that checkpoint. Use `git rev-parse HEAD` or the remote branch to obtain the final handoff branch SHA; the implementation SHA above remains the reference for the code being handed over.
- Stack: Next.js App Router, React, TypeScript, Supabase Auth/PostgreSQL, Drizzle migrations, and Vercel. Keep the modular monolith and the actual `app/`, `lib/`, and `components/` layout.
- Operate as one owner with one active implementation branch. Do not create worker branches, worktrees, sub-agents, or orchestration infrastructure for milestones.

## BRANCH TOPOLOGY

- `main` is stale legacy history containing the initial commit at `740b46cbb68cabff9a972b7284874ba15aa45aea`.
- `master` is the integration baseline through M3.
- `feat/m4-ai-streaming` is the current, unmerged M4 candidate.
- Existing M4 commits are `5afda45` (streaming implementation), `851baff` (terminal persistence fix), and `c1d1656` (correctness/build checkpoint).
- `main` and `master` have separate roots. Do not merge unrelated histories, force-push, or rewrite history. Default-branch normalization is later repository hygiene, not a prerequisite for M4.

## COMPLETED

- M0: application scaffold, TypeScript, package management, lint, test, and build tooling.
- M1: signup/login/logout, confirmation callback, server-managed session cookies, authenticated page/actions, user provisioning, owner-scoped RLS, ownership foreign keys, and cascade deletion.
- M2: responsive chat workspace, sidebar/history, composer, logical response-mode selector, and keyboard-accessible mobile drawer.
- M3: create/open/rename/delete conversations, selected-mode persistence, ordered user-message persistence, and server reads on reload/reopen.
- M4 candidate: real provider adapter, authenticated streaming route, assistant lifecycle persistence, Stop wiring, atomic sequencing, idempotency, generation protection, and UI reconciliation. The authenticated real-provider acceptance gate is still pending.
- Dependency installation was repaired by replacing lockfile mirror URLs with the official HTTPS npm registry. Package versions and integrity metadata were preserved.

## M4 CHANGES

- **Sequencing:** `append_user_message` locks the owner-scoped conversation and inserts the user message, allocates its position, and updates conversation metadata in one transaction.
- **Idempotency:** the UI supplies a stable user-message UUID for a submission. Repeating the same UUID/payload returns the saved row; mismatched payloads are rejected.
- **Generation claim/locking:** `claim_assistant_message` locks the conversation. A partial unique index allows only one assistant row with `streaming` status per conversation. Competing requests return conflict; completed-response replay does not invoke the provider again.
- **Stale-write fencing:** each replacement generation uses a fresh assistant-message UUID. Terminal writes match both that UUID and `status = 'streaming'`; a write affecting no row is not announced as completion.
- **SSE/parser lifecycle:** provider parsing handles network chunks, UTF-8, CRLF, terminal markers, malformed/error events, and abort cleanup. App events are `start`, `delta`, `status`, `error`, and `done`; the client rejects premature completion/EOF.
- **Timeout:** generation is bounded to 120 seconds; the Node route declares a 180-second function duration. Context is limited to 32 complete messages and approximately 64,000 characters. Character counting is an approximation, not model-specific tokenization.
- **Stop/interrupted:** Stop aborts the client request and propagates cancellation upstream. Partial or empty interrupted outcomes are persisted. Stale `streaming` rows older than five minutes are recovered on owner-scoped reopen/claim.
- **Persistence:** user data uses the authenticated cookie-bound Supabase client and RLS. Completion is emitted only after final assistant persistence is confirmed. Do not use privileged database connections or service-role keys for normal user-data requests.
- **UI reconciliation:** one busy guard covers saving/streaming; persisted assistant IDs replace synthetic identities; pending UI state is reconciled with server data; URL-backed conversation selection handles navigation. Model updates are awaited and rolled back in the UI on failure.
- **Boundary validation:** UUIDs, stored prompt bounds, JSON content type, and request origin are checked before costly generation.

Primary references: `app/actions/chat.ts`, `app/api/chat/route.ts`, `components/chat-workspace.tsx`, `lib/ai/sse.ts`, and `lib/chat/read.ts`. Reuse these paths; do not rebuild the adapter or chat workflow.

## DATABASE

- `drizzle/0000_initial_schema.sql` is the original ownership/auth schema.
- `drizzle/0001_chat_generation_safety.sql` is the additive M4 migration. It has already been applied and verified on the configured remote database, after checking that its target matched the configured Supabase project and that the expected initial migration was recorded.
- Remote verification found two recorded migrations, the reply column, the active-generation index, and all three RPCs.
- Added schema: nullable `reply_to_message_id`, same-conversation/owner reply FK, composite identity uniqueness, conversation/reply uniqueness, and `messages_one_active_response_idx`.
- Added RPCs: `append_user_message`, `claim_assistant_message`, and `recover_stale_chat`. These use `SECURITY INVOKER`, owner access, and restricted execute permissions.
- Verify the current schema and migration journal before changing anything. Do not edit an already-applied migration; use a new additive migration for any further schema/function change.
- Never reset staging/production. The destructive integration suite is guarded to a loopback database named exactly `general_ai_workspace_test`, with explicit reset opt-in.
- A dedicated local PostgreSQL 18 test cluster was prepared under ignored `.local-test/pgdata`, using port 55439. Verify whether it is running before using it; do not assume the prior test process is still active.

## PROVIDER

- Provider: SumoPod through the existing OpenAI-compatible endpoint configured server-side.
- `gpt-6-luna` is confirmed working: non-streaming HTTP 200, incremental streamed deltas, `finish_reason=stop`, and terminal `[DONE]`.
- The user supplied this known-good confirmation. A small real catalog-model probe also returned HTTP 200 with text deltas and a terminal event.
- Earlier HTTP 403 failures were provider/config related and are resolved for the known-good direct provider flow. Do not repeat those diagnostics or replace the working provider architecture without new evidence.
- Keep credentials and endpoint values out of logs, Git, and this document.
- **Application gate remains distinct:** the latest authenticated app test still received HTTP 502 at `POST /api/chat` after login, conversation creation, and user-message submission. It did not complete assistant streaming/durability acceptance.
- First investigate the persisted logical response mode's `AI_MODEL_*` resolution and whether the running Next.js process has refreshed local configuration. The test defaults to `Balanced`; direct success with a model does not prove the app selected that same model. Use names/booleans only when checking configuration. A previously launched wrapper inherited environment values, so a fresh runtime may be necessary. This is a wiring/runtime hypothesis, not a reason to redesign the adapter or dump secrets.

## TEST STATUS

Latest verified checkpoint checks, before final authenticated acceptance:

| Check | Result |
| --- | --- |
| Lint | Passed |
| Typecheck | Passed |
| Unit | 53 cases passed across 13 files |
| Database integration | 11 cases passed on the guarded local database |
| Browser baseline | 4 cases passed |
| Production build | Passed against the checkpoint working tree |
| Authenticated real-provider browser journey | Not passed; latest app attempt received HTTP 502 |

The controlled E2E account was verified confirmed and able to authenticate through both SDK and browser flows. A real owner-scoped runtime safety probe verified duplicate submission count of one, one active generation, API conflict on overlap, interrupted-state reopen, stale-write rejection, terminal-state protection, and saved-response replay. Its fixtures were cleaned up.

That probe used a synthetic stored assistant response for database/replay checks. It is **not** proof of real AI streaming or upstream Stop acceptance. Unit tests cover provider failure/timeout/cancellation behavior; genuine Stop with the now-working provider must still be verified.

Relevant commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run test:e2e`, `npm run test:chat:e2e`, and `npm run build`.

`test:chat:e2e` fails when the account variables are missing. The general browser suite skips that case if credentials are absent; a skip never satisfies M4. Playwright supports an external target and otherwise uses the local development server on port 3100. `/preview` is a mock UI route disabled in production.

Do not expose raw Playwright failures, request logs, or error-context artifacts without redacting environment values and credentials. Local test reports/logs are ignored and must stay out of commits.

## REMAINING M4 ACCEPTANCE

Complete this exact real authenticated flow:

`login → create/open conversation → persist user message exactly once → real gpt-6-luna stream → persist assistant terminal state → refresh → reopen → verify the same durable response from the database`

Also verify double submit, active-generation locking, Stop followed by interrupted persistence, stale-write fencing, and provider failure handling. Keep fixture operations scoped to the controlled test account and clean up only fixtures created by the test.

Then run the full verification suite again. Do not mark M4 complete or merge it into `master` based on direct provider probes, synthetic responses, mocks, skipped tests, or a successful build alone.

## AFTER M4

Only after authenticated acceptance passes:

`merge feat/m4-ai-streaming → master → verify master → M5 essential controls → M6 metadata-only attachments → full E2E → Vercel Preview → Production → production smoke → hardening`

- M5 is limited to the last turn: retry/regenerate, edit/resend, safe Markdown/code rendering, and copy controls. No history branching.
- M6 is metadata-only: native selection, chips/removal, and persisted metadata. No file bytes, upload/storage integration, downloads, parsing, model ingestion, or retrieval.
- Release gates still require rate limiting, bounded context/output, safe tracing/logging, executable chat-behavior evaluation, security/dependency checks, and deployed E2E/smoke.
- Vercel project: `general-ai-workspace`. Previous deployment inspection showed failed builds and production tracking the stale `main`. Verify current settings and use an accepted integration SHA deliberately; do not accidentally release stale history.
- Preview and Production configuration/builds must be verified separately. Declare `READY FOR PILOT` only after the deployed primary journey and production smoke pass.

## SCOPE EXCLUSIONS

Do not add RAG, web search, agents, MCP as a product feature, voice, image generation, billing, teams, complex admin, cross-conversation memory, document parsing, embeddings, or vector search. Keep Next.js, Supabase/PostgreSQL, the configurable server-side provider, Drizzle, and Vercel.

## ENVIRONMENT

Variable names only. Runtime values stay in ignored local files or the platform secret store and are not part of this handoff.

- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `DATABASE_URL`
- `AI_PROVIDER`
- `AI_BASE_URL`
- `AI_API_KEY`
- `AI_MODEL_FAST`
- `AI_MODEL_BALANCED`
- `AI_MODEL_REASONING`
- `E2E_USER_EMAIL`
- `E2E_USER_PASSWORD`

Optional/supporting names:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `E2E_BASE_URL`
- `TEST_DATABASE_URL`
- `ALLOW_TEST_DATABASE_RESET`
- `VERCEL_OIDC_TOKEN`

`.env.local`, other runtime env files, `.vercel/`, `.local-test/`, logs, and browser reports remain ignored. Sensitive Vercel variables can pull as redacted placeholders; placeholders are not usable credentials. Securely provision actual values on another machine without including them in Git or chat.

## CLAUDE'S FIRST TASK

Verify this handoff against Git, current files, schema, and names-only runtime configuration. Preserve the implementation checkpoint and all valid work. Reuse the known-good provider and confirmed account, resolve any application-mode/runtime configuration discrepancy, and finish the authenticated M4 acceptance gate before any other feature work.

Use normal commits as checkpoints. Continue autonomously after accepted milestones; stop only for missing credentials, destructive production approval, a material product/architecture decision, or an external account permission that cannot be resolved safely. Do not restart scaffolding, create milestone worktrees/branches, merge unrelated histories, or weaken tests to claim success.
