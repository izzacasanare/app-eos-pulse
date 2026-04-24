# API Contract — Todos

> Status: **Placeholder** — shapes defined here; implementation pending

---

## Types

```typescript
type TodoStatus = 'open' | 'complete' | 'dropped'

interface Todo {
  id:          string
  meetingId:   string | null   // null = standalone to-do
  ownerId:     string
  title:       string
  dueDate:     string | null   // ISO date: 'YYYY-MM-DD'
  status:      TodoStatus
  createdAt:   string
  completedAt: string | null   // set when status → 'complete'
}
```

---

## Business Rules

1. **Owner required:** `ownerId` cannot be null.
2. `completedAt` is set automatically by the server when status transitions to `'complete'` — not accepted from client.
3. To-dos created in a meeting are displayed in the to-do review segment of that meeting's L10.
4. Overdue to-dos (past `dueDate`, still `open`) are included in nudge queries.

---

## Endpoints

### `GET /api/todos`

List to-dos. Paginated.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `meetingId` | string | Filter to-dos created in a specific meeting |
| `ownerId` | string | Filter by owner |
| `status` | TodoStatus | Filter by status |
| `overdue` | boolean | If `true`, return only open to-dos past their `dueDate` |
| `page` | number | Default `1` |
| `pageSize` | number | Default `50`, max `200` |

**Response `200`:** `{ "items": [Todo], "total": 42 }`

---

### `GET /api/todos/:id`

Get a single to-do.

**Response `200`:** `{ "todo": Todo }`

**Response `404`:** Not found.

---

### `POST /api/todos`

Create a to-do.

**Body:**
```json
{
  "title":     "string (required)",
  "ownerId":   "uuid (required)",
  "meetingId": "uuid (optional)",
  "dueDate":   "YYYY-MM-DD (optional)"
}
```

**Response `201`:** `{ "todo": Todo }`

---

### `PATCH /api/todos/:id`

Update a to-do's title, dueDate, or ownerId.

**Body (all optional):**
```json
{
  "title":   "string",
  "dueDate": "YYYY-MM-DD",
  "ownerId": "uuid"
}
```

**Response `200`:** `{ "todo": Todo }`

---

### `POST /api/todos/:id/complete`

Mark a to-do as complete. Sets `completedAt` to now.

**Body:** none

**Response `200`:** `{ "todo": Todo }`

**Response `409`:** Already complete or dropped.

---

### `POST /api/todos/:id/drop`

Mark a to-do as dropped (will not be completed).

**Body:** none

**Response `200`:** `{ "todo": Todo }`

---

### `DELETE /api/todos/:id`

Hard delete. Admin only.

**Response `204`:** No content.

**Response `403`:** Not admin.
