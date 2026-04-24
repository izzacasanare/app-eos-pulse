# EOS Pulse — Product Sense

## What This Is

EOS Pulse is a **standalone internal web application** that replaces ClickUp as the operating layer for all EOS (Entrepreneurial Operating System) meeting workflows at MSPBots.

**Users:** ~30–50 MSPBots internal staff across 6 teams.
**Access:** Internal only. No public-facing routes. No self-registration.

---

## Core Jobs

| Job | Description |
|---|---|
| Run L10 meetings | Structured 90-minute weekly team meetings with timed agenda segments |
| Run Leadership meetings | Quarterly extended sessions for leadership team — VTO review, company rock-setting |
| Track quarterly Rocks | Set, update status, and report on individual/team quarterly goals |
| Log and resolve Issues (IDS) | Structured Identify/Discuss/Solve workflow with enforced resolution documentation |
| Accountability nudges | Automatic Microsoft Teams messages for open rocks, overdue to-dos, upcoming meetings |
| Pre-meeting check-ins | Staff submit scorecards and headlines before the meeting starts |

---

## Non-Negotiables

These rules are **hard constraints** — not configurable, not bypassable by any user role.

| Rule | How enforced |
|---|---|
| IDS items cannot close without resolution notes (≥ 50 characters) | Domain layer returns HTTP 400 before status write |
| A meeting cannot be closed while any of its issues remain open | Domain layer blocks `close` transition; returns HTTP 409 with list of blocking issues |
| Nudges must fire on schedule | Cron job with failure logging and alert; missed nudges are surfaced in admin dashboard |
| Rocks must have an owner | DB NOT NULL + domain validation |
| Rock status changes are permanent audit history | `rock_status_history` is append-only; no updates or deletes |

---

## Meeting Types

### L10 Meeting (Weekly, ~90 min)

Run by each of the 6 teams independently.

| Segment | Default duration |
|---|---|
| Segue / Check-in | 5 min |
| Headlines | 5 min |
| Scorecard review | 5 min |
| Rock review (on-track / off-track) | 5 min |
| Customer / employee headlines | 5 min |
| To-do list review | 5 min |
| IDS (Issues) | 60 min |
| Conclude / Wrap-up | 5 min |

### Leadership Meeting (Quarterly)

For the leadership team only. Extended agenda:
- VTO review and update
- Company rock-setting for the next quarter
- Department-level reporting
- Major company-wide IDS items

---

## What EOS Pulse Is NOT

| Not this | Why it matters |
|---|---|
| **Not a general project manager** | No custom task types, no arbitrary workflows, no Kanban boards. Every data model is EOS-specific. |
| **Not public-facing** | No public signup, no guest access, no external sharing or embed. All routes require a valid MSPBots session. |
| **Not a replacement for Fathom** | Fathom handles AI transcription and meeting summaries. EOS Pulse handles structured agenda execution and post-meeting tracking. They are complementary, not competing. |
| **Not a ClickUp clone** | EOS Pulse is opinionated around EOS methodology only. Removing ClickUp means removing the flexibility ClickUp offered — that is intentional. |
| **Not an HR or billing system** | No time tracking, no payroll, no recruitment pipeline. |

---

## User Roles

| Role | What they can do |
|---|---|
| `admin` | Full access — manage teams, users, VTO, close meetings, delete records |
| `leader` | Run meetings for their team, manage team rocks and issues, view VTO |
| `member` | Attend meetings, submit check-ins, update their own rocks and to-dos, log issues |

---

## Success Metrics (v1)

| Metric | Target |
|---|---|
| Teams running L10s in-app | All 6 teams within 30 days of launch |
| Unresolved issues at meeting close | 0 (enforced by system) |
| Rock completion rate | Measured and visible quarterly |
| Nudge delivery rate | ≥ 99% of scheduled nudges delivered |
| ClickUp dependency for EOS workflows | 0 (replaced entirely) |

---

## Scope Boundary

**EOS Pulse owns:**
- Meeting sessions (L10, Leadership)
- Rocks and Rock status history
- Issues (IDS workflow)
- To-dos (meeting action items)
- Check-ins (scorecard + headlines)
- Nudges (Teams-based accountability)
- VTO (company vision document)

**EOS Pulse does NOT own:**
- Time tracking
- Billing or invoicing
- HR / recruitment
- General project management
- AI transcription (→ Fathom)
- Company scorecard data storage (→ MSPBots Scorecard integration reads, does not own)
