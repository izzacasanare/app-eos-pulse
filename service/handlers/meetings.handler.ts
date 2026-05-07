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
  advanceSegment,
  autoCreateWeeklySession,
  closeLiveSession,
  closeMeeting,
  completeMeetingClose,
  createMeeting,
  deleteMeeting,
  generateMeetingSummary,
  getCurrentHost,
  getHostChecklist,
  getMeetingById,
  getMeetingSegments,
  getMeetingsByTeam,
  getHostPrep,
  getUpcomingMeetings,
  listFathomLinksByTeam,
  listMeetingRatings,
  listMeetings,
  openLiveSession,
  openMeetingSession,
  submitFathomLink,
  submitMeetingRating,
  updateMeeting,
  updateMeetingStatus,
  HostChecklistIncompleteError,
  InvalidFathomLinkError,
  InvalidRatingError,
  InvalidSegmentError,
  MeetingCloseBlockedError,
  MeetingNotFoundError,
  MeetingNotLiveError,
  MeetingStatusTransitionError,
  SessionCloseGateError,
} from "../domain/meetings.domain.ts";
import type {
  MeetingStatus,
  MeetingType,
  SessionSegment,
} from "../domain/meetings.domain.ts";

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

  // -------------------------------------------------------------------------
  // Live session
  // -------------------------------------------------------------------------

  /** Opens the live session: upcoming → live, stamps started_at, opens segment 1. */
  async "POST /api/meetings/:id/live/open"(params: HandlerParams) {
    try {
      const result = await openLiveSession(params.params.id);
      return result;
    } catch (err) {
      if (err instanceof MeetingNotFoundError) {
        return { status: 404, error: "NOT_FOUND", message: err.message };
      }
      if (err instanceof MeetingStatusTransitionError) {
        return {
          status:  400,
          error:   "INVALID_STATUS_TRANSITION",
          message: err.message,
        };
      }
      throw err;
    }
  },

  /** Advance the live session to the next segment. */
  async "POST /api/meetings/:id/live/advance"(params: HandlerParams) {
    const body = params.body as { segment?: string };
    if (!body?.segment) {
      return {
        status:  400,
        error:   "VALIDATION_ERROR",
        message: "segment is required",
      };
    }
    try {
      const segment = await advanceSegment(
        params.params.id,
        body.segment as SessionSegment,
      );
      return { segment };
    } catch (err) {
      if (err instanceof MeetingNotFoundError) {
        return { status: 404, error: "NOT_FOUND", message: err.message };
      }
      if (err instanceof MeetingNotLiveError) {
        return { status: 400, error: "NOT_LIVE", message: err.message };
      }
      if (err instanceof InvalidSegmentError) {
        return { status: 400, error: "INVALID_SEGMENT", message: err.message };
      }
      throw err;
    }
  },

  /** Read all segments for a meeting (for timeline / agenda checkmarks). */
  async "GET /api/meetings/:id/segments"(params: HandlerParams) {
    const segments = await getMeetingSegments(params.params.id);
    return { segments };
  },

  /**
   * Close the live session (live → pending_close). Validates gate conditions
   * before transitioning. Returns 400 with structured failure if any gate fails.
   */
  async "POST /api/meetings/:id/live/close"(params: HandlerParams) {
    try {
      const meeting = await closeLiveSession(params.params.id);
      return { meeting };
    } catch (err) {
      if (err instanceof MeetingNotFoundError) {
        return { status: 404, error: "NOT_FOUND", message: err.message };
      }
      if (err instanceof MeetingStatusTransitionError) {
        return {
          status:  400,
          error:   "INVALID_STATUS_TRANSITION",
          message: err.message,
        };
      }
      if (err instanceof SessionCloseGateError) {
        return {
          status:      400,
          error:       err.failure.reason,
          message:     err.failure.message,
          blockingIds: err.failure.blockingIds,
        };
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

  // -------------------------------------------------------------------------
  // Post-meeting — Fathom link, host checklist, summary, complete close
  // -------------------------------------------------------------------------

  async "POST /api/meetings/:id/fathom"(params: HandlerParams) {
    const body = params.body as { url?: string; submittedById?: string };
    if (!body?.url || !body?.submittedById) {
      return {
        status:  400,
        error:   "VALIDATION_ERROR",
        message: "url and submittedById are required",
      };
    }
    try {
      const meeting = await submitFathomLink(
        params.params.id,
        body.url,
        body.submittedById,
      );
      return { meeting };
    } catch (err) {
      if (err instanceof MeetingNotFoundError) {
        return { status: 404, error: "NOT_FOUND", message: err.message };
      }
      if (err instanceof InvalidFathomLinkError) {
        return { status: 400, error: "INVALID_FATHOM_LINK", message: err.message };
      }
      throw err;
    }
  },

  async "GET /api/meetings/:id/host-checklist"(params: HandlerParams) {
    try {
      const checklist = await getHostChecklist(params.params.id);
      return { checklist };
    } catch (err) {
      if (err instanceof MeetingNotFoundError) {
        return { status: 404, error: "NOT_FOUND", message: err.message };
      }
      throw err;
    }
  },

  async "GET /api/meetings/:id/summary"(params: HandlerParams) {
    try {
      const summary = await generateMeetingSummary(params.params.id);
      return { summary };
    } catch (err) {
      if (err instanceof MeetingNotFoundError) {
        return { status: 404, error: "NOT_FOUND", message: err.message };
      }
      throw err;
    }
  },

  async "POST /api/meetings/:id/complete"(params: HandlerParams) {
    try {
      const result = await completeMeetingClose(params.params.id);
      return result;
    } catch (err) {
      if (err instanceof MeetingNotFoundError) {
        return { status: 404, error: "NOT_FOUND", message: err.message };
      }
      if (err instanceof MeetingStatusTransitionError) {
        return {
          status:  400,
          error:   "INVALID_STATUS_TRANSITION",
          message: err.message,
        };
      }
      if (err instanceof HostChecklistIncompleteError) {
        return {
          status:  400,
          error:   "HOST_CHECKLIST_INCOMPLETE",
          message: err.message,
          missing: err.missing,
        };
      }
      throw err;
    }
  },

  async "POST /api/meetings/:id/rate"(params: HandlerParams) {
    const body = params.body as {
      memberId?: string;
      rating?:   number;
      reason?:   string | null;
    };
    if (!body?.memberId || typeof body?.rating !== "number") {
      return {
        status:  400,
        error:   "VALIDATION_ERROR",
        message: "memberId and rating are required",
      };
    }
    try {
      const rating = await submitMeetingRating({
        meetingId: params.params.id,
        memberId:  body.memberId,
        rating:    body.rating,
        reason:    body.reason ?? null,
      });
      return { rating };
    } catch (err) {
      if (err instanceof MeetingNotFoundError) {
        return { status: 404, error: "NOT_FOUND", message: err.message };
      }
      if (err instanceof InvalidRatingError) {
        return { status: 400, error: "INVALID_RATING", message: err.message };
      }
      throw err;
    }
  },

  async "GET /api/meetings/:id/ratings"(params: HandlerParams) {
    const ratings = await listMeetingRatings(params.params.id);
    return { ratings };
  },

  async "GET /api/teams/:id/fathom-links"(params: HandlerParams) {
    const links = await listFathomLinksByTeam(params.params.id);
    return { links };
  },

};
