# DATA_STRATEGY — General AI Workspace

> Where data comes from, how it is classified and how it is used. Structured data stays structured.

## Project-specific overrides

> Written for this project. Where these notes and the generated sections below disagree, these notes win.

## V1 application data contract

- PostgreSQL is the application system of record for account references, owner-scoped conversations and messages, model-selection metadata, and attachment metadata.
- This is not a knowledge source. Conversation history is context for the selected model, not retrieval evidence or a retrieval corpus.
- No external data sources, ingestion, knowledge-source search, citations, embeddings, vector search, or RAG are in V1.

## Attachment data boundary

Represent attachment UI state and metadata only. Do not store/process file content, parse PDFs, understand images, send files to a model, or create embeddings. Storage provider and limits remain deferred Coordinator decisions.

## Chat data flow

Authenticated user → owner-scoped conversation/message queries → context assembly from that conversation → provider adapter. Application records are never searched as factual evidence for model answers.

## Deferred decisions

Exact auth implementation, attachment storage provider/limits, exact provider/model IDs, and ORM choice do not block this pack.
