# EOS Pulse — Meetings API Contract

> Handler: `service/handlers/meetings.handler.ts`
> Domain: `service/domain/meetings.domain.ts`

---

## Types

```typescript
type MeetingType   = 'l10' | 'quarterly'
type MeetingStatus = 'upcoming' | 'live' | 'pending_close' | 'closed'

interface Meeting {
  id:               string       // uuid
  teamId:           string       // uuid → teams.id
  type:             MeetingType
  scheduledAt:      string       // ISO 8601 timestamp
  hostId:           string | null
  status:           MeetingStatus
  fathomUrl:        string | null
  meetingRatingAvg: number | null
  summarySentAt:    string | null
  createdAt:        string
}
```

**Status state machine:**
```
upcoming → live → pending_close → closed
```
Transitions are enforced — skipping or reversing throws `INVALID_STATUS_TRANSITION`.

---

## Endpoints

### `GET /api/meetings`

List all meetings, most recent first.

**Query params**

| Param | Type | Description |
|---|---|---|
| `teamId` | uuid | Filter by team |
| `type` | `l10` \| `quarterly` | Filter by type |
| `status` | string | Filter by status |
| `from` | ISO date | `scheduledAt ≥` |
| `to` | ISO date | `scheduledAt ≤` |

**Response `200`**
```json
{ "items": [Meeting], "total": 4 }
```

---

### `GET /api/meetings/:id`

Get a meeting with linked todos and issues.

**Response `200`**
```json
{
  "meeting": Meeting,
  "todos":   [Todo],
  "issues":  [Issue]
}
```

**Response `200` (not found)**
```json
{ "error": "NOT_FOUND", "message": "Meeting not found" }
```

---

### `POST /api/meetings`

Create a meeting. Admin only.

**Body**
```json
{
  "teamId":      "uuid",
  "type":        "l10",
  "scheduledAt": "2026-05-06T14:00:00Z",
  "hostId":      "uuid"
}
```

`hostId` is optional.

**Response `200`**
```json
{ "meeting": Meeting }
```

**Response `200` (validation)**
```json
{ "error": "VALIDATION_ERROR", "message": "teamId, type, and scheduledAt are required" }
```

---

### `PUT /api/meetings/:id/status`

Transition meeting to the next status. Validates the state machine.

**Body**
```json
{ "status": "live" }
```

Closing (`"closed"`) will fail if any linked issue has status `open`, `assigned`, or `in_progress`.

**Response `200`**
```json
{ "meeting": Meeting }
```

**Response `200` (blocked)**
```json
{
  "error": "OPEN_ISSUES_BLOCKING",
  "message": "Meeting cannot be closed — 2 issue(s) are still open.",
  "blockingIssueIds": ["uuid", "uuid"]
}
```

**Response `200` (invalid transition)**
```json
{ "error": "INVALID_STATUS_TRANSITION", "message": "Cannot transition meeting from 'closed' to 'live'." }
```

---

### `POST /api/meetings/:id/open-session`

Host confirms session start. Transitions `upcoming → live` and auto-populates carry-over todos from the previous closed session for the same team.

**Body:** none

**Response `200`**
```json
{
  "meeting":        Meeting,
  "carryOverTodos": [Todo],
  "openIssues":     [Issue]
}
```

`carryOverTodos` — new todo entries created in this session, copied from the previous session's open todos. The originals are marked `carried`.

`openIssues` — all open/assigned/in_progress issues for the team, surfaced for the session agenda.

---

### `POST /api/meetings/:id/open`

Alias for `open-session` — kept for backward compatibility.

---

### `POST /api/meetings/:id/close`

Transitions `pending_close → closed`. Blocked by open issues (same guard as `PUT /status`).

**Response `200`**
```json
{ "meeting": Meeting }
```

---

### `GET /api/meetings/:id/host-prep`

Returns the host prep checklist: carry-over todos from the previous session and all open team issues.

**Response `200`**
```json
{
  "meeting":        Meeting,
  "carryOverTodos": [Todo],
  "openIssues":     [Issue]
}
```

**Response `200` (not found)**
```json
{ "error": "NOT_FOUND", "message": "Meeting not found" }
```

---

### `POST /api/meetings/auto-create`

Auto-creates the next weekly session for a team. Schedules 7 days after the most recent session; inherits type and host. Carries open todos forward.

**Body**
```json
{ "teamId": "uuid" }
```

**Response `200`**
```json
{
  "meeting":        Meeting,
  "carryOverTodos": [Todo],
  "openIssues":     [Issue]
}
```

---

### `GET /api/meetings/upcoming`

All meetings with status `upcoming`, ordered by `scheduledAt` ascending.

**Response `200`**
```json
{ "meetings": [Meeting] }
```

---

### `GET /api/teams/:id/meetings`

All meetings for a team, most recent first.

**Response `200`**
```json
{ "meetings": [Meeting] }
```

---

### `GET /api/teams/:id/current-host`

Returns the host user of the next upcoming/live meeting for the team.

**Response `200`**
```json
{ "host": User | null }
```

---

### `PATCH /api/meetings/:id`

Update meeting metadata. Does not accept `status` (use `/status` or `/open-session`).

**Body (all optional)**
```json
{
  "scheduledAt":     "2026-05-06T14:00:00Z",
  "hostId":          "uuid",
  "fathomUrl":       "https://fathom.video/...",
  "meetingRatingAvg": 4.2
}
```

**Response `200`**
```json
{ "meeting": Meeting }
```

---

### `DELETE /api/meetings/:id`

Delete a meeting. Admin only. Cannot delete a `live` meeting.

**Response `200`** `null`

**Response `200` (not found)**
```json
{ "error": "NOT_FOUND", "message": "Meeting 'uuid' not found." }
```

---

## Settings API

### `GET /api/settings`

Returns all app settings. Secret values (API keys) are replaced with `"••••••••"`.

**Response `200`**
```json
{
  "settings": {
    "CLICKUP_API_KEY":       "••••••••",
    "CLICKUP_IDS_LIST_ID":   "901234567",
    "IDS_SYNC_ENABLED":      "true",
    "ROCKS_SYNC_ENABLED":    "false",
    "TODOS_SYNC_ENABLED":    "false",
    "TEAMS_WEBHOOK_URL":     null
  }
}
```

---

### `PUT /api/settings`

Bulk-upsert settings. Pass only the keys you want to change.

**Body**
```json
{
  "IDS_SYNC_ENABLED":   "true",
  "ROCKS_SYNC_ENABLED": "false"
}
```

Pass `null` to clear a value.

**Response `200`** `{ "ok": true }`

---

### `POST /api/settings/test-clickup`

Tests the stored ClickUp API key by calling `GET /api/v2/team`.

**Response `200`** `{ "ok": true }` or `{ "ok": false, "error": "..." }`

---

## Domain Errors

| Error class | When thrown |
|---|---|
| `MeetingNotFoundError` | `getMeetingById`, `updateMeetingStatus`, `updateMeeting`, `deleteMeeting` with unknown id |
| `MeetingCloseBlockedError` | Closing while linked issues are `open`/`assigned`/`in_progress` |
| `MeetingStatusTransitionError` | Invalid state machine transition |
