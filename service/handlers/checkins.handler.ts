/**
 * EOS Pulse — Check-ins Handler
 *
 * HTTP route definitions for pre-meeting check-ins.
 *
 * Rules:
 *  - Import only from domain/checkins.domain.ts
 *  - No db or schema imports
 *  - No business logic — delegate everything to domain
 *  - No imports from other handlers
 */

import type { HandlerParams } from "@mspbots/type";
import {
  getMeetingCheckins,
  submitCheckin,
  MeetingNotFoundError,
} from "../domain/checkins.domain.ts";

export const checkinsHandler = {

  async "POST /api/meetings/:id/checkin"(params: HandlerParams) {
    const meetingId = params.params.id;
    const body = params.body as {
      memberId?:             string;
      personalGoodNews?:     string | null;
      professionalGoodNews?: string | null;
    };

    const memberId = body.memberId ?? (params.user?.["id"] as string | undefined);
    if (!memberId) {
      return { error: "VALIDATION_ERROR", message: "memberId is required" };
    }

    const checkin = await submitCheckin(
      memberId,
      meetingId,
      body.personalGoodNews     ?? null,
      body.professionalGoodNews ?? null,
    );
    return { checkin };
  },

  async "GET /api/meetings/:id/checkins"(params: HandlerParams) {
    try {
      const result = await getMeetingCheckins(params.params.id);
      return result;
    } catch (err) {
      if (err instanceof MeetingNotFoundError) {
        return { error: "NOT_FOUND", message: err.message };
      }
      throw err;
    }
  },

};
