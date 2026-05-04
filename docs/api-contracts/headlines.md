# API Contract — Headlines

> Status: **Implemented (pre-meeting submission module)**

---

## Types

```typescript
type HeadlineCategory =
  | 'absence'
  | 'headcount'
  | 'closed_won'
  | 'cancellation'
  | 'general'

interface Headline {
  id:             string
  submitterId:    string
  meetingId:      string
  category:       HeadlineCategory
  content:        string
  escalatedToIds: boolean
  submittedAt:    string             // ISO timestamp
}
```

---

## Business Rules

1. **`category` is required** and must be one of the values listed above.
2. **`content` is required** and trimmed before storage.
3. **Escalation is one-way:** once a headline has been escalated to IDS, it
   cannot be escalated again. The escalation creates a corresponding `issue`
   row scoped to the meeting's team and links them via the meeting.

---

## Endpoints

### `POST /api/meetings/:id/headlines`

Submit a single headline for a meeting.

**Body:**
```json
{
  "submitterId": "uuid (optional — defaults to authenticated user)",
  "category":    "absence | headcount | closed_won | cancellation | general",
  "content":     "string"
}
```

**Response `200`:** `{ "headline": Headline }`

**Response `400`:** `VALIDATION_ERROR` (missing fields) or `INVALID_CATEGORY`.

---

### `GET /api/meetings/:id/headlines`

List all headlines submitted for the meeting, newest first.

**Response `200`:** `{ "items": [Headline], "total": 5 }`

---

### `POST /api/meetings/:id/headlines/:headlineId/escalate`

Escalate a headline into a tracked IDS issue. Creates a new `issue` row owned
by the meeting's source team and flips `escalatedToIds=true` on the headline.

**Response `200`:**
```json
{
  "headline": Headline,
  "issue":    Issue
}
```

**Response `404`:** Headline or meeting not found.
**Response `409`:** `ALREADY_ESCALATED` — the headline was previously escalated.
