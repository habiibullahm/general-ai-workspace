# BUILD_PROMPT — Nibie

You are implementing **Nibie**, a custom AI application.

## Source of truth

Read these files in `docs/` before writing code. Do not duplicate or contradict them:

- `APP_CORE.md` — product intent, guardrails, success criteria
- `PRD.md` — scope, requirements, acceptance criteria
- `ARCHITECTURE.md` — locked stack, components, folder structure
- `DATA_STRATEGY.md` — application records, conversation context, and attachment metadata boundary
- `AI_WORKFLOW.md` — direct chat request flow and streaming lifecycle
- `EVALUATION.md` — evaluation categories, datasets, thresholds
- `DEPLOYMENT.md` — production workflow and release gate

Sections titled **Project-specific overrides** were written for this project and take precedence over generated text in the same document. Otherwise, if documents conflict, APP_CORE.md wins, then PRD.md. If information is missing, ask instead of guessing.

## Workflow

Work through these phases in order. Do not skip a phase.

1. **Read project definitions.** Read every file listed above. Summarize the core job, in-scope capabilities and locked stack in five lines before changing anything.
2. **Inspect repository.** Check what already exists. Reuse existing code and conventions. Do not delete or overwrite existing work without asking.
3. **Lock architecture.** Create the folder structure from ARCHITECTURE.md using exactly the locked stack (Frontend: Next.js · Backend: Next.js · Database: PostgreSQL · AI provider: Configurable provider · Deployment: Vercel). Use Supabase Auth with server-managed cookie sessions, and Drizzle for schema/migrations. Runtime user-data queries must use the cookie-bound Supabase client with the public publishable key so RLS applies; never use service-role or privileged direct DB access for normal user-data paths. Add no framework, service or dependency that is not justified there.
4. **Implement vertical slice.** Build one thin end-to-end path for the core job — "Create or reopen a conversation, send a prompt, receive and manage a streamed AI response, and return to the conversation later." — through User → Frontend → API → Context Builder → LLM → Guardrails → Response. It must run locally with seed data.
5. **Complete features.** Implement the remaining capabilities in this order: Authentication, User accounts, Conversation, Logging, Rate limiting, Security checks, Evaluation, Production smoke tests. A capability is done when its PRD acceptance criterion passes.
6. **Evaluate.** Create evals/ with curated, held-out and regression datasets as defined in EVALUATION.md. Run the suite and fix causes until every threshold passes.
7. **Test.** Unit tests per module, API/integration tests, and Playwright E2E tests for the critical journeys.
8. **Security review.** Validate input at every boundary, enforce authorization server-side, keep secrets out of the client and the repository, audit dependencies, and test prompt-injection resistance.
9. **Production build.** Lint, typecheck, tests, evaluation and the production build must pass with zero errors.
10. **Deploy.** Follow DEPLOYMENT.md: staging first (Vercel), migrations, E2E, staging evaluation, then the pilot environment.
11. **Verify.** Run smoke tests against the live URL and report the release state against the target **READY FOR PILOT** using the release gate. Items beyond the target are out of scope. Never call the app ready only because it builds.

## Rules

- The stack is locked. Changing technology requires updating ARCHITECTURE.md and asking first.
- Keep the modular monolith. No microservices without a concrete requirement.
- This is general-purpose AI chat, not a knowledge assistant. Do not implement retrieval, citations, or factual-source grounding. Conversation history is context only, not a retrieval corpus.
- Configuration comes from the environment variables in DEPLOYMENT.md. Never commit secrets.
- Never weaken tests or evaluation thresholds to make them pass.
- Keep changes small and focused. Explain any deviation from the documents.

## Definition of done

- All PRD.md acceptance criteria pass.
- All EVALUATION.md thresholds pass on curated, held-out and regression datasets.
- Lint, typecheck, tests, E2E and production build pass.
- Release state is reported honestly using the release gate in DEPLOYMENT.md.

## Report after each phase

- What changed
- Files changed
- Checks run and their results
- Open risks or questions
