# Integration — Microsoft Teams Nudges

> Status: **Placeholder** — not implemented in v1

---

## Purpose

Deliver accountability nudges to MSPBots staff via Microsoft Teams messages. Nudges are triggered by the EOS Pulse cron scheduler based on conditions in the database (overdue to-dos, stale rocks, upcoming meetings, unsubmitted check-ins).

---

## Delivery Method

**Option A — Incoming Webhook (v1 recommended)**
- Simple, no bot registration required
- One webhook URL per Teams channel or per user (via personal channels)
- Sends Adaptive Cards to a channel; does not DM individuals

**Option B — Teams Bot (v2, for true DMs)**
- Requires registering a bot in Azure AD
- Enables direct messages to individual users via `teams_user_id`
- More setup; deferred to v2

**v1 will use Option A** — nudges delivered to team channels, not individual DMs.

---

## Required Environment Variables

```env
# Webhook URL per team channel (one per team, or a single ops channel for v1)
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/...

# Optional: per-team webhook overrides
TEAMS_WEBHOOK_TEAM_1=https://...
TEAMS_WEBHOOK_TEAM_2=https://...
```

---

## Message Format

Nudges use Teams **Adaptive Cards** for rich formatting.

### Base payload shape

```json
{
  "type": "message",
  "attachments": [{
    "contentType": "application/vnd.microsoft.card.adaptive",
    "content": {
      "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
      "type": "AdaptiveCard",
      "version": "1.4",
      "body": [
        {
          "type": "TextBlock",
          "text": "⚠️ Overdue To-Do",
          "weight": "Bolder",
          "size": "Medium"
        },
        {
          "type": "TextBlock",
          "text": "Hi Jane, your to-do **Update QBR deck** was due on 2025-06-01 and is still open.",
          "wrap": true
        }
      ],
      "actions": [{
        "type": "Action.OpenUrl",
        "title": "View To-Do",
        "url": "https://pulse.mspbots.ai/todos/uuid"
      }]
    }
  }]
}
```

---

## Delivery Implementation

Located in: `service/domain/nudges.domain.ts`

```typescript
async function sendTeamsNudge(webhookUrl: string, card: AdaptiveCard): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card),
  });
  if (!res.ok) {
    throw new Error(`Teams webhook failed: ${res.status} ${await res.text()}`);
  }
}
```

Note: `fetch()` is permitted in `domain/nudges.domain.ts` because this is an **outbound integration call**, not a UI-to-backend call. The `pages/` no-raw-fetch rule only applies to frontend code.

---

## Failure Handling

- Delivery failures are caught, logged to `nudge_logs` with `delivered: false`
- Failures do not throw — nudge job continues to next recipient
- Admin dashboard surfaces delivery failure rate
- No automatic retry in v1

---

## Testing

Use `POST /api/nudges/test` (admin only) to send a test card to the configured webhook and verify it renders correctly in Teams.

---

## Roadmap to v2 (true DMs)

1. Register a Teams App + Bot in Azure AD
2. Store `teams_user_id` for each EOS Pulse user
3. Use Bot Framework API to send proactive messages to individuals
4. Update nudge domain to use Graph API instead of Incoming Webhook
