# Integration — MSPBots Scorecard

> Status: **Placeholder** — design TBD; not in v1 scope

---

## Purpose

The MSPBots Scorecard is the existing system where teams track key metrics (KPIs). During the L10 Scorecard Review segment, facilitators walk through each metric — EOS Pulse should display the current scorecard data without requiring manual re-entry.

---

## What EOS Pulse Needs

During the **Scorecard Review** segment of an L10 meeting:
- Display each team's key metrics for the current week
- Highlight metrics that are off-track (below target)
- Allow facilitators to add issues directly from off-track metrics

---

## Integration Approach

### Option A — Read from MSPBots Scorecard API (preferred)
- EOS Pulse backend fetches scorecard data for the team + date range
- Displayed read-only in the meeting UI
- No data duplication — MSPBots Scorecard remains the source of truth
- Requires: authenticated API access from EOS Pulse backend

### Option B — Manual entry (v1 fallback)
- `checkins.scorecard_data` JSONB field accepts free-form metric values
- Users enter their own numbers before the meeting
- No dependency on Scorecard API
- Data is isolated in EOS Pulse — not synced back

**v1 will use Option B** (manual check-in entry). Option A is the v2 target.

---

## Required for Option A (v2)

```env
MSPBOTS_SCORECARD_API_URL=https://...
MSPBOTS_SCORECARD_API_KEY=...
```

### Fetch shape (TBD)

```typescript
// service/domain/meetings.domain.ts (v2)
async function fetchScorecardForTeam(teamId: string, week: string) {
  const res = await fetch(`${SCORECARD_API_URL}/teams/${teamId}/metrics?week=${week}`, {
    headers: { 'Authorization': `Bearer ${SCORECARD_API_KEY}` },
  });
  return res.json();
}
```

---

## Scorecard Data in Check-ins (v1)

The `checkins.scorecard_data` JSONB field stores key-value pairs:

```json
{
  "newClients":        3,
  "supportTickets":    12,
  "npsScore":          8.4,
  "revenueTarget":     0.92
}
```

Metric keys are not validated at the API layer in v1 — teams define their own metric names.

---

## Decision Log

| Decision | Reason |
|---|---|
| Manual entry for v1 | No confirmed Scorecard API access; avoids blocking EOS Pulse launch |
| JSONB for scorecard data | Flexible — different teams track different metrics; no schema migration per team |
| MSPBots Scorecard remains source of truth | EOS Pulse does not own metric history; avoids duplication |
