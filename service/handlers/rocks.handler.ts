/**
 * EOS Pulse — Rocks Handler
 *
 * HTTP route definitions for the rocks domain.
 * Translates HTTP requests → domain calls → HTTP responses.
 *
 * Rules:
 *  - Import only from domain/rocks.domain.ts
 *  - No db or schema imports
 *  - No business logic — delegate everything to domain
 *  - No imports from other handlers
 */

import type { HandlerParams } from "@mspbots/type";
import {
  listRocks,
  getRockById,
  getRockHistory,
  createRock,
  updateRock,
  updateRockStatus,
  deleteRock,
  InvalidQuarterFormatError,
  RockHasHistoryError,
} from "../domain/rocks.domain.ts";

export const rocksHandler = {

  async "GET /api/rocks"(params: HandlerParams) {
    const result = await listRocks(params.query ?? {});
    return result;
  },

  async "GET /api/rocks/:id"(params: HandlerParams) {
    const rock = await getRockById(params.params.id);
    if (!rock) return { error: "NOT_FOUND", message: "Rock not found" };
    return { rock };
  },

  async "GET /api/rocks/:id/history"(params: HandlerParams) {
    const history = await getRockHistory(params.params.id);
    return { history };
  },

  async "POST /api/rocks"(params: HandlerParams) {
    const body = params.body as {
      ownerId: string;
      teamId: string;
      title: string;
      description?: string;
      quarter: string;
      dueDate: string;
    };
    try {
      const rock = await createRock({
        ownerId: body.ownerId,
        teamId: body.teamId,
        title: body.title,
        description: body.description,
        quarter: body.quarter,
        dueDate: body.dueDate,
      });
      return { rock };
    } catch (err) {
      if (err instanceof InvalidQuarterFormatError) {
        return { error: "INVALID_QUARTER_FORMAT", message: err.message };
      }
      throw err;
    }
  },

  async "PATCH /api/rocks/:id"(params: HandlerParams) {
    const patch = params.body as Record<string, unknown>;
    const rock = await updateRock(params.params.id, patch);
    if (!rock) return { error: "NOT_FOUND", message: "Rock not found" };
    return { rock };
  },

  async "POST /api/rocks/:id/status"(params: HandlerParams) {
    const body = params.body as { status: string; note?: string };
    const changedBy = params.user?.["id"] as string;
    const result = await updateRockStatus(params.params.id, {
      status: body.status as "on_track" | "off_track" | "complete" | "dropped",
      note: body.note,
      changedBy,
    });
    return result;
  },

  async "DELETE /api/rocks/:id"(params: HandlerParams) {
    // TODO: verify admin role from params.user
    try {
      await deleteRock(params.params.id);
      return null;
    } catch (err) {
      if (err instanceof RockHasHistoryError) {
        return { error: "ROCK_HAS_HISTORY", message: err.message };
      }
      throw err;
    }
  },

};
