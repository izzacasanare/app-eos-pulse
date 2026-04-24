/**
 * EOS Pulse — Issues Handler
 *
 * HTTP route definitions for the issues (IDS) domain.
 * Translates HTTP requests → domain calls → HTTP responses.
 *
 * Rules:
 *  - Import only from domain/issues.domain.ts
 *  - No db or schema imports
 *  - No business logic — delegate everything to domain
 *  - No imports from other handlers
 */

import type { HandlerParams } from "@mspbots/type";
import {
  listIssues,
  getIssueById,
  createIssue,
  updateIssue,
  startIds,
  resolveIssue,
  dropIssue,
  deleteIssue,
  ResolutionNotesTooShortError,
  IssueStatusTransitionError,
  RESOLUTION_NOTES_MIN_LENGTH,
} from "../domain/issues.domain.ts";

export const issuesHandler = {

  async "GET /api/issues"(params: HandlerParams) {
    const result = await listIssues(params.query ?? {});
    return result;
  },

  async "GET /api/issues/:id"(params: HandlerParams) {
    const issue = await getIssueById(params.params.id);
    if (!issue) return { error: "NOT_FOUND", message: "Issue not found" };
    return { issue };
  },

  async "POST /api/issues"(params: HandlerParams) {
    const body = params.body as {
      teamId: string;
      title: string;
      description?: string;
      priority?: string;
      meetingId?: string;
      ownerId?: string;
    };
    const issue = await createIssue({
      teamId: body.teamId,
      title: body.title,
      description: body.description,
      priority: body.priority as "low" | "medium" | "high" | undefined,
      meetingId: body.meetingId,
      ownerId: body.ownerId ?? params.user?.["id"] as string,
    });
    return { issue };
  },

  async "PATCH /api/issues/:id"(params: HandlerParams) {
    const patch = params.body as Record<string, unknown>;
    const issue = await updateIssue(params.params.id, patch);
    if (!issue) return { error: "NOT_FOUND", message: "Issue not found" };
    return { issue };
  },

  async "POST /api/issues/:id/start-ids"(params: HandlerParams) {
    try {
      const issue = await startIds(params.params.id);
      return { issue };
    } catch (err) {
      if (err instanceof IssueStatusTransitionError) {
        return { error: "INVALID_STATUS_TRANSITION", message: err.message };
      }
      throw err;
    }
  },

  async "POST /api/issues/:id/resolve"(params: HandlerParams) {
    const body = params.body as { resolutionNotes: string };
    try {
      const issue = await resolveIssue(params.params.id, {
        resolutionNotes: body.resolutionNotes,
      });
      return { issue };
    } catch (err) {
      if (err instanceof ResolutionNotesTooShortError) {
        return {
          error: "RESOLUTION_NOTES_TOO_SHORT",
          message: err.message,
          currentLength: err.currentLength,
          requiredLength: RESOLUTION_NOTES_MIN_LENGTH,
        };
      }
      if (err instanceof IssueStatusTransitionError) {
        return { error: "INVALID_STATUS_TRANSITION", message: err.message };
      }
      throw err;
    }
  },

  async "POST /api/issues/:id/drop"(params: HandlerParams) {
    const body = params.body as { note?: string };
    try {
      const issue = await dropIssue(params.params.id, body?.note);
      return { issue };
    } catch (err) {
      if (err instanceof IssueStatusTransitionError) {
        return { error: "INVALID_STATUS_TRANSITION", message: err.message };
      }
      throw err;
    }
  },

  async "DELETE /api/issues/:id"(params: HandlerParams) {
    // TODO: verify admin role from params.user
    await deleteIssue(params.params.id);
    return null;
  },

};
