/**
 * EOS Pulse — Todos Domain
 *
 * Business logic for meeting to-dos and standalone action items.
 *
 * Rules enforced here:
 *  - assignedToId is required
 *  - completedAt-style transitions go through dedicated functions, never PATCH
 *  - Pre-meeting status updates set updatedAt; getMeetingTodos uses that to
 *    flag todos that haven't been touched within 1hr of the meeting
 *
 * Imports allowed: db, schema, other domain files
 * Imports forbidden: handlers/, HTTP context, raw fetch()
 */

import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db.ts";
import { meetings, todos } from "../schema.ts";
import type { Todo } from "../schema.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TodoStatus = "open" | "done" | "blocked" | "carried";

export const TODO_STATUSES: readonly TodoStatus[] = [
  "open",
  "done",
  "blocked",
  "carried",
] as const;

export const NOT_UPDATED_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export interface CreateTodoInput {
  title:      string;
  ownerId:    string;
  meetingId?: string;
  dueDate?:   string;   // 'YYYY-MM-DD'
}

export interface UpdateTodoStatusInput {
  status: TodoStatus;
  reason?: string;
  userId: string;
}

export interface MeetingTodoRow {
  todo:       Todo;
  notUpdated: boolean;   // true when updatedAt is older than (meeting - 1hr)
}

// ---------------------------------------------------------------------------
// Domain functions
// ---------------------------------------------------------------------------

export async function listTodos(_filters: Record<string, unknown>) {
  // TODO: query db.todos with filters
  void db;
  return { items: [], total: 0 };
}

export async function getTodoById(id: string): Promise<Todo | null> {
  const [row] = await db.select().from(todos).where(eq(todos.id, id));
  return row ?? null;
}

export async function createTodo(_input: CreateTodoInput) {
  // TODO: insert into todos with status = 'open'
  return null;
}

export async function updateTodo(_id: string, _patch: Record<string, unknown>) {
  // TODO: update title, dueDate, ownerId — never status directly
  return null;
}

/**
 * Update a todo's status from the pre-meeting flow.
 *
 * Marks the todo's `updatedAt` so getMeetingTodos can identify which todos
 * have been refreshed before the meeting. `reason` is stored in
 * `carryOverReason` when status === 'carried' or 'blocked' (the schema's
 * existing free-text slot for non-completion explanations).
 */
export async function updateTodoStatus(
  todoId: string,
  input:  UpdateTodoStatusInput,
): Promise<Todo> {
  if (!TODO_STATUSES.includes(input.status)) {
    throw new InvalidTodoStatusError(input.status);
  }

  const todo = await getTodoById(todoId);
  if (!todo) throw new TodoNotFoundError(todoId);

  const set: Record<string, unknown> = {
    status:    input.status,
    updatedAt: new Date(),
  };

  // Persist the reason in carryOverReason for non-done states; clear on done.
  if (input.reason !== undefined) {
    set.carryOverReason = input.status === "done" ? null : input.reason.trim() || null;
  }

  // Touch acknowledgedAt so we can audit who confirmed this status.
  if (input.status !== "open") {
    set.acknowledgedAt = new Date();
  }

  // Reference userId to avoid unused-warning; richer audit lives in a future history table.
  void input.userId;

  const [updated] = await db
    .update(todos)
    .set(set)
    .where(eq(todos.id, todoId))
    .returning();
  return updated;
}

export async function completeTodo(_id: string) {
  // TODO:
  // 1. Load todo, verify status === 'open'
  // 2. Set status = 'done', acknowledgedAt = now()
  return null;
}

export async function dropTodo(_id: string) {
  // TODO: Set status = 'carried' with reason
  return null;
}

export async function deleteTodo(_id: string) {
  // TODO: admin only
  return null;
}

export async function listOverdueTodos() {
  // TODO: query todos where status = 'open' AND dueDate < today
  return [];
}

/**
 * Returns the open todos linked to the meeting's team for pre-meeting review.
 *
 * Each row carries a `notUpdated` flag: true when the todo's updatedAt is
 * older than `meeting.scheduledAt - 1 hour`, i.e. the owner hasn't refreshed
 * its status as part of pre-meeting prep.
 */
export async function getMeetingTodos(
  meetingId: string,
): Promise<MeetingTodoRow[]> {
  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId));
  if (!meeting) throw new MeetingNotFoundError(meetingId);

  // Open todos: either explicitly attached to this meeting, or open for the team.
  const openTodos = await db
    .select()
    .from(todos)
    .where(
      and(
        eq(todos.teamId, meeting.teamId),
        inArray(todos.status, ["open", "blocked", "carried"]),
      ),
    );

  const cutoff = new Date(
    new Date(meeting.scheduledAt).getTime() - NOT_UPDATED_WINDOW_MS,
  );

  return openTodos.map((todo) => ({
    todo,
    notUpdated: new Date(todo.updatedAt) < cutoff,
  }));
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class TodoAlreadyClosedError extends Error {
  constructor(status: TodoStatus) {
    super(`Cannot modify a todo with status '${status}'.`);
    this.name = "TodoAlreadyClosedError";
  }
}

export class TodoNotFoundError extends Error {
  constructor(id: string) {
    super(`Todo '${id}' not found.`);
    this.name = "TodoNotFoundError";
  }
}

export class InvalidTodoStatusError extends Error {
  constructor(status: string) {
    super(
      `Invalid todo status '${status}'. Allowed: ${TODO_STATUSES.join(", ")}.`,
    );
    this.name = "InvalidTodoStatusError";
  }
}

export class MeetingNotFoundError extends Error {
  constructor(id: string) {
    super(`Meeting '${id}' not found.`);
    this.name = "MeetingNotFoundError";
  }
}
