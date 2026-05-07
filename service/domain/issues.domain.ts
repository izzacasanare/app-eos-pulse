/**
 * EOS Pulse — Issues Domain
 *
 * Business logic for the company-wide IDS (Identify · Discuss · Solve) issue list.
 *
 * Core rules enforced here:
 *  - Issues cannot be closed without resolution_notes ≥ 50 characters
 *  - Issues cannot advance from 'pending_closure' to 'closed' without Dept Lead approval
 *  - If a Dept Lead does not assign a resolver within 48hr, escalate_to_leadership is set
 *  - Assignment must be performed by the Dept Lead of the target_dept
 *  - source_team_id is auto-derived from the submitter's team
 *
 * Imports allowed: db, schema, other domain files
 * Imports forbidden: handlers/, HTTP context, raw fetch()
 */

import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../db.ts";
import { issues, rocks, teams, users } from "../schema.ts";
import type { Issue, NewRock, Rock, User } from "../schema.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IssueStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "pending_closure"
  | "closed";

export type IssuePriority = "low" | "medium" | "high" | "critical";

export const ISSUE_STATUSES: readonly IssueStatus[] = [
  "open",
  "assigned",
  "in_progress",
  "pending_closure",
  "closed",
] as const;

export const ISSUE_PRIORITIES: readonly IssuePriority[] = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const RESOLUTION_NOTES_MIN_LENGTH = 50;
export const ASSIGNMENT_SLA_MS = 48 * 60 * 60 * 1000;

/** Roles permitted to approve a 'pending_closure' → 'closed' transition. */
const DEPT_LEAD_ROLES = new Set(["team_lead", "leadership", "super_admin"]);

/** Roles permitted to convert an issue to a Rock during the Quarterly Day 3 step. */
const LEADERSHIP_ROLES = new Set(["leadership", "super_admin"]);

export interface CreateIssueInput {
  title:           string;
  description?:    string;
  submitterId:     string;
  targetDeptId:    string;
  priority?:       IssuePriority;
  meetingId?:      string;
  isFathomSource?: boolean;
  /** Optional override; defaults to the submitter's team. */
  sourceTeamId?:   string;
}

export interface IssueListFilters {
  dept?:                  string;             // matches sourceTeamId or targetDeptId
  targetDeptId?:          string;
  sourceTeamId?:          string;
  status?:                IssueStatus | IssueStatus[];
  priority?:              IssuePriority | IssuePriority[];
  dateFrom?:              string;             // ISO date
  dateTo?:                string;             // ISO date
  submitterId?:           string;
  assignedToId?:          string;
  meetingId?:             string;
  escalatedToLeadership?: boolean;
}

export interface ConvertIssueToRockInput {
  title:        string;
  ownerId:      string;
  teamId:       string;
  level?:       "company" | "dept" | "individual";
  quarter:      number;
  year:         number;
  parentRockId?: string;
}

export interface IssueListResult {
  items: Issue[];
  total: number;
}

// ---------------------------------------------------------------------------
// Read functions
// ---------------------------------------------------------------------------

export async function getIssueById(id: string): Promise<Issue | null> {
  const [row] = await db.select().from(issues).where(eq(issues.id, id));
  return row ?? null;
}

export async function getCompanyIssueList(
  filters: IssueListFilters = {},
): Promise<IssueListResult> {
  const conditions = buildFilterConditions(filters);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(issues)
    .where(where)
    .orderBy(desc(issues.createdAt));

  return { items: rows, total: rows.length };
}

export async function getEscalatedIssues(): Promise<Issue[]> {
  return db
    .select()
    .from(issues)
    .where(eq(issues.escalateToLeadership, true))
    .orderBy(desc(issues.createdAt));
}

/**
 * Returns issues that are still in 'open' status (no assignee) past the 48hr SLA.
 * Called by the nudge engine to flag and auto-escalate stale items.
 */
export async function checkOverdueAssignments(): Promise<Issue[]> {
  const cutoff = new Date(Date.now() - ASSIGNMENT_SLA_MS);
  return db
    .select()
    .from(issues)
    .where(
      and(
        eq(issues.status, "open"),
        isNull(issues.assignedToId),
        lte(issues.createdAt, cutoff),
      ),
    )
    .orderBy(asc(issues.createdAt));
}

// ---------------------------------------------------------------------------
// Write functions
// ---------------------------------------------------------------------------

export async function createIssue(input: CreateIssueInput): Promise<Issue> {
  if (!input.title || !input.title.trim()) {
    throw new IssueValidationError("title is required");
  }
  if (!input.submitterId) {
    throw new IssueValidationError("submitterId is required");
  }
  if (!input.targetDeptId) {
    throw new IssueValidationError("targetDeptId is required");
  }
  if (input.priority && !ISSUE_PRIORITIES.includes(input.priority)) {
    throw new InvalidIssuePriorityError(input.priority);
  }

  const submitter = await getUser(input.submitterId);
  if (!submitter) throw new UserNotFoundError(input.submitterId);

  const sourceTeamId = input.sourceTeamId ?? submitter.teamId;
  if (!sourceTeamId) {
    throw new IssueValidationError(
      "sourceTeamId could not be derived — submitter is not assigned to a team.",
    );
  }

  await assertTeamExists(sourceTeamId);
  await assertTeamExists(input.targetDeptId);

  const [row] = await db
    .insert(issues)
    .values({
      title:                input.title.trim(),
      description:          input.description?.trim() || null,
      submitterId:          input.submitterId,
      sourceTeamId,
      targetDeptId:         input.targetDeptId,
      priority:             input.priority ?? "medium",
      status:               "open",
      meetingId:            input.meetingId ?? null,
      isFathomSource:       input.isFathomSource ?? false,
      escalateToLeadership: false,
    })
    .returning();
  return row;
}

export async function assignIssue(
  issueId:      string,
  assignedToId: string,
  assignedById: string,
): Promise<Issue> {
  const issue = await getIssueById(issueId);
  if (!issue) throw new IssueNotFoundError(issueId);

  if (issue.status === "closed") {
    throw new IssueStatusTransitionError(issue.status as IssueStatus,"assigned");
  }

  const [assigner, assignee] = await Promise.all([
    getUser(assignedById),
    getUser(assignedToId),
  ]);
  if (!assigner) throw new UserNotFoundError(assignedById);
  if (!assignee) throw new UserNotFoundError(assignedToId);

  // Dept Lead of the target dept = team_lead whose teamId matches targetDeptId.
  // Leadership and super_admin can assign across departments.
  const isDeptLead =
    assigner.role === "team_lead" && assigner.teamId === issue.targetDeptId;
  const isElevated =
    assigner.role === "leadership" || assigner.role === "super_admin";
  if (!isDeptLead && !isElevated) {
    throw new NotDeptLeadError(assignedById, issue.targetDeptId);
  }

  const [updated] = await db
    .update(issues)
    .set({
      assignedToId,
      status:    issue.status === "open" ? "assigned" : issue.status,
      updatedAt: new Date(),
    })
    .where(eq(issues.id, issueId))
    .returning();
  return updated;
}

export async function updateIssueStatus(
  issueId: string,
  status:  IssueStatus,
  userId:  string,
): Promise<Issue> {
  if (!ISSUE_STATUSES.includes(status)) {
    throw new InvalidIssueStatusError(status);
  }

  const issue = await getIssueById(issueId);
  if (!issue) throw new IssueNotFoundError(issueId);

  // 'closed' must go through closeIssue — it has additional validation.
  if (status === "closed") {
    throw new IssueStatusTransitionError(issue.status as IssueStatus,status);
  }

  // Direct moves into pending_closure are allowed (the resolver signals "ready
  // to close"). Final close still requires closeIssue() with resolution notes.
  void userId;

  const [updated] = await db
    .update(issues)
    .set({ status, updatedAt: new Date() })
    .where(eq(issues.id, issueId))
    .returning();
  return updated;
}

export async function closeIssue(
  issueId:         string,
  resolutionNotes: string,
  sopLink:         string | null,
  closedById:      string,
): Promise<Issue> {
  const trimmed = (resolutionNotes ?? "").trim();
  if (trimmed.length < RESOLUTION_NOTES_MIN_LENGTH) {
    throw new ResolutionNotesTooShortError(trimmed.length);
  }

  const issue = await getIssueById(issueId);
  if (!issue) throw new IssueNotFoundError(issueId);
  if (issue.status === "closed") {
    throw new IssueStatusTransitionError(issue.status as IssueStatus,"closed");
  }

  const closer = await getUser(closedById);
  if (!closer) throw new UserNotFoundError(closedById);

  // 'pending_closure' → 'closed' must be approved by a Dept Lead (team_lead of
  // the target dept) or higher. Other transitions to 'closed' also require it.
  const isDeptLead =
    closer.role === "team_lead" && closer.teamId === issue.targetDeptId;
  const isElevated = DEPT_LEAD_ROLES.has(closer.role) && closer.role !== "team_lead";
  if (!isDeptLead && !isElevated) {
    throw new DeptLeadApprovalRequiredError(closedById, issue.targetDeptId);
  }

  const [updated] = await db
    .update(issues)
    .set({
      status:          "closed",
      resolutionNotes: trimmed,
      sopLink:         sopLink?.trim() || null,
      updatedAt:       new Date(),
    })
    .where(eq(issues.id, issueId))
    .returning();
  return updated;
}

export async function escalateIssue(issueId: string): Promise<Issue> {
  const issue = await getIssueById(issueId);
  if (!issue) throw new IssueNotFoundError(issueId);

  const [updated] = await db
    .update(issues)
    .set({ escalateToLeadership: true, updatedAt: new Date() })
    .where(eq(issues.id, issueId))
    .returning();
  return updated;
}

/**
 * Convert an issue to a Rock. Closes the source issue (with auto-generated
 * resolution notes referencing the new rock) and inserts a new rocks row.
 *
 * Allowed only for Leadership / super_admin; nominal use is Day 3 of the
 * Quarterly Leadership Meeting after the issue list has been worked through.
 */
export async function convertIssueToRock(
  issueId:    string,
  rockData:   ConvertIssueToRockInput,
  convertedById: string,
): Promise<{ issue: Issue; rock: Rock }> {
  const issue = await getIssueById(issueId);
  if (!issue) throw new IssueNotFoundError(issueId);
  if (issue.status === "closed") {
    throw new IssueStatusTransitionError(issue.status as IssueStatus,"closed");
  }

  const converter = await getUser(convertedById);
  if (!converter) throw new UserNotFoundError(convertedById);
  if (!LEADERSHIP_ROLES.has(converter.role)) {
    throw new LeadershipRoleRequiredError(convertedById);
  }

  if (!rockData.title?.trim()) {
    throw new IssueValidationError("rockData.title is required");
  }
  if (!rockData.ownerId) {
    throw new IssueValidationError("rockData.ownerId is required");
  }
  if (!rockData.teamId) {
    throw new IssueValidationError("rockData.teamId is required");
  }
  if (!Number.isInteger(rockData.quarter) || rockData.quarter < 1 || rockData.quarter > 4) {
    throw new IssueValidationError("rockData.quarter must be 1–4");
  }
  if (!Number.isInteger(rockData.year)) {
    throw new IssueValidationError("rockData.year is required");
  }

  const newRock: NewRock = {
    title:        rockData.title.trim(),
    teamId:       rockData.teamId,
    level:        rockData.level ?? "dept",
    ownerId:      rockData.ownerId,
    quarter:      rockData.quarter,
    year:         rockData.year,
    parentRockId: rockData.parentRockId ?? null,
    status:       "on_track",
  };

  const [rock] = await db.insert(rocks).values(newRock).returning();

  const autoNotes =
    `Converted to Rock '${rock.title}' (Q${rock.quarter}-${rock.year}). ` +
    `Tracking continues on the rock; this issue is closed as resolved by conversion.`;

  const [updatedIssue] = await db
    .update(issues)
    .set({
      status:          "closed",
      resolutionNotes: autoNotes,
      updatedAt:       new Date(),
    })
    .where(eq(issues.id, issueId))
    .returning();

  return { issue: updatedIssue, rock };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getUser(id: string): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row ?? null;
}

async function assertTeamExists(teamId: string): Promise<void> {
  const [row] = await db.select().from(teams).where(eq(teams.id, teamId));
  if (!row) throw new TeamNotFoundError(teamId);
}

function buildFilterConditions(f: IssueListFilters): ReturnType<typeof eq>[] {
  const c: ReturnType<typeof eq>[] = [];

  if (f.dept) {
    // 'dept' is a convenience filter that matches either source or target.
    const expr = or(
      eq(issues.sourceTeamId, f.dept),
      eq(issues.targetDeptId, f.dept),
    );
    if (expr) c.push(expr as ReturnType<typeof eq>);
  }
  if (f.sourceTeamId) c.push(eq(issues.sourceTeamId, f.sourceTeamId));
  if (f.targetDeptId) c.push(eq(issues.targetDeptId, f.targetDeptId));

  if (f.status) {
    const list = Array.isArray(f.status) ? f.status : [f.status];
    if (list.length === 1) c.push(eq(issues.status, list[0]));
    else if (list.length > 1) c.push(inArray(issues.status, list) as ReturnType<typeof eq>);
  }

  if (f.priority) {
    const list = Array.isArray(f.priority) ? f.priority : [f.priority];
    if (list.length === 1) c.push(eq(issues.priority, list[0]));
    else if (list.length > 1) c.push(inArray(issues.priority, list) as ReturnType<typeof eq>);
  }

  if (f.dateFrom) {
    c.push(gte(issues.createdAt, new Date(f.dateFrom)) as ReturnType<typeof eq>);
  }
  if (f.dateTo) {
    c.push(lte(issues.createdAt, new Date(f.dateTo)) as ReturnType<typeof eq>);
  }

  if (f.submitterId)  c.push(eq(issues.submitterId, f.submitterId));
  if (f.assignedToId) c.push(eq(issues.assignedToId, f.assignedToId));
  if (f.meetingId)    c.push(eq(issues.meetingId, f.meetingId));

  if (f.escalatedToLeadership !== undefined) {
    c.push(eq(issues.escalateToLeadership, f.escalatedToLeadership));
  }

  // Reference sql to keep import alive for future custom predicates.
  void sql;

  return c;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class IssueValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IssueValidationError";
  }
}

export class ResolutionNotesTooShortError extends Error {
  constructor(public readonly currentLength: number) {
    super(
      `Resolution notes must be at least ${RESOLUTION_NOTES_MIN_LENGTH} characters. ` +
      `Received: ${currentLength}.`,
    );
    this.name = "ResolutionNotesTooShortError";
  }
}

export class IssueStatusTransitionError extends Error {
  constructor(currentStatus: IssueStatus, targetStatus: IssueStatus) {
    super(`Cannot transition issue from '${currentStatus}' to '${targetStatus}'.`);
    this.name = "IssueStatusTransitionError";
  }
}

export class InvalidIssueStatusError extends Error {
  constructor(status: string) {
    super(
      `Invalid issue status '${status}'. Allowed: ${ISSUE_STATUSES.join(", ")}.`,
    );
    this.name = "InvalidIssueStatusError";
  }
}

export class InvalidIssuePriorityError extends Error {
  constructor(priority: string) {
    super(
      `Invalid issue priority '${priority}'. Allowed: ${ISSUE_PRIORITIES.join(", ")}.`,
    );
    this.name = "InvalidIssuePriorityError";
  }
}

export class IssueNotFoundError extends Error {
  constructor(id: string) {
    super(`Issue '${id}' not found.`);
    this.name = "IssueNotFoundError";
  }
}

export class UserNotFoundError extends Error {
  constructor(id: string) {
    super(`User '${id}' not found.`);
    this.name = "UserNotFoundError";
  }
}

export class TeamNotFoundError extends Error {
  constructor(id: string) {
    super(`Team '${id}' not found.`);
    this.name = "TeamNotFoundError";
  }
}

export class NotDeptLeadError extends Error {
  constructor(userId: string, targetDeptId: string) {
    super(
      `User '${userId}' is not the Dept Lead of target dept '${targetDeptId}'. ` +
      `Only the Dept Lead (team_lead) of the target department or Leadership ` +
      `can assign a resolver.`,
    );
    this.name = "NotDeptLeadError";
  }
}

export class DeptLeadApprovalRequiredError extends Error {
  constructor(userId: string, targetDeptId: string) {
    super(
      `Closing an issue requires Dept Lead approval. User '${userId}' is not ` +
      `the Dept Lead of target dept '${targetDeptId}' (or Leadership).`,
    );
    this.name = "DeptLeadApprovalRequiredError";
  }
}

export class LeadershipRoleRequiredError extends Error {
  constructor(userId: string) {
    super(
      `Converting an issue to a Rock requires the Leadership role. ` +
      `User '${userId}' does not have it.`,
    );
    this.name = "LeadershipRoleRequiredError";
  }
}
