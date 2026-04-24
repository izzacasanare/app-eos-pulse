# API Contract — Nudges

> Status: **Placeholder** — shapes defined here; implementation pending

---

## Overview

Nudges are scheduled accountability messages delivered via Microsoft Teams. They are **system-generated** — not triggered by user action. The nudge system runs as a background cron job inside the Deno backend.

There is no public `POST /nudge` endpoint — nudges fire on schedule only.

---

## Types

```typescript
type NudgeType =
  | 'rock_status_due'        // Rock hasn't been updated this week
  | 'todo_overdue'           // To-do is past due date and still open
  | 'meeting_reminder'       // Meeting starts in N hours
  | 'checkin_reminder'       // Meeting starts soon; user hasn't submitted check-in
  | 'ids_unresolved'         // Open issue assigned to user has been open > N days

interface NudgeLog {
  id:          string
  type:        NudgeType
  userId:      string        // recipient
  resourceId:  string        // rock/todo/meeting/issue ID
  sentAt:      string
  delivered:   boolean
  error:       string | null // Teams delivery error if any
}
```

---

## Nudge Schedule

| Nudge type | Schedule | Condition |
|---|---|---|
| `rock_status_due` | Every Monday 9:00 AM | Rock owned by user has no status update in 7+ days |
| `todo_overdue` | Daily 9:00 AM | To-do is past `dueDate` and still `open` |
| `meeting_reminder` | 1 hour before meeting | Meeting status is `scheduled` or `open` |
| `checkin_reminder` | 30 min before meeting | Meeting status is `scheduled`; user hasn't submitted check-in |
| `ids_unresolved` | Every Thursday 9:00 AM | Issue assigned to user has been `open` for 5+ days |

---

## Endpoints (admin / observability only)

### `GET /api/nudges/logs`

Get the nudge delivery log. Admin only.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `userId` | string | Filter by recipient |
| `type` | NudgeType | Filter by nudge type |
| `from` | ISO date | Sent at ≥ |
| `to` | ISO date | Sent at ≤ |
| `delivered` | boolean | Filter by delivery success |
| `page` | number | Default `1` |
| `pageSize` | number | Default `50` |

**Response `200`:** `{ "items": [NudgeLog], "total": 42 }`

---

### `GET /api/nudges/preview`

Preview which nudges would fire right now without actually sending them. Admin only. Used for testing schedule logic.

**Response `200`:**
```json
{
  "wouldFire": [
    {
      "type":       "todo_overdue",
      "userId":     "uuid",
      "userName":   "Jane Smith",
      "resourceId": "uuid",
      "reason":     "Todo 'Update QBR deck' is 3 days overdue"
    }
  ]
}
```

---

### `POST /api/nudges/test`

Send a test nudge to the authenticated user. Admin only. Used to verify Teams webhook is working.

**Body:** `{ "type": "meeting_reminder" }`

**Response `200`:** `{ "delivered": true }` or `{ "delivered": false, "error": "..." }`

---

## Teams Message Format

Nudges are sent as Teams Adaptive Cards. Format per type:

**`todo_overdue`:**
> ⚠️ **Overdue To-Do** — Hi [Name], your to-do **"[title]"** was due on [date] and is still open. [View To-Do →]

**`rock_status_due`:**
> 📍 **Rock Check-In** — Hi [Name], your rock **"[title]"** hasn't been updated in 7 days. Please update its status. [Update Rock →]

**`meeting_reminder`:**
> 📅 **Meeting Starting Soon** — Your [type] meeting starts in 1 hour ([time]). [Open Meeting →]

**`checkin_reminder`:**
> 📋 **Pre-Meeting Check-In** — Your meeting starts in 30 minutes. You haven't submitted your check-in yet. [Submit Now →]

**`ids_unresolved`:**
> 🔴 **Unresolved Issue** — Hi [Name], the issue **"[title]"** has been open for [N] days and is assigned to you. [Resolve Issue →]

---

## Failure Handling

- Failed nudge deliveries are logged in `nudge_logs` with `delivered: false` and the error message
- Failures do not retry automatically in v1 — they surface in the admin nudge log
- Admin dashboard shows delivery failure rate; threshold alert TBD
