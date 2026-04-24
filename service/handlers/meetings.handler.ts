/**
 * EOS Pulse — Meetings Handler
 *
 * HTTP route definitions for the meetings domain.
 * Translates HTTP requests → domain calls → HTTP responses.
 *
 * Rules:
 *  - Import only from domain/meetings.domain.ts
 *  - No db or schema imports
 *  - No business logic — delegate everything to domain
 *  - No imports from other handlers
 */

import type { HandlerParams } from "@mspbots/type";
import {
  listMeetings,
  getMeetingById,
  createMeeting,
  openMeeting,
  closeMeeting,
  updateMeeting,
  deleteMeeting,
  MeetingCloseBlockedError,
  MeetingStatusTransitionError,
} from "../domain/meetings.domain.ts";

export const meetingsHandler = {

  async "GET /api/meetings"(params: HandlerParams) {
    // TODO: parse pagination + filter params from params.query
    const result = await listMeetings(params.query ?? {});
    return result;
  },

  async "GET /api/meetings/:id"(params: HandlerParams) {
    const meeting = await getMeetingById(params.params.id);
    if (!meeting) return { error: "NOT_FOUND", message: "Meeting not found" };
    return { meeting };
  },

  async "POST /api/meetings"(params: HandlerParams) {
    const body = params.body as {
      type: string;
      teamId: string;
      scheduledAt: string;
      agendaJson?: unknown;
    };
    // TODO: validate required fields
    const meeting = await createMeeting({
      type: body.type as "l10" | "leadership",
      teamId: body.teamId,
      scheduledAt: body.scheduledAt,
      agendaJson: body.agendaJson,
    });
    return { meeting };
  },

  async "POST /api/meetings/:id/open"(params: HandlerParams) {
    try {
      const meeting = await openMeeting(params.params.id);
      return { meeting };
    } catch (err) {
      if (err instanceof MeetingStatusTransitionError) {
        return { error: "INVALID_STATUS_TRANSITION", message: err.message };
      }
      throw err;
    }
  },

  async "POST /api/meetings/:id/close"(params: HandlerParams) {
    const body = params.body as { notes?: string };
    try {
      const meeting = await closeMeeting(params.params.id, body?.notes);
      return { meeting };
    } catch (err) {
      if (err instanceof MeetingCloseBlockedError) {
        return {
          error: "OPEN_ISSUES_BLOCKING",
          message: err.message,
          blockingIssueIds: err.blockingIssueIds,
        };
      }
      if (err instanceof MeetingStatusTransitionError) {
        return { error: "INVALID_STATUS_TRANSITION", message: err.message };
      }
      throw err;
    }
  },

  async "PATCH /api/meetings/:id"(params: HandlerParams) {
    const patch = params.body as Record<string, unknown>;
    const meeting = await updateMeeting(params.params.id, patch);
    if (!meeting) return { error: "NOT_FOUND", message: "Meeting not found" };
    return { meeting };
  },

  async "DELETE /api/meetings/:id"(params: HandlerParams) {
    // TODO: verify admin role from params.user
    await deleteMeeting(params.params.id);
    return null;
  },

};
