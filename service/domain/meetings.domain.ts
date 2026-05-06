/**
 * EOS Pulse — Meetings Domain
 *
 * Business logic for L10 and Leadership meeting sessions.
 *
 * Rules enforced here:
 *  - Status transitions: upcoming → live → pending_close → closed (no skip, no reverse)
 *  - Meeting cannot close while linked issues are open / assigned / in_progress
 *  - autoCreateWeeklySession carries open todos forward and marks originals as 'carried'
 *
 * Imports allowed: db, schema, other domain files
 * Imports forbidden: handlers/, HTTP context, raw fetch()
 */

import { and, asc, desc, eq, gte, inArray, isNull, lte, ne } from "drizzle-orm";
import { db } from "../db.ts";
import { issues, meetingSegments, meetings, todos, users } from "../schema.ts";
import type { Issue, Meeting, MeetingSegment, Todo, User } from "../schema.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MeetingType   = "l10" | "quarterly";
export type MeetingStatus = "upcoming" | "live" | "pending_close" | "closed";

export const SESSION_SEGMENTS = [
  "check_in",
  "rock_review",
  "scorecard_review",
  "headlines",
  "todo_review",
  "ids",
  "wrap_up",
] as const;

export type SessionSegment = typeof SESSION_SEGMENTS[number];

export interface CreateMeetingInput {
  teamId:      string;
  type:        MeetingType;
  scheduledAt: string | Date;
  hostId?:     string;
}

export interface UpdateMeetingPatch {
  scheduledAt?: string | Date;
  hostId?:      string | null;
  fathomUrl?:   string | null;
  meetingRatingAvg?: number | null;
}

const STATUS_TRANSITIONS: Record<MeetingStatus, MeetingStatus[]> = {
  upcoming:      ["live"],
  live:          ["pending_close"],
  pending_close: ["closed"],
  closed:        [],
};

// Issues in these states block meeting closure
const BLOCKING_ISSUE_STATUSES = ["open", "assigned", "in_progress"] as const;

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function fetchMeeting(id: string): Promise<Meeting | null> {
  const [row] = await db.select().from(meetings).where(eq(meetings.id, id));
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Domain functions
// ---------------------------------------------------------------------------

export interface MeetingFilters {
  teamId?: string;
  status?: string;
  type?:   string;
  from?:   string;
  to?:     string;
}

export async function listMeetings(
  filters: MeetingFilters,
): Promise<{ items: Meeting[]; total: number }> {
  const conds = [
    filters.teamId ? eq(meetings.teamId, filters.teamId)                  : undefined,
    filters.status ? eq(meetings.status, filters.status)                  : undefined,
    filters.type   ? eq(meetings.type,   filters.type)                    : undefined,
    filters.from   ? gte(meetings.scheduledAt, new Date(filters.from))    : undefined,
    filters.to     ? lte(meetings.scheduledAt, new Date(filters.to))      : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);

  const items = await db
    .select()
    .from(meetings)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(desc(meetings.scheduledAt));

  return { items, total: items.length };
}

export async function getMeetingsByTeam(teamId: string): Promise<Meeting[]> {
  return db
    .select()
    .from(meetings)
    .where(eq(meetings.teamId, teamId))
    .orderBy(desc(meetings.scheduledAt));
}

export async function getMeetingById(id: string): Promise<{
  meeting: Meeting;
  todos:   Todo[];
  issues:  Issue[];
} | null> {
  const meeting = await fetchMeeting(id);
  if (!meeting) return null;

  const [meetingTodos, meetingIssues] = await Promise.all([
    db.select().from(todos).where(eq(todos.meetingId, id)),
    db.select().from(issues).where(eq(issues.meetingId, id)),
  ]);

  return { meeting, todos: meetingTodos, issues: meetingIssues };
}

export async function createMeeting(input: CreateMeetingInput): Promise<Meeting> {
  const [row] = await db
    .insert(meetings)
    .values({
      teamId:      input.teamId,
      type:        input.type,
      scheduledAt: new Date(input.scheduledAt),
      hostId:      input.hostId ?? null,
      status:      "upcoming",
    })
    .returning();
  return row;
}

export async function updateMeetingStatus(
  id: string,
  newStatus: MeetingStatus,
): Promise<Meeting> {
  const meeting = await fetchMeeting(id);
  if (!meeting) throw new MeetingNotFoundError(id);

  const allowed = STATUS_TRANSITIONS[meeting.status as MeetingStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new MeetingStatusTransitionError(
      meeting.status as MeetingStatus,
      newStatus,
    );
  }

  if (newStatus === "closed") {
    const blocking = await db
      .select({ id: issues.id })
      .from(issues)
      .where(
        and(
          eq(issues.meetingId, id),
          inArray(issues.status, [...BLOCKING_ISSUE_STATUSES]),
        ),
      );
    if (blocking.length > 0) {
      throw new MeetingCloseBlockedError(blocking.map((i) => i.id));
    }
  }

  const [updated] = await db
    .update(meetings)
    .set({ status: newStatus })
    .where(eq(meetings.id, id))
    .returning();
  return updated;
}

/** Shorthand: upcoming → live (no carry-over logic). */
export async function openMeeting(id: string): Promise<Meeting> {
  return updateMeetingStatus(id, "live");
}

/**
 * Opens a meeting session (upcoming → live) and auto-populates carry-over
 * todos from the previous closed session for the same team.
 */
export async function openMeetingSession(id: string): Promise<{
  meeting:        Meeting;
  carryOverTodos: Todo[];
  openIssues:     Issue[];
}> {
  const meeting = await fetchMeeting(id);
  if (!meeting) throw new MeetingNotFoundError(id);

  if (meeting.status !== "upcoming") {
    throw new MeetingStatusTransitionError(
      meeting.status as MeetingStatus,
      "live",
    );
  }

  // Find the most recent closed session for this team before this one
  const [prevMeeting] = await db
    .select()
    .from(meetings)
    .where(
      and(
        eq(meetings.teamId, meeting.teamId),
        eq(meetings.status, "closed"),
        lte(meetings.scheduledAt, meeting.scheduledAt),
      ),
    )
    .orderBy(desc(meetings.scheduledAt))
    .limit(1);

  // Carry forward open todos from the previous session
  const carryOverTodos: Todo[] = [];
  if (prevMeeting) {
    const prevOpenTodos = await db
      .select()
      .from(todos)
      .where(
        and(eq(todos.meetingId, prevMeeting.id), eq(todos.status, "open")),
      );

    for (const todo of prevOpenTodos) {
      await db
        .update(todos)
        .set({
          status:          "carried",
          carryOverReason: `Carried to session ${id}`,
          updatedAt:       new Date(),
        })
        .where(eq(todos.id, todo.id));

      const [newTodo] = await db
        .insert(todos)
        .values({
          title:        todo.title,
          assignedToId: todo.assignedToId,
          teamId:       todo.teamId,
          meetingId:    id,
          dueDate:      todo.dueDate,
          status:       "open",
          linkedRockId: todo.linkedRockId,
        })
        .returning();
      carryOverTodos.push(newTodo);
    }
  }

  // Collect open team issues to surface in the session
  const openIssues = await db
    .select()
    .from(issues)
    .where(
      and(
        eq(issues.sourceTeamId, meeting.teamId),
        inArray(issues.status, [...BLOCKING_ISSUE_STATUSES]),
      ),
    );

  // Transition meeting to live
  const [updatedMeeting] = await db
    .update(meetings)
    .set({ status: "live" })
    .where(eq(meetings.id, id))
    .returning();

  return { meeting: updatedMeeting, carryOverTodos, openIssues };
}

/** Closes a meeting. Throws MeetingCloseBlockedError if blocking issues exist. */
export async function closeMeeting(id: string): Promise<Meeting> {
  return updateMeetingStatus(id, "closed");
}

export async function updateMeeting(
  id: string,
  patch: UpdateMeetingPatch,
): Promise<Meeting> {
  const meeting = await fetchMeeting(id);
  if (!meeting) throw new MeetingNotFoundError(id);

  const set: Record<string, unknown> = {};
  if (patch.scheduledAt    !== undefined) set.scheduledAt    = new Date(patch.scheduledAt);
  if (patch.hostId         !== undefined) set.hostId         = patch.hostId;
  if (patch.fathomUrl      !== undefined) set.fathomUrl      = patch.fathomUrl;
  if (patch.meetingRatingAvg !== undefined) set.meetingRatingAvg = patch.meetingRatingAvg;

  if (Object.keys(set).length === 0) return meeting;

  const [updated] = await db
    .update(meetings)
    .set(set)
    .where(eq(meetings.id, id))
    .returning();
  return updated;
}

export async function deleteMeeting(id: string): Promise<void> {
  const meeting = await fetchMeeting(id);
  if (!meeting) throw new MeetingNotFoundError(id);
  if (meeting.status === "live") {
    throw new Error("Cannot delete a live meeting.");
  }
  await db.delete(meetings).where(eq(meetings.id, id));
}

export async function getUpcomingMeetings(): Promise<Meeting[]> {
  return db
    .select()
    .from(meetings)
    .where(eq(meetings.status, "upcoming"))
    .orderBy(asc(meetings.scheduledAt));
}

export async function getCurrentHost(teamId: string): Promise<User | null> {
  // Return the host of the next upcoming/live meeting, or the last closed meeting
  const [meeting] = await db
    .select()
    .from(meetings)
    .where(
      and(
        eq(meetings.teamId, teamId),
        inArray(meetings.status, ["upcoming", "live"]),
      ),
    )
    .orderBy(asc(meetings.scheduledAt))
    .limit(1);

  const hostId = meeting?.hostId;
  if (!hostId) return null;

  const [host] = await db.select().from(users).where(eq(users.id, hostId));
  return host ?? null;
}

/**
 * Creates the next weekly session for a team (scheduled 7 days after the last
 * session). Carries open todos from the last session to the new one.
 */
export async function autoCreateWeeklySession(teamId: string): Promise<{
  meeting:        Meeting;
  carryOverTodos: Todo[];
  openIssues:     Issue[];
}> {
  const [lastMeeting] = await db
    .select()
    .from(meetings)
    .where(eq(meetings.teamId, teamId))
    .orderBy(desc(meetings.scheduledAt))
    .limit(1);

  const baseDate = lastMeeting ? new Date(lastMeeting.scheduledAt) : new Date();
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + 7);

  const prevOpenTodos = lastMeeting
    ? await db
        .select()
        .from(todos)
        .where(
          and(eq(todos.meetingId, lastMeeting.id), eq(todos.status, "open")),
        )
    : [];

  const openIssues = await db
    .select()
    .from(issues)
    .where(
      and(
        eq(issues.sourceTeamId, teamId),
        inArray(issues.status, [...BLOCKING_ISSUE_STATUSES]),
      ),
    );

  const [newMeeting] = await db
    .insert(meetings)
    .values({
      teamId,
      type:        (lastMeeting?.type as MeetingType) ?? "l10",
      scheduledAt: nextDate,
      hostId:      lastMeeting?.hostId ?? null,
      status:      "upcoming",
    })
    .returning();

  const carryOverTodos: Todo[] = [];
  for (const todo of prevOpenTodos) {
    await db
      .update(todos)
      .set({
        status:          "carried",
        carryOverReason: `Auto-carried to session ${newMeeting.id}`,
        updatedAt:       new Date(),
      })
      .where(eq(todos.id, todo.id));

    const [newTodo] = await db
      .insert(todos)
      .values({
        title:        todo.title,
        assignedToId: todo.assignedToId,
        teamId:       todo.teamId,
        meetingId:    newMeeting.id,
        dueDate:      todo.dueDate,
        status:       "open",
        linkedRockId: todo.linkedRockId,
      })
      .returning();
    carryOverTodos.push(newTodo);
  }

  return { meeting: newMeeting, carryOverTodos, openIssues };
}

/**
 * Returns the host-prep checklist for a meeting:
 *  - open todos from the previous session (to carry over)
 *  - open issues for the team
 */
export async function getHostPrep(meetingId: string): Promise<{
  meeting:        Meeting;
  carryOverTodos: Todo[];
  openIssues:     Issue[];
} | null> {
  const meeting = await fetchMeeting(meetingId);
  if (!meeting) return null;

  const [prevMeeting] = await db
    .select()
    .from(meetings)
    .where(
      and(
        eq(meetings.teamId, meeting.teamId),
        eq(meetings.status, "closed"),
        lte(meetings.scheduledAt, meeting.scheduledAt),
      ),
    )
    .orderBy(desc(meetings.scheduledAt))
    .limit(1);

  const carryOverTodos = prevMeeting
    ? await db
        .select()
        .from(todos)
        .where(
          and(eq(todos.meetingId, prevMeeting.id), eq(todos.status, "open")),
        )
    : [];

  const openIssues = await db
    .select()
    .from(issues)
    .where(
      and(
        eq(issues.sourceTeamId, meeting.teamId),
        inArray(issues.status, [...BLOCKING_ISSUE_STATUSES]),
      ),
    );

  return { meeting, carryOverTodos, openIssues };
}

// ---------------------------------------------------------------------------
// Live session — open / advance segment / gated close
// ---------------------------------------------------------------------------

export interface OpenLiveSessionResult {
  meeting: Meeting;
  segment: MeetingSegment;
}

/**
 * Transitions an upcoming meeting to 'live', stamps started_at, and opens
 * the first segment (check_in). Idempotent: returns the existing live state
 * if the meeting is already live.
 */
export async function openLiveSession(
  meetingId: string,
): Promise<OpenLiveSessionResult> {
  const meeting = await fetchMeeting(meetingId);
  if (!meeting) throw new MeetingNotFoundError(meetingId);

  if (meeting.status === "live") {
    const [existing] = await db
      .select()
      .from(meetingSegments)
      .where(
        and(
          eq(meetingSegments.meetingId, meetingId),
          isNull(meetingSegments.endedAt),
        ),
      )
      .orderBy(desc(meetingSegments.startedAt))
      .limit(1);
    if (existing) return { meeting, segment: existing };
  }

  if (meeting.status !== "upcoming" && meeting.status !== "live") {
    throw new MeetingStatusTransitionError(
      meeting.status as MeetingStatus,
      "live",
    );
  }

  const now = new Date();

  const [updatedMeeting] = await db
    .update(meetings)
    .set({ status: "live", startedAt: meeting.startedAt ?? now })
    .where(eq(meetings.id, meetingId))
    .returning();

  const [segment] = await db
    .insert(meetingSegments)
    .values({
      meetingId,
      segmentName: SESSION_SEGMENTS[0],
      startedAt:   now,
    })
    .returning();

  return { meeting: updatedMeeting, segment };
}

/**
 * Advance to a new segment. Closes the current open segment (sets ended_at)
 * and inserts a new row in meeting_segments.
 */
export async function advanceSegment(
  meetingId: string,
  segment:   SessionSegment,
): Promise<MeetingSegment> {
  if (!SESSION_SEGMENTS.includes(segment)) {
    throw new InvalidSegmentError(segment);
  }

  const meeting = await fetchMeeting(meetingId);
  if (!meeting) throw new MeetingNotFoundError(meetingId);
  if (meeting.status !== "live") {
    throw new MeetingNotLiveError(meetingId);
  }

  const now = new Date();

  await db
    .update(meetingSegments)
    .set({ endedAt: now })
    .where(
      and(
        eq(meetingSegments.meetingId, meetingId),
        isNull(meetingSegments.endedAt),
      ),
    );

  const [row] = await db
    .insert(meetingSegments)
    .values({
      meetingId,
      segmentName: segment,
      startedAt:   now,
    })
    .returning();

  return row;
}

export async function getMeetingSegments(
  meetingId: string,
): Promise<MeetingSegment[]> {
  return db
    .select()
    .from(meetingSegments)
    .where(eq(meetingSegments.meetingId, meetingId))
    .orderBy(asc(meetingSegments.startedAt));
}

export type CloseGateReason =
  | "OPEN_IDS_ITEMS"
  | "TODOS_MISSING_FIELDS"
  | "TODOS_NOT_ACKNOWLEDGED";

export interface CloseGateFailure {
  reason:      CloseGateReason;
  blockingIds: string[];
  message:     string;
}

/**
 * Validate gate conditions and transition live → pending_close.
 *
 * Gates:
 *  1. Zero open IDS items (issues with status !== 'closed') for this meeting
 *  2. Every todo for this meeting has an assignee and a due date
 *  3. Every todo for this meeting has been acknowledged or flagged
 *
 * Throws SessionCloseGateError on the first failing gate.
 */
export async function closeLiveSession(meetingId: string): Promise<Meeting> {
  const meeting = await fetchMeeting(meetingId);
  if (!meeting) throw new MeetingNotFoundError(meetingId);
  if (meeting.status !== "live") {
    throw new MeetingStatusTransitionError(
      meeting.status as MeetingStatus,
      "pending_close",
    );
  }

  // Gate 1: open IDS items
  const openIds = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.meetingId, meetingId), ne(issues.status, "closed")));
  if (openIds.length > 0) {
    throw new SessionCloseGateError({
      reason:      "OPEN_IDS_ITEMS",
      blockingIds: openIds.map((i) => i.id),
      message: `${openIds.length} IDS item(s) are still open. Resolve or close them before ending the session.`,
    });
  }

  // Gate 2: todos with missing fields
  const meetingTodos = await db
    .select()
    .from(todos)
    .where(eq(todos.meetingId, meetingId));

  const missingFields = meetingTodos.filter(
    (t) => !t.assignedToId || !t.dueDate,
  );
  if (missingFields.length > 0) {
    throw new SessionCloseGateError({
      reason:      "TODOS_MISSING_FIELDS",
      blockingIds: missingFields.map((t) => t.id),
      message: `${missingFields.length} to-do(s) are missing an assignee or due date.`,
    });
  }

  // Gate 3: new todos must be acknowledged or flagged
  const unhandled = meetingTodos.filter(
    (t) =>
      t.acknowledgedAt === null &&
      (t.carryOverReason === null || t.carryOverReason.trim() === ""),
  );
  if (unhandled.length > 0) {
    throw new SessionCloseGateError({
      reason:      "TODOS_NOT_ACKNOWLEDGED",
      blockingIds: unhandled.map((t) => t.id),
      message: `${unhandled.length} to-do(s) have not been acknowledged or flagged.`,
    });
  }

  await db
    .update(meetingSegments)
    .set({ endedAt: new Date() })
    .where(
      and(
        eq(meetingSegments.meetingId, meetingId),
        isNull(meetingSegments.endedAt),
      ),
    );

  const [updated] = await db
    .update(meetings)
    .set({ status: "pending_close" })
    .where(eq(meetings.id, meetingId))
    .returning();
  return updated;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class MeetingNotFoundError extends Error {
  constructor(id: string) {
    super(`Meeting '${id}' not found.`);
    this.name = "MeetingNotFoundError";
  }
}

export class MeetingCloseBlockedError extends Error {
  constructor(public readonly blockingIssueIds: string[]) {
    super(
      `Meeting cannot be closed — ${blockingIssueIds.length} issue(s) are still open.`,
    );
    this.name = "MeetingCloseBlockedError";
  }
}

export class MeetingStatusTransitionError extends Error {
  constructor(
    public readonly currentStatus: MeetingStatus,
    public readonly targetStatus: MeetingStatus,
  ) {
    super(
      `Cannot transition meeting from '${currentStatus}' to '${targetStatus}'.`,
    );
    this.name = "MeetingStatusTransitionError";
  }
}

export class MeetingNotLiveError extends Error {
  constructor(id: string) {
    super(`Meeting '${id}' is not live.`);
    this.name = "MeetingNotLiveError";
  }
}

export class InvalidSegmentError extends Error {
  constructor(segment: string) {
    super(
      `Invalid segment '${segment}'. Allowed: ${SESSION_SEGMENTS.join(", ")}.`,
    );
    this.name = "InvalidSegmentError";
  }
}

export class SessionCloseGateError extends Error {
  constructor(public readonly failure: CloseGateFailure) {
    super(failure.message);
    this.name = "SessionCloseGateError";
  }
}
