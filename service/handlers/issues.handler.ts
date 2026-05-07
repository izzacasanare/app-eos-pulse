/**
 * EOS Pulse — Issues Handler
 *
 * HTTP route definitions for the company-wide IDS (Issue List) module.
 *
 * Rules:
 *  - Import only from domain/issues.domain.ts
 *  - No db or schema imports
 *  - No business logic — delegate everything to domain
 *  - No imports from other handlers
 */

import type { HandlerParams } from "@mspbots/type";
import {
  assignIssue,
  checkOverdueAssignments,
  closeIssue,
  convertIssueToRock,
  createIssue,
  escalateIssue,
  getCompanyIssueList,
  getEscalatedIssues,
  getIssueById,
  updateIssueStatus,
  DeptLeadApprovalRequiredError,
  InvalidIssuePriorityError,
  InvalidIssueStatusError,
  IssueNotFoundError,
  IssueStatusTransitionError,
  IssueValidationError,
  LeadershipRoleRequiredError,
  NotDeptLeadError,
  ResolutionNotesTooShortError,
  TeamNotFoundError,
  UserNotFoundError,
  RESOLUTION_NOTES_MIN_LENGTH,
} from "../domain/issues.domain.ts";
import type {
  ConvertIssueToRockInput,
  IssueListFilters,
  IssuePriority,
  IssueStatus,
} from "../domain/issues.domain.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseStatusFilter(v: unknown): IssueStatus | IssueStatus[] | undefined {
  if (typeof v !== "string" || v === "") return undefined;
  if (v.includes(",")) return v.split(",").map((s) => s.trim()) as IssueStatus[];
  return v as IssueStatus;
}

function parsePriorityFilter(v: unknown): IssuePriority | IssuePriority[] | undefined {
  if (typeof v !== "string" || v === "") return undefined;
  if (v.includes(",")) return v.split(",").map((s) => s.trim()) as IssuePriority[];
  return v as IssuePriority;
}

function parseBool(v: unknown): boolean | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    if (v === "true" || v === "1") return true;
    if (v === "false" || v === "0") return false;
  }
  return undefined;
}

function buildFiltersFromQuery(q: Record<string, unknown> = {}): IssueListFilters {
  return {
    dept:                  typeof q.dept === "string" && q.dept ? q.dept : undefined,
    sourceTeamId:          typeof q.sourceTeamId === "string" && q.sourceTeamId ? q.sourceTeamId : undefined,
    targetDeptId:          typeof q.targetDeptId === "string" && q.targetDeptId ? q.targetDeptId : undefined,
    status:                parseStatusFilter(q.status),
    priority:              parsePriorityFilter(q.priority),
    dateFrom:              typeof q.dateFrom === "string" && q.dateFrom ? q.dateFrom : undefined,
    dateTo:                typeof q.dateTo === "string" && q.dateTo ? q.dateTo : undefined,
    submitterId:           typeof q.submitter === "string" && q.submitter
                             ? q.submitter
                             : (typeof q.submitterId === "string" && q.submitterId ? q.submitterId : undefined),
    assignedToId:          typeof q.assignedTo === "string" && q.assignedTo
                             ? q.assignedTo
                             : (typeof q.assignedToId === "string" && q.assignedToId ? q.assignedToId : undefined),
    meetingId:             typeof q.meetingId === "string" && q.meetingId ? q.meetingId : undefined,
    escalatedToLeadership: parseBool(q.escalatedToLeadership ?? q.escalated),
  };
}

function mapIssueError(err: unknown):
  | { status: number; body: Record<string, unknown> }
  | null
{
  if (err instanceof ResolutionNotesTooShortError) {
    return {
      status: 400,
      body: {
        error:          "RESOLUTION_NOTES_TOO_SHORT",
        message:        err.message,
        currentLength:  err.currentLength,
        requiredLength: RESOLUTION_NOTES_MIN_LENGTH,
      },
    };
  }
  if (err instanceof IssueValidationError) {
    return { status: 400, body: { error: "VALIDATION_ERROR", message: err.message } };
  }
  if (err instanceof InvalidIssueStatusError || err instanceof InvalidIssuePriorityError) {
    return { status: 400, body: { error: "VALIDATION_ERROR", message: err.message } };
  }
  if (err instanceof IssueStatusTransitionError) {
    return { status: 409, body: { error: "INVALID_STATUS_TRANSITION", message: err.message } };
  }
  if (err instanceof IssueNotFoundError) {
    return { status: 404, body: { error: "NOT_FOUND", message: err.message } };
  }
  if (err instanceof UserNotFoundError || err instanceof TeamNotFoundError) {
    return { status: 404, body: { error: "NOT_FOUND", message: err.message } };
  }
  if (err instanceof NotDeptLeadError) {
    return { status: 403, body: { error: "NOT_DEPT_LEAD", message: err.message } };
  }
  if (err instanceof DeptLeadApprovalRequiredError) {
    return { status: 403, body: { error: "DEPT_LEAD_APPROVAL_REQUIRED", message: err.message } };
  }
  if (err instanceof LeadershipRoleRequiredError) {
    return { status: 403, body: { error: "LEADERSHIP_ROLE_REQUIRED", message: err.message } };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const issuesHandler = {

  /** Company-wide list. Visible to all employees — no role gate. */
  async "GET /api/issues"(params: HandlerParams) {
    const filters = buildFiltersFromQuery(params.query ?? {});
    const result  = await getCompanyIssueList(filters);
    return result;
  },

  /** All issues flagged for the Quarterly Leadership Meeting. */
  async "GET /api/issues/escalated"(_params: HandlerParams) {
    const items = await getEscalatedIssues();
    return { items, total: items.length };
  },

  /** Issues unassigned past 48hr — used by the nudge cron. */
  async "GET /api/issues/overdue"(_params: HandlerParams) {
    const items = await checkOverdueAssignments();
    return { items, total: items.length };
  },

  async "GET /api/issues/:id"(params: HandlerParams) {
    const issue = await getIssueById(params.params.id);
    if (!issue) return { error: "NOT_FOUND", message: "Issue not found" };
    return { issue };
  },

  /** Create a new issue. Any member can submit. */
  async "POST /api/issues"(params: HandlerParams) {
    const body = (params.body ?? {}) as Record<string, unknown>;

    // Backwards-compat: older callers pass `ownerId` (LiveSessionPage's
    // ParkToIdsButton) and `teamId` instead of submitterId / sourceTeamId.
    const submitterId =
      (body.submitterId as string | undefined) ??
      (body.ownerId as string | undefined) ??
      (params.user?.["id"] as string | undefined);

    const sourceTeamId =
      (body.sourceTeamId as string | undefined) ??
      (body.teamId as string | undefined);

    // Default targetDept to the submitter's team when not specified — the
    // common case for issues raised inside a team L10.
    const targetDeptId =
      (body.targetDeptId as string | undefined) ??
      (body.teamId as string | undefined);

    if (!submitterId) {
      return { error: "VALIDATION_ERROR", message: "submitterId is required" };
    }

    try {
      const issue = await createIssue({
        title:          body.title as string,
        description:    body.description as string | undefined,
        submitterId,
        targetDeptId:   targetDeptId as string,
        sourceTeamId,
        priority:       body.priority as IssuePriority | undefined,
        meetingId:      body.meetingId as string | undefined,
        isFathomSource: Boolean(body.isFathomSource),
      });
      return { issue };
    } catch (err) {
      const mapped = mapIssueError(err);
      if (mapped) return mapped.body;
      throw err;
    }
  },

  /** Assign a resolver. Dept Lead of the target dept (or Leadership). */
  async "PUT /api/issues/:id/assign"(params: HandlerParams) {
    const body = (params.body ?? {}) as { assignedToId?: string; assignedById?: string };
    const assignedById =
      body.assignedById ?? (params.user?.["id"] as string | undefined);

    if (!body.assignedToId) {
      return { error: "VALIDATION_ERROR", message: "assignedToId is required" };
    }
    if (!assignedById) {
      return { error: "VALIDATION_ERROR", message: "assignedById is required" };
    }

    try {
      const issue = await assignIssue(params.params.id, body.assignedToId, assignedById);
      return { issue };
    } catch (err) {
      const mapped = mapIssueError(err);
      if (mapped) return mapped.body;
      throw err;
    }
  },

  /** Update status. Final 'closed' must use /close instead. */
  async "PUT /api/issues/:id/status"(params: HandlerParams) {
    const body = (params.body ?? {}) as { status?: string; userId?: string };
    const userId = body.userId ?? (params.user?.["id"] as string | undefined);

    if (!body.status) {
      return { error: "VALIDATION_ERROR", message: "status is required" };
    }
    if (!userId) {
      return { error: "VALIDATION_ERROR", message: "userId is required" };
    }

    try {
      const issue = await updateIssueStatus(
        params.params.id,
        body.status as IssueStatus,
        userId,
      );
      return { issue };
    } catch (err) {
      const mapped = mapIssueError(err);
      if (mapped) return mapped.body;
      throw err;
    }
  },

  /** Close with resolution notes (≥50 chars) and Dept Lead approval. */
  async "PUT /api/issues/:id/close"(params: HandlerParams) {
    const body = (params.body ?? {}) as {
      resolutionNotes?: string;
      sopLink?:         string | null;
      closedById?:      string;
    };
    const closedById =
      body.closedById ?? (params.user?.["id"] as string | undefined);

    if (typeof body.resolutionNotes !== "string") {
      return { error: "VALIDATION_ERROR", message: "resolutionNotes is required" };
    }
    if (!closedById) {
      return { error: "VALIDATION_ERROR", message: "closedById is required" };
    }

    try {
      const issue = await closeIssue(
        params.params.id,
        body.resolutionNotes,
        body.sopLink ?? null,
        closedById,
      );
      return { issue };
    } catch (err) {
      const mapped = mapIssueError(err);
      if (mapped) return mapped.body;
      throw err;
    }
  },

  /** Flag an issue for the Quarterly Leadership Meeting queue. */
  async "PUT /api/issues/:id/escalate"(params: HandlerParams) {
    try {
      const issue = await escalateIssue(params.params.id);
      return { issue };
    } catch (err) {
      const mapped = mapIssueError(err);
      if (mapped) return mapped.body;
      throw err;
    }
  },

  /** Convert an issue to a Rock — Leadership only, Day 3 of Quarterly. */
  async "POST /api/issues/:id/convert-to-rock"(params: HandlerParams) {
    const body = (params.body ?? {}) as {
      rockData?:      ConvertIssueToRockInput;
      convertedById?: string;
    };
    const convertedById =
      body.convertedById ?? (params.user?.["id"] as string | undefined);

    if (!body.rockData) {
      return { error: "VALIDATION_ERROR", message: "rockData is required" };
    }
    if (!convertedById) {
      return { error: "VALIDATION_ERROR", message: "convertedById is required" };
    }

    try {
      const result = await convertIssueToRock(
        params.params.id,
        body.rockData,
        convertedById,
      );
      return result;
    } catch (err) {
      const mapped = mapIssueError(err);
      if (mapped) return mapped.body;
      throw err;
    }
  },

};
