<!-- Newest entry first. Use a version heading only for a release that actually shipped. -->

# Changelog

What's new in Nibie.

## Unreleased

### Added

- Deployment identity from the Vercel git commit, exposed safely at `GET /api/health`.
- Structured server logs for chat generation, with one request id across start, context build, and completion or failure.
- Release checklist, version policy, migration inventory rules, hotfix steps, and rollback notes.
- `npm run release:check`, which fails on duplicate migration numbers, a journal that does not match `drizzle/*.sql`, missing release docs, or unresolved merge markers.

### Changed

- Chat and room-draft failure logs now use stable event names and operational codes. User-facing errors are unchanged.

### Fixed

- None.

## Current development

### Added

- Public landing, docs, and privacy pages
- Email sign-in, Google sign-in, and sign-out on every device
- Conversations with streaming replies, stop, retry, regenerate, and edit-and-resend
- Model modes and reasoning effort
- Archive and restore for conversations
- Rooms with instructions, an editable brief, and threads that keep that context
- Pins kept with a Room
- Room files for plain text, Markdown, and CSV, used when you select them
- A context panel for the profile, room, pins, selected files, and recent messages in a reply
- Workbench documents you can create, edit, and save
- Settings for language, the default model, response length, response style, personalization, and conversation export or deletion
