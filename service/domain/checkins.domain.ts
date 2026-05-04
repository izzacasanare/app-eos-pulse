/**
 * EOS Pulse — Check-ins Domain
 *
 * Business logic for pre-meeting check-ins (Personal & Professional Good News).
 *
 * Rules enforced here:
 *  - One check-in per (memberId, meetingId) — re-submission updates in place
 *  - submittedAt is server-controlled (set on insert)
 *  - getMeetingCheckins flags missing members (team users without a submission)
 *
 * Imports allowed: db, schema, other domain files
 * Imports forbidden: handlers/, HTTP context, raw fetch()
 */

import { and, eq } from "drizzle-orm";
import { db } from "../db.ts";
import { checkins, meetings, users } from "../schema.ts";
import type { Checkin, User } from "../schema.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MeetingCheckinsResult {
  meetingId:      string;
  submitted:      Checkin[];
  missingMembers: Pick<User, "id" | "name" | "email">[];
  totalExpected:  number;
  submittedCount: number;
}

// ---------------------------------------------------------------------------
// Domain functions
// ---------------------------------------------------------------------------

export async function getCheckinByMemberAndMeeting(
  memberId:  string,
  meetingId: string,
): Promise<Checkin | null> {
  const [row] = await db
    .select()
    .from(checkins)
    .where(
      and(eq(checkins.memberId, memberId), eq(checkins.meetingId, meetingId)),
    );
  return row ?? null;
}

export async function submitCheckin(
  memberId:             string,
  meetingId:            string,
  personalGoodNews:     string | null,
  professionalGoodNews: string | null,
): Promise<Checkin> {
  const existing = await getCheckinByMemberAndMeeting(memberId, meetingId);

  if (existing) {
    const [updated] = await db
      .update(checkins)
      .set({
        personalGoodNews,
        professionalGoodNews,
        submittedAt: new Date(),
      })
      .where(eq(checkins.id, existing.id))
      .returning();
    return updated;
  }

  const [row] = await db
    .insert(checkins)
    .values({
      memberId,
      meetingId,
      personalGoodNews,
      professionalGoodNews,
    })
    .returning();
  return row;
}

export async function getMeetingCheckins(
  meetingId: string,
): Promise<MeetingCheckinsResult> {
  const [meeting] = await db
    .select()
    .from(meetings)
    .where(eq(meetings.id, meetingId));
  if (!meeting) throw new MeetingNotFoundError(meetingId);

  const [submitted, teamMembers] = await Promise.all([
    db.select().from(checkins).where(eq(checkins.meetingId, meetingId)),
    db.select().from(users).where(eq(users.teamId, meeting.teamId)),
  ]);

  const submittedIds = new Set(submitted.map((c) => c.memberId));
  const missingMembers = teamMembers
    .filter((u) => !submittedIds.has(u.id))
    .map((u) => ({ id: u.id, name: u.name, email: u.email }));

  return {
    meetingId,
    submitted,
    missingMembers,
    totalExpected:  teamMembers.length,
    submittedCount: submitted.length,
  };
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
