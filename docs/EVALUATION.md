# EVALUATION — General AI Workspace

> AI quality must be measurable. Categories come from the success criteria first, then from the enabled capabilities.

## Project-specific overrides

> Written for this project. Where these notes and the generated sections below disagree, these notes win.

## Evaluation contract

Conversation history is context only, not a retrieval corpus. V1 does not require factual-source grounding for normal general AI responses. There is no evaluation of project-evidence accuracy, citations, evidence correctness, retrieval quality, or knowledge-source coverage. The generated factual-accuracy/evidence examples and thresholds are not applicable and are removed from this portable contract.

## V1 evaluation areas

- Streaming: successful completion, partial output, stream errors, and cancellation.
- Persistence: conversation/message ordering, reload/reopen, and per-user ownership isolation.
- Model switching: selected model reaches the server-side provider adapter and changes the request configuration.
- Controls: stop generation, retry/regenerate, and edit/resend preserve coherent history.
- Rendering: Markdown, code blocks, copy controls, and safe handling of untrusted model output.
- Security: authentication, authorization, owner scoping, input validation, rate limits, and secrets handling.
- Error handling: provider and database errors are surfaced safely and can be recovered from.
- Responsive UI: core chat flows work at desktop and mobile widths with keyboard-accessible controls.
- Latency/reliability: measure practical app/API latency and provider failure/availability behavior where feasible; distinguish model latency from app overhead.

Use deterministic unit, integration, and browser tests for functional behavior. General response helpfulness may be assessed separately and is provider/model-dependent, not factual-source grounded. Curated, held-out, and regression cases cover only these V1 behaviors and use synthetic or privacy-scrubbed data. Define measurable thresholds per behavior; no retrieval/evidence evaluator or source dataset is required.
