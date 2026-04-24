/**
 * EOS Pulse — Nudges Domain
 *
 * Scheduled accountability nudges delivered via Microsoft Teams.
 *
 * This domain is cron-driven — it has NO HTTP handler.
 * It may use fetch() for outbound Teams webhook calls (not a UI→backend call).
 *
 * Schedule (see docs/api-contracts/nudges.md):
 *  - rock_status_due:  Every Monday 9:00 AM
 *  - todo_overdue:     Daily 9:00 AM
 *  - meeting_reminder: 1 hour before meeting
 *  - checkin_reminder: 30 min before meeting
 *  - ids_unresolved:   Every Thursday 9:00 AM
 *
 * Imports allowed: db, schema, todos.domain, rocks.domain, meetings.domain
 * Imports forbidden: handlers/
 */

import { db } from "../db.ts";
import { listOverdueTodos } from "./todos.domain.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NudgeType =
  | "rock_status_due"
  | "todo_overdue"
  | "meeting_reminder"
  | "checkin_reminder"
  | "ids_unresolved";

export interface NudgeResult {
  type:       NudgeType;
  userId:     string;
  resourceId: string;
  delivered:  boolean;
  error?:     string;
}

// ---------------------------------------------------------------------------
// Teams delivery (stubbed — implement in Step 07/08)
// ---------------------------------------------------------------------------

async function sendTeamsMessage(_webhookUrl: string, _card: unknown): Promise<void> {
  // TODO:
  // const res = await fetch(webhookUrl, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(card),
  // });
  // if (!res.ok) throw new Error(`Teams webhook failed: ${res.status}`);
}

// ---------------------------------------------------------------------------
// Nudge runners (stubbed — implement in Step 07/08)
// ---------------------------------------------------------------------------

export async function runOverdueTodoNudges(): Promise<NudgeResult[]> {
  // TODO:
  // 1. Call listOverdueTodos() from todos.domain
  // 2. For each overdue todo, build Teams Adaptive Card
  // 3. sendTeamsMessage(TEAMS_WEBHOOK_URL, card)
  // 4. Log result to nudge_logs table
  void db;
  const overdue = await listOverdueTodos();
  void overdue;
  return [];
}

export async function runRockStatusNudges(): Promise<NudgeResult[]> {
  // TODO:
  // 1. Query rocks not updated in 7+ days (join rock_status_history)
  // 2. Build and send Teams card per owner
  // 3. Log results
  return [];
}

export async function runMeetingReminders(): Promise<NudgeResult[]> {
  // TODO:
  // 1. Query meetings starting in ~1 hour with status 'scheduled' or 'open'
  // 2. Send reminder cards to team members
  return [];
}

export async function runCheckinReminders(): Promise<NudgeResult[]> {
  // TODO:
  // 1. Query meetings starting in ~30 min
  // 2. Find team members who haven't submitted a check-in
  // 3. Send reminder cards
  return [];
}

export async function runUnresolvedIssueNudges(): Promise<NudgeResult[]> {
  // TODO:
  // 1. Query issues with status 'open' for 5+ days
  // 2. Send nudge to issue owner
  return [];
}

export async function previewPendingNudges(): Promise<unknown[]> {
  // TODO: return what would fire without sending — used by GET /api/nudges/preview
  return [];
}

export async function sendTestNudge(_userId: string, _type: NudgeType): Promise<NudgeResult> {
  // TODO: send a test card to the user's Teams channel
  void sendTeamsMessage;
  return { type: _type, userId: _userId, resourceId: "test", delivered: false, error: "Not implemented" };
}
