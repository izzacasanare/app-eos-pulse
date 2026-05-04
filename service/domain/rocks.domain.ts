/**
 * EOS Pulse — Rocks Domain
 *
 * Business logic for quarterly Rocks and status history.
 *
 * Rules enforced here:
 *  - Every status change appends a row to rock_status_history (append-only)
 *  - ownerId is required
 *  - quarter must match Q[1-4]-YYYY format
 *  - Pre-meeting status updates of `off_track` or `blocked` require a comment
 *
 * Imports allowed: db, schema, other domain files
 * Imports forbidden: handlers/, HTTP context, raw fetch()
 */

import { asc, eq } from "drizzle-orm";
import { db } from "../db.ts";
import { meetings, rocks, rockStatusHistory } from "../schema.ts";
import type { Rock, RockStatusHistory } from "../schema.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RockStatus =
  | "on_track"
  | "off_track"
  | "at_risk"
  | "blocked"
  | "on_hold"
  | "completed";

export const ROCK_STATUSES: readonly RockStatus[] = [
  "on_track",
  "off_track",
  "at_risk",
  "blocked",
  "on_hold",
  "completed",
] as const;

/** Statuses that demand a written comment when set. */
export const STATUSES_REQUIRING_COMMENT: readonly RockStatus[] = [
  "off_track",
  "blocked",
] as const;

export const QUARTER_PATTERN = /^Q[1-4]-\d{4}$/;

export interface CreateRockInput {
  ownerId:      string;
  teamId:       string;
  title:        string;
  description?: string;
  quarter:      string;   // e.g. 'Q2-2025'
  dueDate:      string;   // 'YYYY-MM-DD'
}

export interface UpdateRockStatusInput {
  status:     RockStatus;
  comment?:   string;
  meetingId?: string;
  userId:     string;
}

export interface MeetingRockStatus {
  rock:           Rock;
  preSubmitted:   boolean;
  latestEntry:    RockStatusHistory | null;
}

// ---------------------------------------------------------------------------
// Domain functions
// ---------------------------------------------------------------------------

export async function listRocks(_filters: Record<string, unknown>) {
  // TODO: query db.rocks with filters
  void db;
  return { items: [], total: 0 };
}

export async function getRockById(id: string): Promise<Rock | null> {
  const [row] = await db.select().from(rocks).where(eq(rocks.id, id));
  return row ?? null;
}

export async function getRockHistory(rockId: string): Promise<RockStatusHistory[]> {
  return db
    .select()
    .from(rockStatusHistory)
    .where(eq(rockStatusHistory.rockId, rockId))
    .orderBy(asc(rockStatusHistory.changedAt));
}

export async function createRock(_input: CreateRockInput) {
  // TODO:
  // 1. Validate quarter matches QUARTER_PATTERN
  // 2. Insert into rocks with status = 'on_track'
  return null;
}

export async function updateRock(_id: string, _patch: Record<string, unknown>) {
  // TODO: update title, description, dueDate — never status
  return null;
}

/**
 * Update a rock's status and append an entry to rock_status_history.
 *
 * RULE: when status is `off_track` or `blocked`, a non-empty comment is required.
 * The CommentRequiredError is mapped to HTTP 400 by the handler.
 */
export async function updateRockStatus(
  rockId: string,
  input:  UpdateRockStatusInput,
): Promise<{ rock: Rock; historyEntry: RockStatusHistory }> {
  if (!ROCK_STATUSES.includes(input.status)) {
    throw new InvalidRockStatusError(input.status);
  }

  const trimmed = input.comment?.trim();
  if (STATUSES_REQUIRING_COMMENT.includes(input.status) && !trimmed) {
    throw new CommentRequiredError(input.status);
  }

  const rock = await getRockById(rockId);
  if (!rock) throw new RockNotFoundError(rockId);

  const [updatedRock] = await db
    .update(rocks)
    .set({ status: input.status, updatedAt: new Date() })
    .where(eq(rocks.id, rockId))
    .returning();

  const [historyEntry] = await db
    .insert(rockStatusHistory)
    .values({
      rockId,
      meetingId:   input.meetingId ?? null,
      status:      input.status,
      comment:     trimmed ?? null,
      changedById: input.userId,
    })
    .returning();

  return { rock: updatedRock, historyEntry };
}

/**
 * Returns every rock for the meeting's team, paired with the most recent
 * status-history entry that references this meeting (the "pre-submitted"
 * status). Rocks without a meeting-scoped history row return preSubmitted=false.
 */
export async function getMeetingRockStatuses(
  meetingId: string,
): Promise<MeetingRockStatus[]> {
  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId));
  if (!meeting) throw new MeetingNotFoundError(meetingId);

  const teamRocks = await db
    .select()
    .from(rocks)
    .where(eq(rocks.teamId, meeting.teamId));

  const meetingHistory = await db
    .select()
    .from(rockStatusHistory)
    .where(eq(rockStatusHistory.meetingId, meetingId));

  const latestByRock = new Map<string, RockStatusHistory>();
  for (const entry of meetingHistory) {
    const prev = latestByRock.get(entry.rockId);
    if (!prev || prev.changedAt < entry.changedAt) {
      latestByRock.set(entry.rockId, entry);
    }
  }

  return teamRocks.map((rock) => {
    const latest = latestByRock.get(rock.id) ?? null;
    return {
      rock,
      preSubmitted: latest !== null,
      latestEntry:  latest,
    };
  });
}

export async function deleteRock(_id: string) {
  // TODO: admin only, cannot delete if history entries exist
  return null;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class InvalidQuarterFormatError extends Error {
  constructor(quarter: string) {
    super(`Invalid quarter format: '${quarter}'. Expected Q[1-4]-YYYY (e.g. Q2-2025).`);
    this.name = "InvalidQuarterFormatError";
  }
}

export class RockHasHistoryError extends Error {
  constructor() {
    super("Cannot hard-delete a rock with status history. Use 'on_hold' status instead.");
    this.name = "RockHasHistoryError";
  }
}

export class RockNotFoundError extends Error {
  constructor(id: string) {
    super(`Rock '${id}' not found.`);
    this.name = "RockNotFoundError";
  }
}

export class InvalidRockStatusError extends Error {
  constructor(status: string) {
    super(
      `Invalid rock status '${status}'. Allowed: ${ROCK_STATUSES.join(", ")}.`,
    );
    this.name = "InvalidRockStatusError";
  }
}

export class CommentRequiredError extends Error {
  constructor(public readonly status: RockStatus) {
    super(`A comment is required when setting status to '${status}'.`);
    this.name = "CommentRequiredError";
  }
}

export class MeetingNotFoundError extends Error {
  constructor(id: string) {
    super(`Meeting '${id}' not found.`);
    this.name = "MeetingNotFoundError";
  }
}
