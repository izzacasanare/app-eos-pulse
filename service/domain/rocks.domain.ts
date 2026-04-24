/**
 * EOS Pulse — Rocks Domain
 *
 * Business logic for quarterly Rocks and status history.
 *
 * Rules enforced here:
 *  - Every status change appends a row to rock_status_history (append-only)
 *  - ownerId is required
 *  - quarter must match Q[1-4]-YYYY format
 *
 * Imports allowed: db, schema, other domain files
 * Imports forbidden: handlers/, HTTP context, raw fetch()
 */

import { db } from "../db.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RockStatus = "on_track" | "off_track" | "complete" | "dropped";

export const QUARTER_PATTERN = /^Q[1-4]-\d{4}$/;

export interface CreateRockInput {
  ownerId:      string;
  teamId:       string;
  title:        string;
  description?: string;
  quarter:      string;   // e.g. 'Q2-2025'
  dueDate:      string;   // 'YYYY-MM-DD'
}

export interface UpdateRockStatusInput {
  status: RockStatus;
  note?:  string;
  changedBy: string;  // user id performing the change
}

// ---------------------------------------------------------------------------
// Domain functions (stubbed — implement in Step 05)
// ---------------------------------------------------------------------------

export async function listRocks(_filters: Record<string, unknown>) {
  // TODO: query db.rocks with filters
  void db;
  return { items: [], total: 0 };
}

export async function getRockById(_id: string) {
  // TODO: query db.rocks
  return null;
}

export async function getRockHistory(_rockId: string) {
  // TODO: query db.rockStatusHistory ordered by changedAt ASC
  return [];
}

export async function createRock(_input: CreateRockInput) {
  // TODO:
  // 1. Validate quarter matches QUARTER_PATTERN
  // 2. Insert into rocks with status = 'on_track'
  return null;
}

export async function updateRock(_id: string, _patch: Record<string, unknown>) {
  // TODO: update title, description, dueDate — never status
  return null;
}

export async function updateRockStatus(_id: string, input: UpdateRockStatusInput) {
  // TODO:
  // 1. Load current rock, capture previousStatus
  // 2. Update rocks.status = input.status
  // 3. INSERT into rock_status_history (append-only, no updates/deletes)
  // 4. Return { rock, historyEntry }
  void input;
  return null;
}

export async function deleteRock(_id: string) {
  // TODO: admin only, cannot delete if history entries exist
  return null;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class InvalidQuarterFormatError extends Error {
  constructor(quarter: string) {
    super(`Invalid quarter format: '${quarter}'. Expected Q[1-4]-YYYY (e.g. Q2-2025).`);
    this.name = "InvalidQuarterFormatError";
  }
}

export class RockHasHistoryError extends Error {
  constructor() {
    super("Cannot hard-delete a rock with status history. Use 'dropped' status instead.");
    this.name = "RockHasHistoryError";
  }
}
