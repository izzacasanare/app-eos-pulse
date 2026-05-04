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
  autoCreateWeeklySession,
  closeMeeting,
  createMeeting,
  deleteMeeting,
  getCurrentHost,
  getMeetingById,
  getMeetingsByTeam,
  getHostPrep,
  getUpcomingMeetings,
  listMeetings,
  openMeetingSession,
  updateMeeting,
  updateMeetingStatus,
  MeetingCloseBlockedError,
  MeetingNotFoundError,
  MeetingStatusTransitionError,
} from "../domain/meetings.domain.ts";
import type { MeetingStatus, MeetingType } from "../domain/meetings.domain.ts";

export const meetingsHandler = {

  // -------------------------------------------------------------------------
  // List / detail
  // -------------------------------------------------------------------------

  async "GET /api/meetings"(params: HandlerParams) {
    const q = params.query ?? {};
    const result = await listMeetings({
      teamId: q.teamId as string | undefined,
      status: q.status as string | undefined,
      type:   q.type   as string | undefined,
      from:   q.from   as string | undefined,
      to:     q.to     as string | undefined,
    });
    return result;
  },

  async "GET /api/meetings/:id"(params: HandlerParams) {
    const detail = await getMeetingById(params.params.id);
    if (!detail) return { error: "NOT_FOUND", message: "Meeting not found" };
    return detail;
  },

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  async "POST /api/meetings"(params: HandlerParams) {
    const body = params.body as {
      teamId:      string;
      type:        string;
      scheduledAt: string;
      hostId?:     string;
    };
    if (!body?.teamId || !body?.type || !body?.scheduledAt) {
      return {
        error:   "VALIDATION_ERROR",
        message: "teamId, type, and scheduledAt are required",
      };
    }
    const meeting = await createMeeting({
      teamId:      body.teamId,
      type:        body.type as MeetingType,
      scheduledAt: body.scheduledAt,
      hostId:      body.hostId,
    });
    return { meeting };
  },

  // -------------------------------------------------------------------------
  // Status transitions
  // -------------------------------------------------------------------------

  async "PUT /api/meetings/:id/status"(params: HandlerParams) {
    const body = params.body as { status: string };
    if (!body?.status) {
      return { error: "VALIDATION_ERROR", message: "status is required" };
    }
    try {
      const meeting = await updateMeetingStatus(
        params.params.id,
        body.status as MeetingStatus,
      );
      return { meeting };
    } catch (err) {
      if (err instanceof MeetingNotFoundError) {
        return { error: "NOT_FOUND", message: err.message };
      }
      if (err instanceof MeetingStatusTransitionError) {
        return { error: "INVALID_STATUS_TRANSITION", message: err.message };
      }
      if (err instanceof MeetingCloseBlockedError) {
        return {
          error:            "OPEN_ISSUES_BLOCKING",
          message:          err.message,
          blockingIssueIds: err.blockingIssueIds,
        };
      }
      throw err;
    }
  },

  /**
   * Host confirms session start: transitions upcoming → live and
   * auto-populates carry-over todos from the previous session.
   */
  async "POST /api/meetings/:id/open-session"(params: HandlerParams) {
    try {
      const result = await openMeetingSession(params.params.id);
      return result;
    } catch (err) {
      if (err instanceof MeetingNotFoundError) {
        return { error: "NOT_FOUND", message: err.message };
      }
      if (err instanceof MeetingStatusTransitionError) {
        return { error: "INVALID_STATUS_TRANSITION", message: err.message };
      }
      throw err;
    }
  },

  /** Legacy open endpoint — kept for backward compatibility. */
  async "POST /api/meetings/:id/open"(params: HandlerParams) {
    try {
      const result = await openMeetingSession(params.params.id);
      return result;
    } catch (err) {
      if (err instanceof MeetingNotFoundError) {
        return { error: "NOT_FOUND", message: err.message };
      }
      if (err instanceof MeetingStatusTransitionError) {
        return { error: "INVALID_STATUS_TRANSITION", message: err.message };
      }
      throw err;
    }
  },

  async "POST /api/meetings/:id/close"(params: HandlerParams) {
    try {
      const meeting = await closeMeeting(params.params.id);
      return { meeting };
    } catch (err) {
      if (err instanceof MeetingNotFoundError) {
        return { error: "NOT_FOUND", message: err.message };
      }
      if (err instanceof MeetingCloseBlockedError) {
        return {
          error:            "OPEN_ISSUES_BLOCKING",
          message:          err.message,
          blockingIssueIds: err.blockingIssueIds,
        };
      }
      if (err instanceof MeetingStatusTransitionError) {
        return { error: "INVALID_STATUS_TRANSITION", message: err.message };
      }
      throw err;
    }
  },

  // -------------------------------------------------------------------------
  // Host prep
  // -------------------------------------------------------------------------

  /** Returns carry-over todos and open issues for the host prep checklist. */
  async "GET /api/meetings/:id/host-prep"(params: HandlerParams) {
    const prep = await getHostPrep(params.params.id);
    if (!prep) return { error: "NOT_FOUND", message: "Meeting not found" };
    return prep;
  },

  // -------------------------------------------------------------------------
  // Auto-create weekly session
  // -------------------------------------------------------------------------

  async "POST /api/meetings/auto-create"(params: HandlerParams) {
    const body = params.body as { teamId: string };
    if (!body?.teamId) {
      return { error: "VALIDATION_ERROR", message: "teamId is required" };
    }
    const result = await autoCreateWeeklySession(body.teamId);
    return result;
  },

  // -------------------------------------------------------------------------
  // Utility queries
  // -------------------------------------------------------------------------

  async "GET /api/meetings/upcoming"(_params: HandlerParams) {
    const meetings = await getUpcomingMeetings();
    return { meetings };
  },

  async "GET /api/teams/:id/meetings"(params: HandlerParams) {
    const meetings = await getMeetingsByTeam(params.params.id);
    return { meetings };
  },

  async "GET /api/teams/:id/current-host"(params: HandlerParams) {
    const host = await getCurrentHost(params.params.id);
    if (!host) return { host: null };
    return { host };
  },

  // -------------------------------------------------------------------------
  // Update metadata / delete
  // -------------------------------------------------------------------------

  async "PATCH /api/meetings/:id"(params: HandlerParams) {
    const body = params.body as {
      scheduledAt?:     string;
      hostId?:          string | null;
      fathomUrl?:       string | null;
      meetingRatingAvg?: number | null;
    };
    try {
      const meeting = await updateMeeting(params.params.id, body ?? {});
      return { meeting };
    } catch (err) {
      if (err instanceof MeetingNotFoundError) {
        return { error: "NOT_FOUND", message: err.message };
      }
      throw err;
    }
  },

  async "DELETE /api/meetings/:id"(params: HandlerParams) {
    // TODO: verify admin role from params.user
    try {
      await deleteMeeting(params.params.id);
      return null;
    } catch (err) {
      if (err instanceof MeetingNotFoundError) {
        return { error: "NOT_FOUND", message: err.message };
      }
      throw err;
    }
  },

};
