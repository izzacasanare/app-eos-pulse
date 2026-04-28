# EOS Pulse — Data Model

> Source of truth: `service/schema.ts`
> All tables live inside PostgreSQL schema `m4mom3q0m8bw2p9w93urcjeb9x2y4dna` (APP_ID).
> Never use the `public` schema.

---

## Connection

| Field    | Value |
|----------|-------|
| Host     | `20.241.40.252` |
| Port     | `15432` |
| Database | `mb_app_agentint` |
| Schema   | `m4mom3q0m8bw2p9w93urcjeb9x2y4dna` |
| User     | `user_m4mom3q0m8bw2p9w93urcjeb9x2y4dna` |
| Password | `pass_m4mom3q0m8bw2p9w93urcjeb9x2y4dna` |

Credentials sourced from `.env` at runtime. See `docs/SECURITY.md`.

---

## Tables

### teams

Represents the 6 MSPBots internal teams.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | `crypto.randomUUID()` |
| name | text | NOT NULL | |
| type | text | NOT NULL | `'l10'` \| `'quarterly'` \| `'both'` |
| created_at | timestamp | NOT NULL DEFAULT now() | |

---

### users

MSPBots staff. Populated from the platform — no self-registration.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| name | text | NOT NULL | |
| email | text | NOT NULL UNIQUE | |
| role | text | NOT NULL | `'super_admin'` \| `'leadership'` \| `'team_lead'` \| `'host'` \| `'member'` |
| team_id | uuid | FK → teams.id | Primary team assignment |
| created_at | timestamp | NOT NULL DEFAULT now() | |

---

### meetings

L10 or quarterly meeting sessions.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| team_id | uuid | NOT NULL FK → teams.id | |
| type | text | NOT NULL | `'l10'` \| `'quarterly'` |
| scheduled_at | timestamp | NOT NULL | |
| host_id | uuid | FK → users.id | |
| status | text | NOT NULL DEFAULT `'upcoming'` | `'upcoming'` \| `'live'` \| `'pending_close'` \| `'closed'` |
| fathom_url | text | nullable | Link to Fathom recording/summary |
| meeting_rating_avg | real | nullable | Average of end-of-meeting ratings |
| summary_sent_at | timestamp | nullable | When post-meeting summary was sent |
| created_at | timestamp | NOT NULL DEFAULT now() | |

---

### checkins

Pre-meeting personal and professional good-news submissions.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| member_id | uuid | NOT NULL FK → users.id | |
| meeting_id | uuid | NOT NULL FK → meetings.id | |
| personal_good_news | text | nullable | |
| professional_good_news | text | nullable | |
| submitted_at | timestamp | NOT NULL DEFAULT now() | Immutable after set |

---

### headlines

Structured headlines submitted during a meeting (wins, news, alerts).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| submitter_id | uuid | NOT NULL FK → users.id | |
| meeting_id | uuid | NOT NULL FK → meetings.id | |
| category | text | NOT NULL | `'absence'` \| `'headcount'` \| `'closed_won'` \| `'cancellation'` \| `'general'` |
| content | text | NOT NULL | |
| escalated_to_ids | boolean | NOT NULL DEFAULT false | Whether escalated to IDS queue |
| submitted_at | timestamp | NOT NULL DEFAULT now() | |

---

### rocks

Quarterly goals assigned at company, department, or individual level.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| title | text | NOT NULL | |
| team_id | uuid | NOT NULL FK → teams.id | |
| level | text | NOT NULL | `'company'` \| `'dept'` \| `'individual'` |
| owner_id | uuid | NOT NULL FK → users.id | |
| quarter | integer | NOT NULL | 1–4 |
| year | integer | NOT NULL | e.g. 2025 |
| parent_rock_id | uuid | nullable self-ref FK → rocks.id | For dept/individual rocks under a company rock |
| status | text | NOT NULL DEFAULT `'on_track'` | `'on_track'` \| `'off_track'` \| `'at_risk'` \| `'blocked'` \| `'on_hold'` \| `'completed'` |
| clickup_task_id | text | nullable | For ClickUp migration reference |
| created_at | timestamp | NOT NULL DEFAULT now() | |
| updated_at | timestamp | NOT NULL DEFAULT now() | |

---

### rock_status_history

Append-only audit log of every rock status change.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| rock_id | uuid | NOT NULL FK → rocks.id | |
| meeting_id | uuid | nullable FK → meetings.id | Meeting in which status was updated |
| status | text | NOT NULL | The new status value |
| comment | text | nullable | Context for the change |
| changed_by_id | uuid | NOT NULL FK → users.id | |
| changed_at | timestamp | NOT NULL DEFAULT now() | |

**Constraint:** INSERT only — no UPDATE or DELETE ever permitted.

---

### issues

IDS items raised within or outside a meeting. Supports escalation to leadership.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| title | text | NOT NULL | |
| description | text | nullable | |
| submitter_id | uuid | NOT NULL FK → users.id | |
| source_team_id | uuid | NOT NULL FK → teams.id | Team that raised the issue |
| target_dept_id | uuid | NOT NULL FK → teams.id | Department responsible for resolution |
| priority | text | NOT NULL DEFAULT `'medium'` | `'low'` \| `'medium'` \| `'high'` \| `'critical'` |
| status | text | NOT NULL DEFAULT `'open'` | `'open'` \| `'assigned'` \| `'in_progress'` \| `'pending_closure'` \| `'closed'` |
| assigned_to_id | uuid | nullable FK → users.id | |
| meeting_id | uuid | nullable FK → meetings.id | Meeting in which issue was raised |
| escalate_to_leadership | boolean | NOT NULL DEFAULT false | Flagged for leadership review |
| resolution_notes | text | nullable | Required (≥ 50 chars) before status → `'closed'` |
| sop_link | text | nullable | Link to SOP if resolution created one |
| is_fathom_source | boolean | NOT NULL DEFAULT false | True if auto-detected from Fathom summary |
| clickup_task_id | text | nullable | ClickUp migration reference |
| created_at | timestamp | NOT NULL DEFAULT now() | |
| updated_at | timestamp | NOT NULL DEFAULT now() | |

**Business rule:** `resolution_notes` ≥ 50 characters enforced at domain layer before status → `'closed'`.

---

### todos

Action items created in meetings or standalone. Supports carry-over tracking.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| title | text | NOT NULL | |
| assigned_to_id | uuid | NOT NULL FK → users.id | |
| team_id | uuid | NOT NULL FK → teams.id | |
| meeting_id | uuid | nullable FK → meetings.id | Meeting in which to-do was created |
| due_date | date | nullable | |
| status | text | NOT NULL DEFAULT `'open'` | `'open'` \| `'done'` \| `'blocked'` \| `'carried'` |
| carry_over_reason | text | nullable | Required when status → `'carried'` |
| linked_rock_id | uuid | nullable FK → rocks.id | Rock this to-do supports |
| acknowledged_at | timestamp | nullable | When owner acknowledged the to-do |
| clickup_task_id | text | nullable | ClickUp migration reference |
| created_at | timestamp | NOT NULL DEFAULT now() | |
| updated_at | timestamp | NOT NULL DEFAULT now() | |

---

### vto

Vision/Traction Organizer — company-level strategic document. Versioned; prior versions retained.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| version | integer | NOT NULL DEFAULT 1 | Incremented on each save |
| core_values | jsonb | nullable | `string[]` |
| core_focus | jsonb | nullable | `{ purpose: string, niche: string }` |
| ten_year_target | text | nullable | Big Hairy Audacious Goal |
| three_year_picture | jsonb | nullable | Revenue, profit, measurables |
| one_year_plan | jsonb | nullable | Goals, revenue, profit targets |
| marketing_strategy | jsonb | nullable | Target market, guarantees, etc. |
| three_uniques | jsonb | nullable | `string[]` — the 3 competitive differentiators |
| proven_process | jsonb | nullable | Steps of the MSPBots delivery process |
| last_reviewed_at | timestamp | nullable | |
| reviewed_by_id | uuid | nullable FK → users.id | |
| leadership_session_id | uuid | nullable FK → meetings.id | Quarterly meeting where reviewed |
| created_at | timestamp | NOT NULL DEFAULT now() | |

---

## Status State Machines

### Meeting
```
upcoming → live → pending_close → closed
```

### Rock
```
on_track ⇄ off_track ⇄ at_risk ⇄ blocked ⇄ on_hold → completed
```
Every transition appends a row to `rock_status_history`.

### Issue
```
open → assigned → in_progress → pending_closure → closed
                                                 ↑
                          resolution_notes ≥ 50 chars required
```

### Todo
```
open → done
open → blocked
open → carried  (requires carry_over_reason)
```

---

## Key Constraints Summary

| Rule | Enforcement |
|------|-------------|
| `issues.resolution_notes` ≥ 50 chars before `'closed'` | Domain layer — HTTP 400 if violated |
| `rock_status_history` is append-only | No UPDATE/DELETE in any domain function |
| All tables in `pgSchema(APP_ID)` | Defined in `schema.ts`; never `public` |
| `todos.carry_over_reason` required when `status = 'carried'` | Domain layer validation |
| `meetings` cannot close with open issues | Domain layer guard — HTTP 409 with blocking IDs |

---

## Planned Indexes

| Table | Columns | Reason |
|-------|---------|--------|
| meetings | `(team_id, status)` | Filter open/live meetings by team |
| meetings | `(scheduled_at)` | Date-range queries |
| issues | `(meeting_id, status)` | Meeting close guard |
| issues | `(assigned_to_id, status)` | Nudge queries |
| rocks | `(owner_id, quarter, year)` | Rock review segment |
| rocks | `(team_id, quarter, year, status)` | Team rock dashboard |
| todos | `(assigned_to_id, status, due_date)` | Nudge + overdue queries |
| rock_status_history | `(rock_id, changed_at)` | History timeline |
