# API Contract — Rocks

> Status: **Partially Implemented** — status update flow live; CRUD still stubbed.

---

## Types

```typescript
type RockStatus =
  | 'on_track'
  | 'off_track'
  | 'at_risk'
  | 'blocked'
  | 'on_hold'
  | 'completed'

interface Rock {
  id:           string
  ownerId:      string
  teamId:       string
  title:        string
  level:        'company' | 'dept' | 'individual'
  quarter:      number     // 1-4
  year:         number
  parentRockId: string | null
  status:       RockStatus
  createdAt:    string
  updatedAt:    string
}

interface RockStatusHistoryEntry {
  id:          string
  rockId:      string
  meetingId:   string | null
  status:      RockStatus
  comment:     string | null
  changedById: string
  changedAt:   string
}

interface MeetingRockStatus {
  rock:         Rock
  preSubmitted: boolean              // true if any history row references this meeting
  latestEntry:  RockStatusHistoryEntry | null
}
```

---

## Business Rules

1. **Append-only history:** every status change writes a `rock_status_history`
   row. Rows are never updated or deleted.
2. **Comment is required** when the new status is `off_track` or `blocked`.
   Domain throws `CommentRequiredError` → handler returns HTTP 400.
3. **Owner required:** `ownerId` is required — cannot create a Rock without an owner.
4. **Quarter format:** stored as `quarter:int` + `year:int`; the legacy
   `Q[1-4]-YYYY` format is still validated on string inputs (`QUARTER_PATTERN`).

---

## Endpoints

### `GET /api/rocks`

List rocks. *Currently stubbed — returns empty list.*

---

### `GET /api/rocks/:id`

Get a single rock.

**Response `200`:** `{ "rock": Rock }`
**Response `404`:** Not found.

---

### `GET /api/rocks/:id/history`

Get the full status history for a rock, ordered oldest → newest.

**Response `200`:** `{ "history": [RockStatusHistoryEntry] }`

---

### `POST /api/rocks/:id/status`

Change a rock's status and append a `rock_status_history` row.

**Body:**
```json
{
  "status":    "on_track | off_track | at_risk | blocked | on_hold | completed",
  "comment":   "string (required when status is 'off_track' or 'blocked')",
  "meetingId": "uuid (optional — links the history row to a pre-meeting submission)",
  "userId":    "uuid (optional — defaults to authenticated user)"
}
```

**Response `200`:**
```json
{
  "rock":         Rock,
  "historyEntry": RockStatusHistoryEntry
}
```

**Response `400`:**
- `COMMENT_REQUIRED` — status is `off_track`/`blocked` but no comment supplied.
- `INVALID_STATUS` — unknown status value.
- `VALIDATION_ERROR` — missing `userId` or `status`.

**Response `404`:** Rock not found.

---

### `GET /api/meetings/:id/rocks`

Pre-meeting view: every rock that belongs to the meeting's team, paired with
the most recent meeting-scoped history entry.

**Response `200`:** `{ "items": [MeetingRockStatus], "total": 8 }`
**Response `404`:** Meeting not found.
