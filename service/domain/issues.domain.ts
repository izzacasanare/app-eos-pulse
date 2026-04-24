/**
 * EOS Pulse — Issues Domain
 *
 * Business logic for IDS (Identify, Discuss, Solve) workflow.
 *
 * Rules enforced here:
 *  - resolution_notes must be ≥ 50 characters before status can be set to 'resolved'
 *  - Status transitions follow IDS flow
 *
 * Imports allowed: db, schema, other domain files
 * Imports forbidden: handlers/, HTTP context, raw fetch()
 */

import { db } from "../db.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IssueStatus   = "open" | "ids_in_progress" | "resolved" | "dropped";
export type IssuePriority = "low" | "medium" | "high";

export const RESOLUTION_NOTES_MIN_LENGTH = 50;

export interface CreateIssueInput {
  teamId:      string;
  title:       string;
  description?: string;
  priority?:   IssuePriority;
  meetingId?:  string;
  ownerId:     string;
}

export interface ResolveIssueInput {
  resolutionNotes: string;
}

// ---------------------------------------------------------------------------
// Domain functions (stubbed — implement in Step 05)
// ---------------------------------------------------------------------------

export async function listIssues(_filters: Record<string, unknown>) {
  // TODO: query db.issues with filters
  void db;
  return { items: [], total: 0 };
}

export async function getIssueById(_id: string) {
  // TODO: query db.issues
  return null;
}

export async function createIssue(_input: CreateIssueInput) {
  // TODO: insert into issues with status = 'open'
  return null;
}

export async function updateIssue(_id: string, _patch: Record<string, unknown>) {
  // TODO: update title, description, priority, ownerId — never status directly
  return null;
}

export async function startIds(_id: string) {
  // TODO:
  // 1. Load issue, verify status === 'open'
  // 2. Set status = 'ids_in_progress'
  return null;
}

export async function resolveIssue(_id: string, input: ResolveIssueInput) {
  // TODO:
  // 1. Validate resolutionNotes.length >= RESOLUTION_NOTES_MIN_LENGTH
  //    → throw ResolutionNotesTooShortError if not
  // 2. Set status = 'resolved', resolvedAt = now(), resolutionNotes = input.resolutionNotes
  void input;
  return null;
}

export async function dropIssue(_id: string, _note?: string) {
  // TODO: Set status = 'dropped'
  return null;
}

export async function deleteIssue(_id: string) {
  // TODO: admin only, cannot delete ids_in_progress issues
  return null;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ResolutionNotesTooShortError extends Error {
  constructor(public readonly currentLength: number) {
    super(
      `Resolution notes must be at least ${RESOLUTION_NOTES_MIN_LENGTH} characters. ` +
      `Received: ${currentLength}.`
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
