/**
 * EOS Pulse — Headlines Handler
 *
 * HTTP route definitions for pre-meeting headlines.
 *
 * Rules:
 *  - Import only from domain/headlines.domain.ts
 *  - No db or schema imports
 *  - No business logic — delegate everything to domain
 *  - No imports from other handlers
 */

import type { HandlerParams } from "@mspbots/type";
import {
  escalateHeadlineToIDS,
  getMeetingHeadlines,
  submitHeadline,
  HeadlineAlreadyEscalatedError,
  HeadlineContentRequiredError,
  HeadlineNotFoundError,
  InvalidHeadlineCategoryError,
  MeetingNotFoundError,
} from "../domain/headlines.domain.ts";
import type { HeadlineCategory } from "../domain/headlines.domain.ts";

export const headlinesHandler = {

  async "POST /api/meetings/:id/headlines"(params: HandlerParams) {
    const meetingId = params.params.id;
    const body = params.body as {
      submitterId?: string;
      category:     string;
      content:      string;
    };

    const submitterId = body.submitterId ?? (params.user?.["id"] as string | undefined);
    if (!submitterId) {
      return { error: "VALIDATION_ERROR", message: "submitterId is required" };
    }
    if (!body.category || !body.content) {
      return {
        error:   "VALIDATION_ERROR",
        message: "category and content are required",
      };
    }

    try {
      const headline = await submitHeadline(
        submitterId,
        meetingId,
        body.category as HeadlineCategory,
        body.content,
      );
      return { headline };
    } catch (err) {
      if (err instanceof InvalidHeadlineCategoryError) {
        return { error: "INVALID_CATEGORY", message: err.message };
      }
      if (err instanceof HeadlineContentRequiredError) {
        return { error: "VALIDATION_ERROR", message: err.message };
      }
      throw err;
    }
  },

  async "GET /api/meetings/:id/headlines"(params: HandlerParams) {
    const items = await getMeetingHeadlines(params.params.id);
    return { items, total: items.length };
  },

  async "POST /api/meetings/:id/headlines/:headlineId/escalate"(params: HandlerParams) {
    const meetingId  = params.params.id;
    const headlineId = params.params.headlineId;
    try {
      const result = await escalateHeadlineToIDS(headlineId, meetingId);
      return result;
    } catch (err) {
      if (err instanceof HeadlineNotFoundError || err instanceof MeetingNotFoundError) {
        return { error: "NOT_FOUND", message: err.message };
      }
      if (err instanceof HeadlineAlreadyEscalatedError) {
        return { error: "ALREADY_ESCALATED", message: err.message };
      }
      throw err;
    }
  },

};
