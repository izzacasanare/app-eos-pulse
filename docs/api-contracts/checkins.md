# API Contract — Check-ins

> Status: **Implemented (pre-meeting submission module)**

---

## Types

```typescript
interface Checkin {
  id:                   string
  memberId:             string
  meetingId:            string
  personalGoodNews:     string | null
  professionalGoodNews: string | null
  submittedAt:          string             // ISO timestamp
}

interface MissingMember {
  id:    string
  name:  string
  email: string
}

interface MeetingCheckinsResult {
  meetingId:      string
  submitted:      Checkin[]
  missingMembers: MissingMember[]
  totalExpected:  number
  submittedCount: number
}
```

---

## Business Rules

1. **One check-in per `(memberId, meetingId)`** — re-submitting updates the
   existing row in place and refreshes `submittedAt`.
2. **`submittedAt` is server-controlled** — never accepted from the client.
3. **Missing members** are derived from `users.teamId === meeting.teamId`
   minus the set of users who have already submitted.

---

## Endpoints

### `POST /api/meetings/:id/checkin`

Submit (or re-submit) a check-in for the current user.

**Body:**
```json
{
  "memberId":             "uuid (optional — defaults to authenticated user)",
  "personalGoodNews":     "string | null",
  "professionalGoodNews": "string | null"
}
```

**Response `200`:** `{ "checkin": Checkin }`

**Response `400`:** `VALIDATION_ERROR` — `memberId` could not be resolved.

---

### `GET /api/meetings/:id/checkins`

Get all check-ins for a meeting, with the list of members who have **not**
submitted.

**Response `200`:**
```json
{
  "meetingId":      "uuid",
  "submitted":      [Checkin],
  "missingMembers": [MissingMember],
  "totalExpected":  10,
  "submittedCount": 7
}
```

**Response `404`:** Meeting not found.
