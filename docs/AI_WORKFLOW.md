# AI_WORKFLOW — General AI Workspace

> Direct general-purpose chat flow: authenticate, authorize, validate, assemble conversation context, call the provider adapter, stream, and persist the outcome. No retrieval stage.

## Project-specific overrides

> Written for this project. Where these notes and the generated sections below disagree, these notes win.

## V1 runtime contract

General-purpose AI chat; no factual-source grounding requirement. Conversation history is context only, not retrieval data. Do not add a retrieve/select-evidence stage, citations, source-accuracy checks, or evidence-only/no-evidence response rules.

## Request flow

1. Authenticate the user and authorize owner access to the conversation.
2. Validate the request and apply rate limits.
3. Persist the user message, then load recent owner-scoped conversation messages as model context only.
4. Call the selected model through the server-only configurable provider adapter.
5. Stream tokens to the UI. A stop action aborts the upstream request.
6. Persist assistant completion, interruption, or error state; keep retry/regenerate and edit/resend history coherent.
7. Render model output as untrusted content using safe Markdown/code rendering.

No attachment file content enters model context in V1.

## Failure handling

- Provider/database failures return a recoverable user-facing error and do not retry indefinitely.
- Stop/abort leaves a coherent interrupted message state.
- Authorization failures cannot reveal or modify another user's conversations.
- Do not expose provider credentials to the browser or logs.
