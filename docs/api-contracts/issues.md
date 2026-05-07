# API Contract — Issues (IDS)

> Status: **Implemented (company-wide IDS module)**

The Issues module is the operational core of EOS Pulse. Every employee can
submit issues; Dept Leads triage and assign; resolvers close them with notes;
Leadership pulls escalated items into the Quarterly meeting.

---

## Types

```typescript
type IssueStatus =
  | 'open'             // logged, no assignee yet
  | 'assigned'         // a resolver has been assigned by the Dept Lead
  | 'in_progress'      // resolver is actively working on it
  | 'pending_closure'  // resolver has done the work and submitted notes
  | 'closed'           // Dept Lead has approved and closed

type IssuePriority = 'low' | 'medium' | 'high' | 'critical'

interface Issue {
  id:                    string
  title:                 string
  description:           string | null
  submitterId:           string
  sourceTeamId:          string         // auto-derived from submitter's team
  targetDeptId:          string         // department expected to resolve
  priority:              IssuePriority
  status:                IssueStatus
  assignedToId:          string | null
  meetingId:             string | null
  escalateToLeadership:  boolean        // true → appears in Leadership Quarterly
  resolutionNotes:       string | null  // required ≥50 chars to close
  sopLink:               string | null
  isFathomSource:        boolean
  createdAt:             string
  updatedAt:             string
}
```

---

## Business Rules (enforced in `service/domain/issues.domain.ts`)

1. **Resolution notes minimum length** — `resolutionNotes` must be at least
   **50 characters** (after trim) before an issue can be closed. Shorter input
   returns `400 RESOLUTION_NOTES_TOO_SHORT`.
2. **Dept Lead approval to close** — Closing an issue requires the caller to
   be the Dept Lead (`team_lead`) of the issue's `targetDeptId`, or
   Leadership / Super Admin. Returns `403 DEPT_LEAD_APPROVAL_REQUIRED`.
3. **Dept Lead assignment** — Only the Dept Lead of the target dept (or
   Leadership) can assign a resolver. Returns `403 NOT_DEPT_LEAD`.
4. **Auto-escalate after 48hr** — Issues that remain `open` (no assignee)
   for more than 48 hours are surfaced via `GET /api/issues/overdue` for
   the nudge cron, which calls `PUT /api/issues/:id/escalate` to set
   `escalateToLeadership = true`.
5. **Leadership queue** — Any issue with `escalateToLeadership = true`
   automatically appears in the Quarterly Leadership Meeting queue
   (queryable via `GET /api/issues/escalated`).
6. **Source team auto-derivation** — `sourceTeamId` is auto-set from the
   submitter's `users.teamId` on create unless explicitly overridden.
7. **No skipping closeIssue** — `PUT /api/issues/:id/status` rejects
   transitions to `closed`. The dedicated `/close` route is the only way
   to finalize closure (it enforces rules 1 and 2).
8. **Convert-to-Rock** — Only Leadership / Super Admin can convert an issue
   into a Rock; called on Day 3 of the Quarterly meeting. The source issue
   is auto-closed with system-generated resolution notes.

---

## Endpoints

### `GET /api/issues`

Company-wide list. **Visible to all employees — no role gate on viewing.**

**Query params** (all optional):

| Param | Type | Description |
|---|---|---|
| `dept` | uuid | Matches either `sourceTeamId` or `targetDeptId` |
| `sourceTeamId` | uuid | Filter by source team |
| `targetDeptId` | uuid | Filter by target department |
| `status` | `IssueStatus` or comma-list | One status or several |
| `priority` | `IssuePriority` or comma-list | One priority or several |
| `dateFrom` | ISO date | Created on or after |
| `dateTo` | ISO date | Created on or before |
| `submitter` | uuid | Filter by submitter |
| `assignedTo` | uuid | Filter by assignee |
| `meetingId` | uuid | Filter by linked meeting |
| `escalatedToLeadership` | `true` / `false` | Show only escalated items |

**Response `200`:** `{ "items": Issue[], "total": number }`

---

### `GET /api/issues/escalated`

All issues flagged for the Quarterly Leadership Meeting.

**Response `200`:** `{ "items": Issue[], "total": number }`

---

### `GET /api/issues/overdue`

Issues unassigned past the 48hr SLA. Used by the nudge cron.

**Response `200`:** `{ "items": Issue[], "total": number }`

---

### `GET /api/issues/:id`

Get a single issue.

**Response `200`:** `{ "issue": Issue }`
**Response `404`:** `{ "error": "NOT_FOUND" }`

---

### `POST /api/issues`

Create a new issue. Any employee may submit.

**Body:**
```json
{
  "title":          "string (required)",
  "description":    "string (optional)",
  "submitterId":    "uuid (defaults to current user)",
  "targetDeptId":   "uuid (required — owning department)",
  "sourceTeamId":   "uuid (optional — defaults to submitter's team)",
  "priority":       "low | medium | high | critical (default 'medium')",
  "meetingId":      "uuid (optional)",
  "isFathomSource": "boolean (optional)"
}
```

**Response `200`:** `{ "issue": Issue }`
**Response `400`:** `VALIDATION_ERROR` (missing required field)
**Response `404`:** `NOT_FOUND` (referenced user/team does not exist)

> Backwards-compat: legacy callers that send `teamId` and `ownerId` (e.g.
> the LiveSessionPage Park-to-IDS button) are accepted — `teamId` maps to
> both `sourceTeamId` and `targetDeptId`, and `ownerId` maps to
> `submitterId`.

---

### `PUT /api/issues/:id/assign`

Assign a resolver. Caller must be the Dept Lead of the issue's
`targetDeptId`, or Leadership / Super Admin.

**Body:**
```json
{
  "assignedToId": "uuid (required)",
  "assignedById": "uuid (defaults to current user)"
}
```

**Response `200`:** `{ "issue": Issue }`
**Response `403`:** `{ "error": "NOT_DEPT_LEAD" }`
**Response `404`:** assigner / assignee / issue not found
**Response `409`:** `INVALID_STATUS_TRANSITION` if the issue is already closed

Side effect: when the issue is currently `open`, status advances to
`assigned`.

---

### `PUT /api/issues/:id/status`

Update status to anything except `closed` (use `/close`).

**Body:**
```json
{
  "status": "open | assigned | in_progress | pending_closure",
  "userId": "uuid (defaults to current user)"
}
```

**Response `200`:** `{ "issue": Issue }`
**Response `400`:** `VALIDATION_ERROR` for unknown status
**Response `409`:** `INVALID_STATUS_TRANSITION` (e.g. attempted close)

---

### `PUT /api/issues/:id/close`

Close with resolution notes. Enforces both `RESOLUTION_NOTES_MIN_LENGTH = 50`
and Dept Lead approval.

**Body:**
```json
{
  "resolutionNotes": "string (required, ≥50 chars after trim)",
  "sopLink":         "string | null (optional)",
  "closedById":      "uuid (defaults to current user)"
}
```

**Response `200`:** `{ "issue": Issue }`
**Response `400`:**
```json
{
  "error":          "RESOLUTION_NOTES_TOO_SHORT",
  "message":        "Resolution notes must be at least 50 characters. Received: 22.",
  "currentLength":  22,
  "requiredLength": 50
}
```
**Response `403`:** `{ "error": "DEPT_LEAD_APPROVAL_REQUIRED" }`
**Response `409`:** `INVALID_STATUS_TRANSITION` (already closed)

---

### `PUT /api/issues/:id/escalate`

Flag an issue for the Quarterly Leadership Meeting. Sets
`escalateToLeadership = true`. Idempotent.

**Body:** none.

**Response `200`:** `{ "issue": Issue }`
**Response `404`:** `NOT_FOUND`

---

### `POST /api/issues/:id/convert-to-rock`

Convert an issue into a Rock. Day 3 of the Quarterly Leadership Meeting.
Only Leadership / Super Admin may call this. The source issue is closed
with system-generated resolution notes; a new row is inserted into the
rocks table.

**Body:**
```json
{
  "rockData": {
    "title":        "string (required)",
    "ownerId":      "uuid (required)",
    "teamId":       "uuid (required)",
    "level":        "company | dept | individual (default 'dept')",
    "quarter":      "1 | 2 | 3 | 4 (required)",
    "year":         "integer (required)",
    "parentRockId": "uuid (optional)"
  },
  "convertedById": "uuid (defaults to current user)"
}
```

**Response `200`:** `{ "issue": Issue, "rock": Rock }`
**Response `400`:** `VALIDATION_ERROR` for missing rock fields
**Response `403`:** `{ "error": "LEADERSHIP_ROLE_REQUIRED" }`
**Response `409`:** `INVALID_STATUS_TRANSITION` (issue already closed)

---

## Error Codes Reference

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Missing or malformed input |
| `RESOLUTION_NOTES_TOO_SHORT` | 400 | Close attempted with <50 chars |
| `NOT_FOUND` | 404 | Issue / user / team does not exist |
| `NOT_DEPT_LEAD` | 403 | Assign by non-Dept-Lead |
| `DEPT_LEAD_APPROVAL_REQUIRED` | 403 | Close by non-Dept-Lead |
| `LEADERSHIP_ROLE_REQUIRED` | 403 | Convert-to-Rock by non-Leadership |
| `INVALID_STATUS_TRANSITION` | 409 | Closed-issue mutation, or `/status` to closed |
