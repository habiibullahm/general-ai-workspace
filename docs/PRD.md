# PRD — Nibie

> What to build in this version and how to know it works. Product intent lives in APP_CORE.md.

## Project-specific overrides

> Written for this project. Where these notes and the generated sections below disagree, these notes win.

V1 custom chat requirements: persistent sidebar/history; selectable model; token streaming; stop/abort; retry/regenerate; edit/resend; safe Markdown and code copy; responsive desktop/mobile UI; attachment button/state/metadata and architecture extension point only. Explicitly exclude document parsing, PDF ingestion, image understanding, file-to-model processing, embeddings, vector search, RAG, citations, factual evidence checks, and knowledge-source coverage. Evaluation categories must be chat behavior, security/ownership, rendering, errors, responsive UX, and practical latency/reliability—not retrieval or evidence grounding. Supabase Auth with server-managed cookie sessions and Drizzle ORM for PostgreSQL schema/migrations are Coordinator-selected implementation choices. Attachment storage/limits and exact AI provider/model IDs remain deferred.

## Summary

Nibie is a custom AI application delivered as a public application. A premium, provider-independent AI chat workspace that lets users manage ongoing conversations, choose models, and control streamed responses.

## Primary user

Individuals using a general-purpose AI assistant for writing, learning, brainstorming, coding, and everyday problem-solving.

## Problem

Conversations need persistence, useful history, model choice, and reliable controls without dependence on a single AI provider.

## Core job

Create or reopen a conversation, send a prompt, receive and manage a streamed AI response, and return to the conversation later.

## Success criteria

- Users authenticate and create, rename, reopen, and delete their own persistent conversations. Responses stream; stop, retry/regenerate, and edit/resend work correctly. Model switching uses a provider-independent server adapter. Markdown/code render safely with copy controls. Desktop/mobile layouts are accessible. Attachment UI/state/metadata only; no file processing. Evaluate streaming, persistence, model switching, controls, rendering, security, errors, responsive behavior, and practical latency/reliability—not factual-source grounding.

## In scope

### AI

- **Conversation** — Multi-turn chat interface and message API.

### Application

- **Authentication** — Sign-in and session management.
- **User accounts** — User profiles and per-user data.

### Operations

- **Logging** — Structured logs with request IDs; no secrets in logs.
- **Evaluation** — Automated AI evaluation suite with datasets and thresholds.
- **Security checks** — Dependency audit, input validation, secret scanning, prompt-injection review.
- **Rate limiting** — Per-IP / per-user limits on API and model calls.
- **Production smoke tests** — Post-deploy checks against the live environment.

## Out of scope

- Capabilities not selected: Document & image intake, Extraction, Classification, Summarization, RAG, Citations, Grounded answers, Structured outputs, Tool calling, Cross-conversation memory / persistent user personalization, Product search, Recommendation, Comparison, Lead capture, Lead qualification, Human escalation, Admin dashboard, Analytics, Notifications. Persistent conversation history within each chat remains V1.
- Anything that conflicts with the guardrails in APP_CORE.md.
- Technology outside the locked stack in ARCHITECTURE.md.

## Functional requirements

| ID | Requirement | Capability |
| --- | --- | --- |
| FR-01 | Users can hold a multi-turn conversation with the assistant. | Conversation |
| FR-02 | Protected pages and APIs require an authenticated session. | Authentication |
| FR-03 | Each user has a profile and can only access their own data. | User accounts |
| FR-04 | Every request is logged in a structured format with a request ID; secrets and personal data are redacted. | Logging |
| FR-05 | AI behavior is measured by an automated evaluation suite with explicit thresholds. | Evaluation |
| FR-06 | Inputs are validated at every boundary; dependencies and secrets are checked before release. | Security checks |
| FR-07 | API and model calls are rate limited per client to control abuse and cost. | Rate limiting |
| FR-08 | A smoke test suite verifies the critical path after every deployment. | Production smoke tests |

## Acceptance criteria

| ID | Criterion |
| --- | --- |
| AC-01 | A user can send a message and receive a streamed or complete response; the thread renders in order. |
| AC-02 | Unauthenticated requests to protected routes and APIs are rejected. |
| AC-03 | A user cannot read or modify another user’s data (verified by an authorization test). |
| AC-04 | A request can be traced end-to-end by its ID; log output contains no secrets. |
| AC-05 | The evaluation suite runs with one command and fails when a threshold is not met. |
| AC-06 | Dependency audit has no high/critical issues; no secrets are committed; injection tests pass. |
| AC-07 | Requests above the limit receive 429 without invoking the model. |
| AC-08 | Smoke tests run against the deployed URL and block the release on failure. |
| AC-09 | Success criterion measured: Users authenticate and create, rename, reopen, and delete their own persistent conversations. Responses stream; stop, retry/regenerate, and edit/resend work correctly. Model switching uses a provider-independent server adapter. Markdown/code render safely with copy controls. Desktop/mobile layouts are accessible. Attachment UI/state/metadata only; no file processing. Evaluate streaming, persistence, model switching, controls, rendering, security, errors, responsive behavior, and practical latency/reliability—not factual-source grounding. |

## Non-functional requirements

- Security: validate input at every boundary; authorization enforced server-side; secrets only in server environment variables.
- Performance: primary interactions respond in under 2 s (p95), excluding model streaming time.
- AI cost: token usage per request is logged and bounded by context limits.
- Reliability: external calls have timeouts and safe fallbacks.
- Privacy: collect only the personal data required; never log secrets or full payment data.
- Accessibility: keyboard navigable, visible focus, semantic HTML, WCAG AA contrast.

## Milestones

1. Vertical slice — one end-to-end path for the core job (see BUILD_PROMPT.md).
2. Feature completion — all in-scope capabilities meet their acceptance criteria.
3. Evaluation — all EVALUATION.md thresholds met on curated and held-out datasets.
4. Release — staging, E2E and production verification per DEPLOYMENT.md.
