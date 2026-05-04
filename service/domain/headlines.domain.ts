/**
 * EOS Pulse — Headlines Domain
 *
 * Business logic for pre-meeting Headlines (absences, headcount changes,
 * closed-won deals, cancellations, general news).
 *
 * Rules enforced here:
 *  - category must be one of HEADLINE_CATEGORIES
 *  - escalateHeadlineToIDS converts a headline into a tracked issue and flags
 *    the source headline
 *
 * Imports allowed: db, schema, other domain files
 * Imports forbidden: handlers/, HTTP context, raw fetch()
 */

import { desc, eq } from "drizzle-orm";
import { db } from "../db.ts";
import { headlines, issues, meetings } from "../schema.ts";
import type { Headline, Issue } from "../schema.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const HEADLINE_CATEGORIES = [
  "absence",
  "headcount",
  "closed_won",
  "cancellation",
  "general",
] as const;

export type HeadlineCategory = typeof HEADLINE_CATEGORIES[number];

// ---------------------------------------------------------------------------
// Domain functions
// ---------------------------------------------------------------------------

export async function submitHeadline(
  submitterId: string,
  meetingId:   string,
  category:    HeadlineCategory,
  content:     string,
): Promise<Headline> {
  if (!HEADLINE_CATEGORIES.includes(category)) {
    throw new InvalidHeadlineCategoryError(category);
  }
  if (!content || content.trim().length === 0) {
    throw new HeadlineContentRequiredError();
  }

  const [row] = await db
    .insert(headlines)
    .values({
      submitterId,
      meetingId,
      category,
      content: content.trim(),
    })
    .returning();
  return row;
}

export async function getMeetingHeadlines(meetingId: string): Promise<Headline[]> {
  return db
    .select()
    .from(headlines)
    .where(eq(headlines.meetingId, meetingId))
    .orderBy(desc(headlines.submittedAt));
}

export async function escalateHeadlineToIDS(
  headlineId: string,
  meetingId:  string,
): Promise<{ headline: Headline; issue: Issue }> {
  const [headline] = await db
    .select()
    .from(headlines)
    .where(eq(headlines.id, headlineId));
  if (!headline) throw new HeadlineNotFoundError(headlineId);

  if (headline.escalatedToIds) {
    throw new HeadlineAlreadyEscalatedError(headlineId);
  }

  const [meeting] = await db
    .select()
    .from(meetings)
    .where(eq(meetings.id, meetingId));
  if (!meeting) throw new MeetingNotFoundError(meetingId);

  const title = `Headline: ${headline.category} — ${truncate(headline.content, 80)}`;

  const [issue] = await db
    .insert(issues)
    .values({
      title,
      description:  headline.content,
      submitterId:  headline.submitterId,
      sourceTeamId: meeting.teamId,
      targetDeptId: meeting.teamId,
      meetingId,
      priority:     "medium",
      status:       "open",
    })
    .returning();

  const [updatedHeadline] = await db
    .update(headlines)
    .set({ escalatedToIds: true })
    .where(eq(headlines.id, headlineId))
    .returning();

  return { headline: updatedHeadline, issue };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class InvalidHeadlineCategoryError extends Error {
  constructor(category: string) {
    super(
      `Invalid headline category '${category}'. Allowed: ${HEADLINE_CATEGORIES.join(", ")}.`,
    );
    this.name = "InvalidHeadlineCategoryError";
  }
}

export class HeadlineContentRequiredError extends Error {
  constructor() {
    super("Headline content is required.");
    this.name = "HeadlineContentRequiredError";
  }
}

export class HeadlineNotFoundError extends Error {
  constructor(id: string) {
    super(`Headline '${id}' not found.`);
    this.name = "HeadlineNotFoundError";
  }
}

export class HeadlineAlreadyEscalatedError extends Error {
  constructor(id: string) {
    super(`Headline '${id}' has already been escalated to IDS.`);
    this.name = "HeadlineAlreadyEscalatedError";
  }
}

export class MeetingNotFoundError extends Error {
  constructor(id: string) {
    super(`Meeting '${id}' not found.`);
    this.name = "MeetingNotFoundError";
  }
}
