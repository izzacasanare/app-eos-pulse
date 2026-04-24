# API Contract — Issues (IDS)

> Status: **Placeholder** — shapes defined here; implementation pending

---

## Types

```typescript
type IssueStatus   = 'open' | 'ids_in_progress' | 'resolved' | 'dropped'
type IssuePriority = 'low' | 'medium' | 'high'

interface Issue {
  id:              string
  meetingId:       string | null   // null = standalone issue
  teamId:          string
  ownerId:         string
  title:           string
  description:     string | null
  status:          IssueStatus
  resolutionNotes: string | null   // required (≥50 chars) when status = 'resolved'
  priority:        IssuePriority | null
  createdAt:       string
  resolvedAt:      string | null
}
```

---

## Business Rules (enforced at domain layer)

1. **Resolution notes required:** `resolutionNotes` must be ≥ 50 characters before status can be set to `'resolved'`. Returns `400` if violated.
2. **No skipping states:** Cannot jump from `open` → `resolved` without going through `ids_in_progress` first (optional — TBD during implementation).
3. **Meeting close guard:** A meeting cannot be closed while any of its linked issues are `open` or `ids_in_progress'`. Enforced in the meetings domain, not here.

---

## Endpoints

### `GET /api/issues`

List issues. Paginated.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `teamId` | string | Filter by team |
| `meetingId` | string | Filter by meeting |
| `ownerId` | string | Filter by owner |
| `status` | IssueStatus | Filter by status |
| `priority` | IssuePriority | Filter by priority |
| `page` | number | Default `1` |
| `pageSize` | number | Default `20`, max `100` |

**Response `200`:** `{ "items": [Issue], "total": 42 }`

---

### `GET /api/issues/:id`

Get a single issue.

**Response `200`:** `{ "issue": Issue }`

**Response `404`:** Not found.

---

### `POST /api/issues`

Create a new issue.

**Body:**
```json
{
  "teamId":      "uuid",
  "title":       "string (required)",
  "description": "string (optional)",
  "priority":    "medium",
  "meetingId":   "uuid (optional)",
  "ownerId":     "uuid (optional — defaults to current user)"
}
```

**Response `201`:** `{ "issue": Issue }`

---

### `PATCH /api/issues/:id`

Update issue fields. Use this for editing title, description, priority, owner.

**Body (all optional):**
```json
{
  "title":       "string",
  "description": "string",
  "priority":    "high",
  "ownerId":     "uuid"
}
```

**Response `200`:** `{ "issue": Issue }`

---

### `POST /api/issues/:id/start-ids`

Transition status `open` → `ids_in_progress`. Signals the team is actively discussing this issue.

**Response `200`:** `{ "issue": Issue }`

**Response `409`:** Already in progress or resolved.

---

### `POST /api/issues/:id/resolve`

Transition status to `'resolved'`. Resolution notes are **required**.

**Body:**
```json
{
  "resolutionNotes": "string (required, min 50 characters)"
}
```

**Response `200`:** `{ "issue": Issue }`

**Response `400`:**
```json
{
  "error": "RESOLUTION_NOTES_TOO_SHORT",
  "message": "Resolution notes must be at least 50 characters.",
  "currentLength": 22,
  "requiredLength": 50
}
```

---

### `POST /api/issues/:id/drop`

Transition status to `'dropped'`. Issue is closed without resolution.

**Body:** `{ "note": "string (optional — reason for dropping)" }`

**Response `200`:** `{ "issue": Issue }`

---

### `DELETE /api/issues/:id`

Hard delete. Admin only. Cannot delete issues in `ids_in_progress` status.

**Response `204`:** No content.

**Response `403`:** Not admin.
