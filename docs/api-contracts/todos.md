# API Contract — Todos

> Status: **Partially Implemented** — pre-meeting status update flow live; CRUD still stubbed.

---

## Types

```typescript
type TodoStatus = 'open' | 'done' | 'blocked' | 'carried'

interface Todo {
  id:               string
  title:            string
  assignedToId:     string
  teamId:           string
  meetingId:        string | null
  dueDate:          string | null   // 'YYYY-MM-DD'
  status:           TodoStatus
  carryOverReason:  string | null
  acknowledgedAt:   string | null
  linkedRockId:     string | null
  createdAt:        string
  updatedAt:        string
}

interface MeetingTodoRow {
  todo:       Todo
  notUpdated: boolean   // true when updatedAt < (meeting.scheduledAt - 1h)
}
```

---

## Business Rules

1. **`assignedToId` cannot be null.**
2. **`updatedAt` is the freshness signal** for pre-meeting prep: if a todo's
   `updatedAt` is older than `meeting.scheduledAt - 1 hour`,
   `getMeetingTodos` flags it as `notUpdated: true`.
3. **`carryOverReason`** is the free-text slot for non-completion explanations.
   `updateTodoStatus` writes the `reason` field there for `blocked`/`carried`
   transitions, and clears it on `done`.
4. **`acknowledgedAt`** is set whenever the status is changed to anything
   other than `open` — it captures the moment the owner confirmed the new state.

---

## Endpoints

### `POST /api/todos/:id/status`

Update a single todo's status from the pre-meeting flow.

**Body:**
```json
{
  "status": "open | done | blocked | carried",
  "reason": "string (optional)",
  "userId": "uuid (optional — defaults to authenticated user)"
}
```

**Response `200`:** `{ "todo": Todo }`
**Response `400`:** `VALIDATION_ERROR` or `INVALID_STATUS`.
**Response `404`:** Todo not found.

---

### `GET /api/meetings/:id/todos`

Pre-meeting view: open / blocked / carried todos for the meeting's team, with
a `notUpdated` flag for any todo whose owner hasn't refreshed it within 1 hour
of `meeting.scheduledAt`.

**Response `200`:** `{ "items": [MeetingTodoRow], "total": 12 }`
**Response `404`:** Meeting not found.

---

### Other endpoints (stubbed)

- `GET    /api/todos`
- `GET    /api/todos/:id`
- `POST   /api/todos`
- `PATCH  /api/todos/:id`
- `POST   /api/todos/:id/complete`
- `POST   /api/todos/:id/drop`
- `DELETE /api/todos/:id`

These return placeholder responses today and will be filled in alongside the
meeting lifecycle work tracked in `docs/specs/`.
