# Integration — Fathom AI

> Status: **Placeholder** — v2 consideration; not in v1 scope

---

## Relationship

**Fathom and EOS Pulse are complementary, not competing.**

| System | Responsibility |
|---|---|
| **Fathom** | AI transcription, meeting recording, auto-generated summaries |
| **EOS Pulse** | Structured agenda execution, rocks/issues/todos tracking, accountability nudges |

EOS Pulse does **not** replace Fathom. Both run in parallel during meetings.

---

## Potential v2 Integration Points

### 1. Import AI-suggested issues from Fathom summary

Fathom generates a meeting summary with action items. EOS Pulse could:
- Read the Fathom summary via Fathom API after a meeting closes
- Surface AI-detected issues or action items as draft EOS Pulse issues/todos
- User reviews and approves before they are saved

**Value:** Reduce manual logging overhead after IDS discussions.

### 2. Link Fathom recording to EOS Pulse meeting

Store the Fathom meeting recording URL in `meetings.notes` or a dedicated `fathom_recording_url` column. Displayed as a link on the meeting detail page.

**Value:** One-click access to the recording from the meeting record.

### 3. Auto-populate headlines from Fathom

Fathom summarizes wins and highlights. These could pre-populate the Headlines segment.

---

## Fathom API

- Fathom API is not publicly documented as of this writing
- Integration feasibility depends on API availability and access grants
- Contact Fathom support for enterprise API access

---

## Decision: Out of v1 Scope

Fathom integration is deferred because:

1. Fathom API access not confirmed
2. Core EOS workflows (rocks, issues, todos, meetings) must be solid before adding AI overlay
3. MSPBots staff can run effective EOS meetings without this integration
4. Risk of scope creep during initial rollout

Revisit after v1 is live and stable.
