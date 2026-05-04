# Integration — ClickUp Sync

> Status: **Implemented** — `service/domain/clickup-sync.domain.ts`
> Migration phase: sync is one-way (EOS Pulse → ClickUp) during transition period.

---

## Purpose

EOS Pulse is replacing ClickUp as the EOS operating layer. During the transition, changes to **issues**, **rocks**, and **to-dos** in EOS Pulse are mirrored to ClickUp so that teams not yet fully cut over can continue to work from ClickUp without data diverging.

This is **not** a live two-way sync — ClickUp is read-only from EOS Pulse's perspective.
Once migration is complete, disable all sync toggles via the Sync Settings page and archive the ClickUp lists.

---

## Architecture

```
EOS Pulse Domain Layer
  └── clickup-sync.domain.ts
        ├── reads settings (API key, list IDs, toggles) from settings.domain.ts
        └── calls ClickUp API v2 via native fetch()
              ├── syncIssueToClickUp(issue)
              ├── syncRockToClickUp(rock)
              ├── syncTodoToClickUp(todo)
              ├── pullClickUpStatus(clickupTaskId)
              └── testClickUpConnection()

HTTP layer
  └── settings.handler.ts
        └── POST /api/settings/test-clickup  → testClickUpConnection()

UI
  └── pages/Admin/SyncSettingsPage.tsx
```

**Intentional architecture exception:** `clickup-sync.domain.ts` uses native `fetch()` for outbound ClickUp API calls. This is the only domain file permitted to use `fetch()`. All other domain files must not call `fetch()` (lint-arch RULE_4 applies to `pages/` only).

---

## Configuration

All settings are stored in the `settings` DB table and managed via the Sync Settings page (`/admin/sync-settings`) or `PUT /api/settings`.

| Setting key | Description |
|---|---|
| `CLICKUP_API_KEY` | Personal API token (`pk_...`). Masked in GET responses. |
| `CLICKUP_IDS_LIST_ID` | ClickUp list ID for Issues/IDS tasks. |
| `CLICKUP_ROCKS_LIST_ID` | ClickUp list ID for Rocks. |
| `CLICKUP_TODOS_LIST_ID` | ClickUp list ID for To-dos. |
| `IDS_SYNC_ENABLED` | `"true"` / `"false"` — toggle issues sync. |
| `ROCKS_SYNC_ENABLED` | `"true"` / `"false"` — toggle rocks sync. |
| `TODOS_SYNC_ENABLED` | `"true"` / `"false"` — toggle to-dos sync. |
| `TEAMS_WEBHOOK_URL` | Microsoft Teams incoming webhook URL (for nudges). |

---

## Sync Behavior

### Create or update

Each sync function checks the record's `clickup_task_id` column:

- **null** → creates a new ClickUp task in the configured list → writes the returned `id` back to the EOS Pulse record
- **set** → updates the existing ClickUp task via `PUT /task/{id}`

### Status mapping

**Issues → ClickUp**

| EOS Pulse status | ClickUp status |
|---|---|
| `open` | `to do` |
| `assigned` | `to do` |
| `in_progress` | `in progress` |
| `pending_closure` | `in review` |
| `closed` | `complete` |

**Rocks → ClickUp**

| EOS Pulse status | ClickUp status |
|---|---|
| `on_track` | `in progress` |
| `off_track` | `in progress` |
| `at_risk` | `in review` |
| `blocked` | `blocked` |
| `on_hold` | `on hold` |
| `completed` | `complete` |

**To-dos → ClickUp**

| EOS Pulse status | ClickUp status |
|---|---|
| `open` | `to do` |
| `done` | `complete` |
| `blocked` | `blocked` |
| `carried` | `to do` |

### Priority mapping (Issues only)

| EOS Pulse priority | ClickUp priority number |
|---|---|
| `critical` | 1 (urgent) |
| `high` | 2 |
| `medium` | 3 |
| `low` | 4 |

---

## Sync is not automatic

Sync functions are **not** called automatically on every domain write — they must be called explicitly by a handler or background job. This keeps domain mutations fast and decoupled from ClickUp availability.

**Recommended trigger points** (to implement in Step 07+):
- Issue created/status changed → `syncIssueToClickUp`
- Rock status changed → `syncRockToClickUp`
- Todo created/completed/carried → `syncTodoToClickUp`

---

## Testing the connection

```
POST /api/settings/test-clickup
```

Returns `{ ok: true }` or `{ ok: false, error: "..." }`.
Uses `GET /api/v2/team` — a lightweight authenticated ClickUp endpoint.

---

## ClickUp API reference

- Base URL: `https://api.clickup.com/api/v2`
- Auth header: `Authorization: {CLICKUP_API_KEY}` (no `Bearer` prefix)
- Create task: `POST /list/{listId}/task`
- Update task: `PUT /task/{taskId}`
- Get task: `GET /task/{taskId}`
- Rate limit: 100 requests/min per token

---

## Disabling sync (post-migration)

1. Open Sync Settings page
2. Toggle off: IDS sync, Rocks sync, To-dos sync
3. Save
4. Archive the ClickUp lists (do not delete — keep as historical record)
5. Remove `CLICKUP_*` values from the settings table

At this point EOS Pulse is the sole source of truth.
