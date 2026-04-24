/**
 * EOS Pulse — Meetings Domain
 *
 * Business logic for L10 and Leadership meeting sessions.
 *
 * Rules enforced here:
 *  - Meeting cannot close while any linked issue is 'open' or 'ids_in_progress'
 *  - Status transitions: scheduled → open → closed (no skipping, no reversing)
 *
 * Imports allowed: db, schema, other domain files
 * Imports forbidden: handlers/, HTTP context, raw fetch()
 */

import { db } from "../db.ts";

// ---------------------------------------------------------------------------
// Types (will be replaced with schema.$inferSelect once schema is uncommented)
// ---------------------------------------------------------------------------

export type MeetingType   = "l10" | "leadership";
export type MeetingStatus = "scheduled" | "open" | "closed";

export interface CreateMeetingInput {
  type:          MeetingType;
  teamId:        string;
  facilitatorId?: string;
  scheduledAt:   string;
  agendaJson?:   unknown;
}

// ---------------------------------------------------------------------------
// Domain functions (stubbed — implement in Step 05)
// ---------------------------------------------------------------------------

export async function listMeetings(_filters: Record<string, unknown>) {
  // TODO: query db.meetings with filters
  void db;
  return { items: [], total: 0 };
}

export async function getMeetingById(_id: string) {
  // TODO: query db.meetings + join issues, todos, checkins, headlines
  return null;
}

export async function createMeeting(_input: CreateMeetingInput) {
  // TODO: insert into meetings
  return null;
}

export async function openMeeting(_id: string) {
  // TODO:
  // 1. Load meeting, verify status === 'scheduled'
  // 2. Set status = 'open', startedAt = now()
  // 3. Return updated meeting
  return null;
}

export async function closeMeeting(_id: string, _notes?: string) {
  // TODO:
  // 1. Load meeting, verify status === 'open'
  // 2. Load linked issues — collect any with status 'open' or 'ids_in_progress'
  // 3. If blocking issues exist → throw MeetingCloseBlockedError({ blockingIssueIds })
  // 4. Set status = 'closed', closedAt = now(), notes = notes
  // 5. Return updated meeting
  return null;
}

export async function updateMeeting(_id: string, _patch: Record<string, unknown>) {
  // TODO: update title, notes, agendaJson, scheduledAt
  return null;
}

export async function deleteMeeting(_id: string) {
  // TODO: verify not 'open', then delete
  return null;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class MeetingCloseBlockedError extends Error {
  constructor(public readonly blockingIssueIds: string[]) {
    super(`Meeting cannot be closed — ${blockingIssueIds.length} issue(s) are still open.`);
    this.name = "MeetingCloseBlockedError";
  }
}

export class MeetingStatusTransitionError extends Error {
  constructor(currentStatus: MeetingStatus, targetStatus: MeetingStatus) {
    super(`Cannot transition meeting from '${currentStatus}' to '${targetStatus}'.`);
    this.name = "MeetingStatusTransitionError";
  }
}
