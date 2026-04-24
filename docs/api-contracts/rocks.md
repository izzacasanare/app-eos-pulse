# API Contract — Rocks

> Status: **Placeholder** — shapes defined here; implementation pending

---

## Types

```typescript
type RockStatus = 'on_track' | 'off_track' | 'complete' | 'dropped'

interface Rock {
  id:          string
  ownerId:     string
  teamId:      string
  title:       string
  description: string | null
  quarter:     string        // format: 'Q2-2025'
  status:      RockStatus
  dueDate:     string        // ISO date: 'YYYY-MM-DD'
  createdAt:   string
}

interface RockStatusHistoryEntry {
  id:             string
  rockId:         string
  changedBy:      string     // user id
  previousStatus: RockStatus
  newStatus:      RockStatus
  note:           string | null
  changedAt:      string
}
```

---

## Business Rules

1. **Append-only history:** Every status change writes a `rock_status_history` row. This record is never updated or deleted.
2. **Owner required:** `ownerId` is required — cannot create a Rock without an owner.
3. **Quarter format:** Must match `Q[1-4]-[YYYY]` pattern (e.g. `Q2-2025`).
4. **Status transitions:** Any status can transition to any other status (open model) — the history provides the audit trail.

---

## Endpoints

### `GET /api/rocks`

List rocks. Paginated.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `teamId` | string | Filter by team |
| `ownerId` | string | Filter by owner |
| `quarter` | string | Filter by quarter (`Q2-2025`) |
| `status` | RockStatus | Filter by status |
| `page` | number | Default `1` |
| `pageSize` | number | Default `50`, max `200` |

**Response `200`:** `{ "items": [Rock], "total": 42 }`

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

### `POST /api/rocks`

Create a new rock.

**Body:**
```json
{
  "ownerId":     "uuid (required)",
  "teamId":      "uuid (required)",
  "title":       "string (required)",
  "description": "string (optional)",
  "quarter":     "Q2-2025",
  "dueDate":     "2025-06-30"
}
```

**Response `201`:** `{ "rock": Rock }`

**Response `400`:** Validation error (missing owner, bad quarter format, etc.).

---

### `PATCH /api/rocks/:id`

Update rock metadata (title, description, dueDate). Does **not** change status — use the status endpoint.

**Body (all optional):**
```json
{
  "title":       "string",
  "description": "string",
  "dueDate":     "YYYY-MM-DD"
}
```

**Response `200`:** `{ "rock": Rock }`

---

### `POST /api/rocks/:id/status`

Change rock status. Always creates a `rock_status_history` entry.

**Body:**
```json
{
  "status": "off_track",
  "note":   "string (optional — reason for status change)"
}
```

**Response `200`:**
```json
{
  "rock":        Rock,
  "historyEntry": RockStatusHistoryEntry
}
```

**Response `400`:** Invalid status value.

---

### `DELETE /api/rocks/:id`

Hard delete. Admin only. Cannot delete rocks with history entries (use `dropped` status instead).

**Response `204`:** No content.

**Response `403`:** Not admin.

**Response `409`:** Rock has history entries — cannot hard delete.
