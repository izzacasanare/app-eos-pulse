# API Contract — Check-ins

> Status: **Placeholder** — shapes defined here; implementation pending

---

## Types

```typescript
interface Checkin {
  id:            string
  meetingId:     string
  userId:        string
  headline:      string | null      // personal good-news headline
  scorecardData: Record<string, number | string | null>  // { metricKey: value }
  submittedAt:   string             // immutable after set
}

interface CheckinStatus {
  userId:      string
  userName:    string
  submitted:   boolean
  submittedAt: string | null
}
```

---

## Business Rules

1. **One per person per meeting:** Unique constraint on `(meetingId, userId)`. Submitting again returns the existing check-in (idempotent).
2. **Immutable after submission:** `submittedAt` is set on first submit. The check-in record cannot be updated after that.
3. **Scorecard data is untyped at the API layer** — the shape of `scorecardData` is defined by team configuration (out of scope for v1).

---

## Endpoints

### `GET /api/meetings/:meetingId/checkins`

Get all check-ins for a meeting, including pending (not yet submitted) participants.

**Response `200`:**
```json
{
  "submitted": [Checkin],
  "pending":   [{ "userId": "uuid", "userName": "string" }],
  "total":     10,
  "submittedCount": 7
}
```

---

### `GET /api/meetings/:meetingId/checkins/:userId`

Get a specific user's check-in for a meeting.

**Response `200`:** `{ "checkin": Checkin }`

**Response `404`:** Not submitted yet.

---

### `POST /api/meetings/:meetingId/checkins`

Submit a check-in. Can only submit for the currently authenticated user (or admin submitting on behalf).

**Body:**
```json
{
  "headline":      "string (optional)",
  "scorecardData": { "metricKey": 42 }
}
```

**Response `201`:** `{ "checkin": Checkin }`

**Response `409`:** Check-in already submitted for this meeting.

---

### `GET /api/meetings/:meetingId/checkins/status`

Summary of who has and hasn't submitted for a meeting — used by the facilitator pre-meeting view.

**Response `200`:**
```json
{
  "statuses": [CheckinStatus],
  "submittedCount": 7,
  "totalExpected":  10
}
```
