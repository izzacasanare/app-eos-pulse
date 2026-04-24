# EOS Pulse — Entropy Check

Periodic cleanup checklist. Run this review every 2 weeks or after any major feature merge.
The goal is to prevent the codebase from drifting into a state where it's harder to reason about than necessary.

---

## How to Use

Work through each section. Mark items ✅ (clean) or ⚠️ (needs attention). File issues for anything flagged.

---

## Architecture Integrity

- [ ] Run `deno run --allow-read scripts/lint-arch.ts` — zero violations
- [ ] `service/server.ts` imports only from `handlers/` — no domain or db imports
- [ ] No handler file imports another handler
- [ ] No domain file imports from `handlers/`
- [ ] `pages/` contains no raw `fetch()` calls
- [ ] `pages/` contains no raw HTML elements (`<button>`, `<input>`, `<select>`, `<table>`, `<dialog>`, `<textarea>`)
- [ ] All new domain files follow `<noun>.domain.ts` naming
- [ ] All new handler files follow `<noun>.handler.ts` naming

---

## Dead Code

- [ ] No `.domain.ts` files with only stub functions that have been superseded
- [ ] No handler routes defined in `server.ts` that don't exist in the domain
- [ ] No commented-out routes or unused handler exports
- [ ] No `TODO` comments older than 30 days (check git blame)
- [ ] No unused imports in any `service/` file
- [ ] No unused `pages/` components (check if imported anywhere)

---

## Data Model Drift

- [ ] `docs/data-model.md` matches the actual Drizzle schema in `service/schema.ts`
- [ ] All columns described in `data-model.md` have corresponding Drizzle definitions
- [ ] All indexes documented in `data-model.md` exist in the DB
- [ ] No columns exist in the DB that aren't in the schema file
- [ ] `rock_status_history` has no UPDATE or DELETE statements anywhere in the codebase

---

## Business Rules

- [ ] `RESOLUTION_NOTES_MIN_LENGTH = 50` constant is the single source of truth — not hardcoded anywhere else
- [ ] Meeting close guard checks `'open'` and `'ids_in_progress'` — not just one of them
- [ ] No status transition bypasses the domain layer (no direct DB status updates in handlers)
- [ ] `rock_status_history` insert happens in the same transaction as `rocks` status update

---

## API Contracts vs Implementation

- [ ] Every endpoint in `docs/api-contracts/` has a corresponding handler route
- [ ] Every handler route has a corresponding entry in `docs/api-contracts/`
- [ ] Response shapes in `docs/api-contracts/` match what handlers actually return
- [ ] Error codes in `docs/api-contracts/` match what domain errors throw

---

## Documentation Accuracy

- [ ] `docs/QUALITY_SCORE.md` grades reflect current implementation state (not aspirational)
- [ ] `ARCHITECTURE.md` layer model reflects the actual import graph
- [ ] `docs/SECURITY.md` env var list is complete and matches `.env.example`
- [ ] `docs/integrations/` files are marked with correct implementation status

---

## Dependencies

- [ ] `pnpm outdated` — review any major version bumps before updating
- [ ] `@mspbots/*` packages are on the latest compatible version (`mspbots update`)
- [ ] `service/deno.json` imports are pinned to specific versions (no `@latest`)
- [ ] No unused entries in `package.json` dependencies
- [ ] No packages installed that duplicate `@mspbots/ui` functionality (clsx, classnames, etc.)

---

## Security

- [ ] No secrets hardcoded anywhere — grep for `ghp_`, `pk_`, `postgres://` literals
- [ ] `.env` is in `.gitignore` and not committed
- [ ] `cors: true` only in `mspbot.config.ts` dev config — not in production build
- [ ] All routes that mutate data check `params.user` before proceeding
- [ ] Admin-only routes check `params.user.role === 'admin'`

---

## Nudges

- [ ] Nudge cron schedule matches `docs/api-contracts/nudges.md`
- [ ] All `NudgeType` values have a corresponding runner function
- [ ] `nudge_logs` table is being written on every nudge attempt (success and failure)
- [ ] No nudge sends in test/CI environments (check for env guard)

---

## Test Coverage (when tests exist)

- [ ] Domain business rules have unit tests (50-char rule, meeting close guard, rock history)
- [ ] Each handler has at least one happy-path integration test
- [ ] Nudge runners have tests that verify they don't send in test mode
- [ ] No tests that mock the database (integration tests hit real DB)

---

## Changelog

| Date | Run by | Violations found | Notes |
|---|---|---|---|
| 2026-04-24 | — | — | Initial checklist created; no code yet |
