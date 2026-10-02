# BUILD_REPORT — Nibie

> End-to-end build report for the live-demo release. State as of commit `81ad16a` on `main` (2026-10-01). Operational facts that change (deployment IDs, test counts) should be re-checked, not trusted from this file.

## 1. Summary

| Item | Value |
| --- | --- |
| Product | Nibie, a persistent general-purpose AI chat workspace |
| Production URL | https://nibie-ai.vercel.app |
| Source | GitHub `habiibullahm/nibie-code`, branch `main` (production branch) |
| Hosting | Vercel project `nibie`, Git-connected, functions pinned to `icn1` (Seoul) |
| Database / auth | One hosted Supabase project (Seoul), three Drizzle migrations applied |
| AI provider | Server-side, OpenAI-compatible adapter (`AI_PROVIDER=openai-compatible`), model `gpt-6-luna` |
| Live-demo status | Deployed. **Ready for live demo is pending one authenticated production smoke** (see section 8). |

Unauthenticated production smoke at report time: `/login` 200, `/` redirects to `/login`, `POST /api/chat` without a session 401, `/preview` 404.

## 2. Milestones

| Milestone | Status | Scope |
| --- | --- | --- |
| M0–M3 | Done | Scaffold, Supabase auth with owner-scoped RLS, chat UI, conversation and message persistence |
| M4 | Closed | Real provider adapter, authenticated SSE route, atomic sequencing, idempotent submissions, one active generation per conversation, stale-write fencing, Stop with interrupted persistence, stale-generation recovery |
| M5 | Done | Regenerate/retry and edit-and-resend of the last turn, copy controls, safe Markdown and code rendering |
| Performance | Done | Backend round-trip cuts and client re-render isolation (section 4) |
| M6 | Deferred | Metadata-only attachments, deliberately postponed in favour of the live demo |

### M4 notes

- The earlier `502` at `POST /api/chat` came from two configuration mismatches, not the adapter: `AI_PROVIDER` held a value other than `openai-compatible`, and the model name was one the provider rejects with `403`.
- The route now logs unsupported provider configuration by name, so the next misconfiguration is diagnosable.

### M5 notes

- Migration `0002` is additive: `regenerate_assistant_message` and `edit_last_user_message`. Both are owner-scoped `SECURITY INVOKER` functions that act only on the latest user message. There is no history branching.
- Assistant Markdown is rendered with `react-markdown` and `remark-gfm`: raw HTML is dropped, only `http(s)` and `mailto` links are allowed, and images are never loaded.

## 3. Verification

| Check | Result |
| --- | --- |
| Lint | Pass |
| Typecheck | Pass (clean clone) |
| Unit tests | 63 passed across 14 files |
| Guarded integration tests | 15 passed, local PostgreSQL only |
| Browser tests | 5 passed (unauthenticated pages and the mock preview) |
| Production build | Pass |
| Authenticated flows with the real provider | 3 passed |
| Schema gate | OK on the hosted and a local database |

Caveats:

- Authenticated flows were run on a local loopback Supabase stack against the real provider, not against the hosted project. They cover login, streaming, refresh, reopen, sign-in again, regenerate, edit, copy, and Stop followed by Retry.
- The schema gate derives its expectations from the SQL migrations: all tables, `messages.reply_to_message_id`, all constraints and foreign keys, the one-active-response unique index, RLS on every table, every owner-scoped policy, and all chat functions. The size difference between two generated snapshots was key ordering only; nothing was hand-edited.
- A typecheck run inside a folder that also runs `next dev` can report errors in `.next/dev/types/*`. Those are partial generated files, not project source.

## 4. Performance

Measured on a production build with hosted latency simulated on a local Supabase stack (auth round trip of about 145 ms was measured against the hosted project; the data-call figure of +80 ms is an assumption).

| Action | Before | After |
| --- | --- | --- |
| Switch conversation, highlight / content | 1336–2508 / 1346–2518 ms | 57–148 / 359–544 ms |
| New Chat visible | 3508 ms | 63–81 ms |
| Sent message visible | about 1 s | 103 ms |
| Backend calls before the provider is contacted | 11 (2678 ms) | 7 (956 ms) |
| Typing, p95 input event | 40 ms | 24 ms |
| Streaming, p99 frame in a long conversation | 33 ms | 17 ms |

What changed:

- Page renders verify the session and load data in parallel; stale-generation recovery runs only when a response is marked streaming.
- Redundant `revalidatePath` calls were removed from chat actions.
- `/api/chat` runs its independent reads together.
- The composer owns its draft state, and the sidebar and message rows are memoized.
- Streamed text is applied in 80 ms batches.
- Conversation switching selects immediately with a loading skeleton.
- New Chat opens instantly and the conversation row is created with the first message.
- The sent message and a thinking indicator appear immediately, with rollback and draft restore on failure.

Remaining bottleneck: the provider's first token takes 7–15 s on a 300-word answer because the gateway returns the reply in a few large chunks. This is outside the application.

## 5. Security and data safety

- Protected routes require authentication; owner-scoped RLS is enabled on every table.
- Chat RPCs run as `SECURITY INVOKER` with the authenticated client; migration credentials are never used for normal user-data requests.
- Destructive integration tests are guarded to a loopback database named `general_ai_workspace_test` with an explicit reset opt-in. No destructive reset has been run against Supabase.
- Schema changes are additive migrations only.
- Tracked files and pushed commits were scanned for keys, tokens and connection strings; none were found. `.env.local` is gitignored and `.env.example` is the only tracked env file.
- The repository is public.

## 6. Branches and deployment

- `main` is the production branch. The former `master` branch was merged into `main` and deleted.
- Feature branches `feat/m0-scaffold`, `feat/m2-chat-ui`, `feat/m3-persistence`, `feat/m4-ai-streaming`, `feat/m5-essential-controls` remain.
- The Vercel project is Git-connected: pushes to `main` build and deploy production.
- Vercel production environment holds the Supabase and `NEXT_PUBLIC_*` settings and the six `AI_*` settings. `NEXT_PUBLIC_APP_NAME` is `Nibie` and `NEXT_PUBLIC_APP_URL` is the production URL.

## 7. Naming

The product name is **Nibie** everywhere users see it. The lowercase wordmark in the sidebar logo is intentional. The repository is `nibie-code`; the production URL contains `nibie-ai` only as the domain.

## 8. Open items

**Owner action required**

1. Run the authenticated production smoke, which decides "ready for live demo":

   ```bash
   E2E_BASE_URL=https://nibie-ai.vercel.app npm run test:chat:e2e
   ```

2. Confirm in the Vercel dashboard that the Production Branch is `main`.
3. If emailed links are ever used, add the production URL to the Supabase Auth Site URL and redirect allow-list.
4. Decide whether to rewrite older commit authorship. Some early commits carry legacy author identities (a work address and an automated-environment identity). Rewriting requires a force-push, changes every commit SHA, and cannot fully purge cached copies on GitHub. A verified backup bundle was prepared outside the repository.

**Deferred on purpose**

M6 attachments, rate limiting, evaluation infrastructure, advanced observability, load testing, separate DEV and PROD Supabase projects, and rollback rehearsal.
