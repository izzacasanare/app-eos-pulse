# EOS Pulse — Data Model

## Tables

### users
MSPBots staff members. Populated from the platform — no self-registration.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| name | text | NOT NULL | |
| email | text | NOT NULL UNIQUE | |
| team_id | uuid | FK → teams.id | Primary team assignment |
| role | text | NOT NULL | `'admin'` \| `'leader'` \| `'member'` |
| teams_user_id | text | | Microsoft Teams user ID for nudge delivery |
| created_at | timestamptz | NOT NULL DEFAULT now() | |

---

### teams
The 6 MSPBots internal teams.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| name | text | NOT NULL | |
| lead_id | uuid | FK → users.id | Team lead / L10 facilitator |
| created_at | timestamptz | NOT NULL DEFAULT now() | |

---

### meetings
L10 or Leadership meeting sessions.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| type | text | NOT NULL | `'l10'` \| `'leadership'` |
| team_id | uuid | FK → teams.id NOT NULL | |
| facilitator_id | uuid | FK → users.id | |
| scheduled_at | timestamptz | NOT NULL | |
| started_at | timestamptz | | Set when status → `'open'` |
| closed_at | timestamptz | | Set when status → `'closed'` |
| status | text | NOT NULL DEFAULT `'scheduled'` | `'scheduled'` \| `'open'` \| `'closed'` |
| agenda_json | jsonb | | Segment order + target durations |
| notes | text | | Facilitator notes |
| created_at | timestamptz | NOT NULL DEFAULT now() | |

**Business rule:** Cannot transition to `'closed'` while any linked issue has status `'open'` or `'ids_in_progress'`.

---

### issues
IDS (Identify, Discuss, Solve) items. Can be created standalone or linked to a meeting.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| meeting_id | uuid | FK → meetings.id NULLABLE | Null = standalone issue |
| team_id | uuid | FK → teams.id NOT NULL | |
| owner_id | uuid | FK → users.id NOT NULL | |
| title | text | NOT NULL | |
| description | text | | |
| status | text | NOT NULL DEFAULT `'open'` | `'open'` \| `'ids_in_progress'` \| `'resolved'` \| `'dropped'` |
| resolution_notes | text | | **Min 50 chars** when status = `'resolved'` |
| priority | text | | `'low'` \| `'medium'` \| `'high'` |
| created_at | timestamptz | NOT NULL DEFAULT now() | |
| resolved_at | timestamptz | | Set when status → `'resolved'` |

**Business rule:** `resolution_notes` must be ≥ 50 characters before status can be set to `'resolved'`. Enforced at domain layer — returns HTTP 400 if violated.

---

### rocks
Quarterly goals (Rocks) assigned to individuals or teams.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| owner_id | uuid | FK → users.id NOT NULL | |
| team_id | uuid | FK → teams.id NOT NULL | |
| title | text | NOT NULL | |
| description | text | | |
| quarter | text | NOT NULL | Format: `'Q2-2025'` |
| status | text | NOT NULL DEFAULT `'on_track'` | `'on_track'` \| `'off_track'` \| `'complete'` \| `'dropped'` |
| due_date | date | NOT NULL | End of quarter |
| created_at | timestamptz | NOT NULL DEFAULT now() | |

---

### rock_status_history
Append-only audit log of every rock status change. Never updated or deleted.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| rock_id | uuid | FK → rocks.id NOT NULL | |
| changed_by | uuid | FK → users.id NOT NULL | |
| previous_status | text | NOT NULL | |
| new_status | text | NOT NULL | |
| note | text | | Optional context for the change |
| changed_at | timestamptz | NOT NULL DEFAULT now() | |

**Constraint:** INSERT only — no UPDATE or DELETE ever permitted on this table.

---

### todos
Action items created during or outside of meetings.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| meeting_id | uuid | FK → meetings.id NULLABLE | Null = standalone to-do |
| owner_id | uuid | FK → users.id NOT NULL | |
| title | text | NOT NULL | |
| due_date | date | | |
| status | text | NOT NULL DEFAULT `'open'` | `'open'` \| `'complete'` \| `'dropped'` |
| created_at | timestamptz | NOT NULL DEFAULT now() | |
| completed_at | timestamptz | | Set when status → `'complete'` |

---

### checkins
Weekly scorecard/headline data submitted before or during a meeting.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| meeting_id | uuid | FK → meetings.id NOT NULL | |
| user_id | uuid | FK → users.id NOT NULL | |
| headline | text | | One personal headline |
| scorecard_data | jsonb | | Key metric values `{ metricKey: value }` |
| submitted_at | timestamptz | NOT NULL DEFAULT now() | Immutable after set |

**Unique:** `(meeting_id, user_id)` — one check-in per person per meeting.

---

### headlines
Good-news / win headlines shared at the start of a meeting.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| meeting_id | uuid | FK → meetings.id NOT NULL | |
| user_id | uuid | FK → users.id NOT NULL | |
| text | text | NOT NULL | |
| created_at | timestamptz | NOT NULL DEFAULT now() | |

---

### vto
Vision/Traction Organizer — the company-level strategic document. One active version at a time; previous versions are retained by incrementing `version`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| version | integer | NOT NULL | Auto-incremented on each save |
| core_values | jsonb | | `string[]` |
| core_focus | jsonb | | `{ purpose: string, niche: string }` |
| bhag | text | | 10-year Big Hairy Audacious Goal |
| marketing_strategy | jsonb | | Target market, uniques, proven process, guarantee |
| three_year_picture | jsonb | | Revenue, profit, measurables, what it looks like |
| one_year_plan | jsonb | | Revenue, profit, measurables, goals `string[]` |
| rocks_q | jsonb | | Current quarter company rocks `string[]` |
| issues_list | jsonb | | Long-term issues parking lot `string[]` |
| updated_by | uuid | FK → users.id | |
| updated_at | timestamptz | NOT NULL DEFAULT now() | |

---

## Status State Machines

### Meeting status
```
scheduled → open → closed
```
- `open`: requires no prior open sessions for the same team on same date
- `closed`: blocked if any linked issue is `open` or `ids_in_progress`

### Issue status
```
open → ids_in_progress → resolved
              ↓
           dropped
```
- `resolved`: requires `resolution_notes` ≥ 50 chars

### Rock status
```
on_track ⇄ off_track → complete
              ↓
           dropped
```
- Every transition writes to `rock_status_history`

### Todo status
```
open → complete
  ↓
dropped
```

## Indexes (planned)

| Table | Index columns | Reason |
|---|---|---|
| meetings | `(team_id, status)` | Filter open meetings by team |
| meetings | `(scheduled_at)` | Date-range queries |
| issues | `(meeting_id, status)` | Meeting close guard check |
| issues | `(owner_id, status)` | Nudge queries |
| rocks | `(owner_id, quarter)` | Rock review segment |
| rocks | `(team_id, quarter, status)` | Team rock dashboard |
| todos | `(owner_id, status, due_date)` | Nudge queries + overdue list |
| rock_status_history | `(rock_id, changed_at)` | History timeline |
