# ARCHITECTURE — General AI Workspace

> How the system is structured. Keep it understandable; do not add services or frameworks that are not listed here.

## Project-specific overrides

> Written for this project. Where these notes and the generated sections below disagree, these notes win.

Preserve Next.js frontend and route handlers, PostgreSQL, configurable provider adapter, Vercel, modular monolith, server-side model/provider calls, owner-scoped conversations, and no vector search. Use Supabase Auth with server-managed cookie sessions via `@supabase/ssr` and Supabase PostgreSQL as the system of record. Use Drizzle ORM for schema and migrations. Runtime user-data access must use the cookie-bound Supabase client with the public publishable key so RLS evaluates as the authenticated user; never use service-role or privileged direct database credentials for normal user-data paths. Attachment storage/limits and exact provider/model IDs remain deferred. Streaming routes must be compatible with selected Vercel runtime; provider secrets remain server-side.

Preserve the modular monolith and locked stack: Next.js UI/API, PostgreSQL, configurable AI provider, Vercel; no vector search. Request flow: authenticate → authorize owner-scoped conversation → validate/rate-limit → persist user message → load conversation context → call provider adapter server-side → stream to client → persist final/interrupted assistant status. Stop must abort upstream generation; retry/regenerate/edit-resend must preserve coherent message history. No retrieval or evidence stage. Supabase Auth uses server-managed cookies; Drizzle manages schema/migrations, while runtime user-data queries use cookie-bound Supabase clients subject to RLS. Attachment storage/limits and exact provider/model IDs remain deferred.

## Style

**Modular monolith.** One deployable application with explicit module boundaries. There is no concrete requirement for distributed services, so splitting would add operational cost without benefit.

## Stack

**Locked** on 2026-09-30. Use exactly this technology unless the user explicitly changes it.

| Layer | Choice |
| --- | --- |
| Frontend | Next.js |
| Backend | Next.js |
| Database | PostgreSQL |
| Vector search | None |
| AI provider | Configurable provider |
| Deployment | Vercel |

## Request flow

```text
User
 ↓
Frontend (Next.js)
 ↓
API (Next.js route handlers)
 ↓
Context Builder
 ↓
LLM (Configurable provider)
 ↓
Guardrails
 ↓
Response
```

## Components

| Component | Responsibility | Technology |
| --- | --- | --- |
| Frontend | Public application for individuals using a general-purpose AI assistant for writing, learning, brainstorming, coding, and everyday problem-solving. | Next.js |
| API layer | Validates input, enforces access and limits, orchestrates modules | Next.js route handlers |
| modules/chat | Conversation | Module |
| modules/auth | Authentication | Module |
| modules/accounts | User accounts | Module |
| AI provider adapter | Single place that calls the model; model and endpoint come from configuration | Configurable provider |
| Database | System of record for structured data | PostgreSQL |
| Evaluation harness | Runs curated, held-out and regression datasets with thresholds | evals/ |
| Observability | Structured logs with request IDs, no secrets | lib/observability |
| Hosting | Runs the application and its environments | Vercel |

## Modules

| Module | Capabilities |
| --- | --- |
| `chat` | Conversation |
| `auth` | Authentication |
| `accounts` | User accounts |

## Folder structure

```text
general-ai-workspace/
├── src/
│   ├── app/                # Routes (UI)
│   │   └── api/            # Route handlers (server API)
│   ├── modules/            # Bounded modules
│   │   ├── chat/           # Conversation
│   │   ├── auth/           # Authentication
│   │   └── accounts/       # User accounts
│   ├── lib/
│   │   ├── ai/             # Provider adapter (only caller of the model)
│   │   ├── db/             # Client + repositories
│   │   ├── observability/
│   │   └── config.ts       # Validated environment config
│   └── components/         # Shared UI
├── db/
│   └── migrations/
├── evals/                  # AI evaluation
│   ├── datasets/
│   │   ├── curated/
│   │   ├── held-out/
│   │   └── regression/
│   └── run.ts              # Fails when a threshold is not met
├── tests/
│   ├── unit/
│   ├── e2e/
│   └── smoke/              # Runs against deployed URLs
└── docs/                   # Build Pack: APP_CORE.md, PRD.md, …
```

## Key decisions

- Modular monolith: one deployable with explicit module boundaries. Modules talk through typed functions, not HTTP.
- Stack locked on 2026-09-30. Changing technology requires updating ARCHITECTURE.md first.
- All model calls go through one provider adapter (lib/ai). No provider SDK calls inside modules.
- Authorization is enforced in the API layer and tested per route, never only in the UI.
- Configuration and secrets come from environment variables validated at startup; nothing secret ships to the browser.
