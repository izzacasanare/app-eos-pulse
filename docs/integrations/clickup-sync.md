# Integration — ClickUp Sync

> Status: **Placeholder** — not implemented in v1

---

## Purpose

EOS Pulse replaces ClickUp as the EOS operating layer. This integration supports a **one-time migration** of existing ClickUp data (rocks, issues, to-dos) into EOS Pulse during the transition period.

This is a **migration tool only** — not a live two-way sync. Once migration is complete, ClickUp is no longer the source of truth.

---

## Scope

### In scope (migration)
- Import open Rocks from ClickUp tasks tagged as rocks → `rocks` table
- Import open Issues from ClickUp tasks tagged as issues → `issues` table
- Import open To-dos from ClickUp tasks → `todos` table
- Map ClickUp assignees to EOS Pulse users by email

### Out of scope
- Live bi-directional sync
- Importing historical meeting notes
- Importing closed/completed tasks (migration covers open items only)
- Attachments, comments, custom fields beyond core fields

---

## Required Environment Variables

```env
CLICKUP_API_TOKEN=pk_...
CLICKUP_WORKSPACE_ID=...
CLICKUP_ROCKS_LIST_ID=...
CLICKUP_ISSUES_LIST_ID=...
CLICKUP_TODOS_LIST_ID=...
```

---

## Migration Flow

```
1. Authenticate with ClickUp API v2
2. Fetch tasks from configured list IDs
3. Map ClickUp task → EOS Pulse entity:
   - name          → title
   - description   → description
   - assignee.email → ownerId (lookup by email)
   - due_date       → dueDate
   - status         → map to EOS status (see mapping below)
4. Insert into EOS Pulse DB via domain layer
5. Write migration log (clickup_id → eos_pulse_id mapping)
6. Report: N imported, M skipped (no matching user), K errors
```

### Status Mapping

| ClickUp status | EOS Pulse status |
|---|---|
| `open` / `in progress` | `open` |
| `in review` | `ids_in_progress` (issues) / `on_track` (rocks) |
| `complete` | Skipped (migration imports open items only) |
| `closed` | Skipped |

---

## Migration Script

To be created at: `scripts/migrate-from-clickup.ts`

Run once:
```bash
deno run --allow-env --allow-net scripts/migrate-from-clickup.ts
```

Idempotent: tracks already-migrated ClickUp IDs in a local log file to prevent double-import.

---

## API Reference

- ClickUp API v2: `https://api.clickup.com/api/v2`
- Auth: `Authorization: {CLICKUP_API_TOKEN}` header
- Rate limit: 100 requests/min per token

---

## Decision Log

| Decision | Reason |
|---|---|
| Migration only, no live sync | Simplicity; EOS Pulse is the new source of truth |
| Import open items only | Closed items are historical; no value in cluttering new system |
| Map by email | Most reliable identifier between systems |
