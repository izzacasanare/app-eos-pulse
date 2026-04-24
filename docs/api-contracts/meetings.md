# API Contract — Meetings

> Status: **Placeholder** — shapes defined here; implementation pending

---

## Types

```typescript
type MeetingType   = 'l10' | 'leadership'
type MeetingStatus = 'scheduled' | 'open' | 'closed'

interface Meeting {
  id:            string
  type:          MeetingType
  teamId:        string
  facilitatorId: string | null
  scheduledAt:   string        // ISO 8601
  startedAt:     string | null
  closedAt:      string | null
  status:        MeetingStatus
  agendaJson:    AgendaSegment[] | null
  notes:         string | null
  createdAt:     string
}

interface AgendaSegment {
  label:          string
  targetMinutes:  number
}
```

---

## Endpoints

### `GET /api/meetings`

List meetings. Paginated.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `teamId` | string | Filter by team |
| `type` | `l10` \| `leadership` | Filter by meeting type |
| `status` | `scheduled` \| `open` \| `closed` | Filter by status |
| `from` | ISO date | Scheduled at ≥ |
| `to` | ISO date | Scheduled at ≤ |
| `page` | number | Default `1` |
| `pageSize` | number | Default `20`, max `100` |

**Response `200`:**
```json
{ "items": [Meeting], "total": 42 }
```

---

### `GET /api/meetings/:id`

Get a single meeting with full detail.

**Response `200`:**
```json
{
  "meeting": Meeting,
  "issues":   [Issue],
  "todos":    [Todo],
  "checkins": [Checkin],
  "headlines": [Headline]
}
```

**Response `404`:** Meeting not found.

---

### `POST /api/meetings`

Create a new meeting.

**Body:**
```json
{
  "type":         "l10",
  "teamId":       "uuid",
  "scheduledAt":  "2025-06-03T14:00:00Z",
  "agendaJson":   [{ "label": "Segue", "targetMinutes": 5 }]
}
```

**Response `201`:** `{ "meeting": Meeting }`

**Response `400`:** Validation error (missing required fields).

---

### `POST /api/meetings/:id/open`

Transition meeting status from `scheduled` → `open`. Sets `startedAt` to now.

**Body:** none

**Response `200`:** `{ "meeting": Meeting }`

**Response `409`:** Meeting is already open or closed.

---

### `POST /api/meetings/:id/close`

Transition meeting status from `open` → `closed`. Sets `closedAt` to now.

**Business rule:** Fails if any issues linked to this meeting have status `'open'` or `'ids_in_progress'`.

**Body:** `{ "notes": "string (optional)" }`

**Response `200`:** `{ "meeting": Meeting }`

**Response `409`:**
```json
{
  "error": "OPEN_ISSUES_BLOCKING",
  "message": "Meeting cannot be closed — 3 issue(s) are still open.",
  "blockingIssueIds": ["uuid", "uuid", "uuid"]
}
```

---

### `PATCH /api/meetings/:id`

Update meeting metadata. Cannot update `status` directly — use open/close endpoints.

**Body (all optional):**
```json
{
  "notes":       "string",
  "agendaJson":  [AgendaSegment],
  "scheduledAt": "ISO 8601"
}
```

**Response `200`:** `{ "meeting": Meeting }`

---

### `DELETE /api/meetings/:id`

Delete a meeting. Admin only. Cannot delete meetings with status `'open'`.

**Response `204`:** No content.

**Response `403`:** Not admin.

**Response `409`:** Cannot delete an open meeting.
