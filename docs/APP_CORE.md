# APP_CORE — Nibie

> The application’s source of truth. Every other document and all code must stay consistent with this file.

## Project-specific overrides

> Written for this project. Where these notes and the generated sections below disagree, these notes win.

Minimal productivity UI: warm neutral/off-white, subtle borders, generous whitespace, simple sidebar/history, central conversation, lightweight bottom composer. ChatGPT/Claude interaction patterns are inspiration, not a visual clone. Keep attachments to UI, state/model, metadata, and architecture extension point only: no parsing, PDF ingestion, image understanding, file-to-model processing, embeddings, vector search, or RAG. Preserve modular monolith; Next.js, PostgreSQL, configurable AI provider, Vercel; server-side provider calls and owner-scoped conversations. Use Supabase Auth with server-managed cookie sessions and Drizzle for schema/migrations; normal user-data paths rely on cookie-bound Supabase access and RLS, never service-role access. Attachment storage/limits and provider/model IDs remain deferred.

## Original idea

> A clean, premium general-purpose AI chat workspace for persistent conversations with interchangeable models. V1 includes authentication, conversation history, streaming, model selection, generation controls, Markdown/code, responsive UI, and attachment metadata foundation. No RAG, web search, agents, MCP, voice, image generation, billing, teams, or complex admin.

## Product

| Field | Value |
| --- | --- |
| Name | Nibie |
| Product type | Custom AI Application |
| Deployment type | Public application |
| AI application | Yes |

## Goal

A premium, provider-independent AI chat workspace that lets users manage ongoing conversations, choose models, and control streamed responses.

## Primary user

Individuals using a general-purpose AI assistant for writing, learning, brainstorming, coding, and everyday problem-solving.

## Problem

Conversations need persistence, useful history, model choice, and reliable controls without dependence on a single AI provider.

## Core job

Create or reopen a conversation, send a prompt, receive and manage a streamed AI response, and return to the conversation later.

## Knowledge / data

_None defined._

## Actions

- Answer — Answer questions

## Guardrails

- No RAG, web search, agents, MCP, voice, image generation, billing, teams, or complex admin in V1. No factual-source grounding requirement. Conversation history is context only, not a retrieval corpus. Never expose provider credentials to the client. Treat model output as untrusted; safely render Markdown and links.

## Success criteria

- Users authenticate and create, rename, reopen, and delete their own persistent conversations. Responses stream; stop, retry/regenerate, and edit/resend work correctly. Model switching uses a provider-independent server adapter. Markdown/code render safely with copy controls. Desktop/mobile layouts are accessible. Attachment UI/state/metadata only; no file processing. Evaluate streaming, persistence, model switching, controls, rendering, security, errors, responsive behavior, and practical latency/reliability—not factual-source grounding.

## Engineering principles

- Define before build: no implementation that is not traceable to this file and PRD.md.
- Use deterministic code where it is enough; use the model only where it adds value.
- General model responses do not require evidence from project sources. The assistant must not claim it retrieved or cited sources when it did not; future grounded or RAG modes may define separate evidence requirements.
- Keep application records structured for persistence and ownership; they are not a V1 knowledge/retrieval corpus.
- AI quality is measured by the evaluation suite, not by impressions.
- Deployment is not the end: smoke tests and monitoring are part of done.
