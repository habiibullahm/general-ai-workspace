# Changelog

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
