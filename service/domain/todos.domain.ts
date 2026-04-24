/**
 * EOS Pulse — Todos Domain
 *
 * Business logic for meeting to-dos and standalone action items.
 *
 * Rules enforced here:
 *  - ownerId is required
 *  - completedAt is set automatically; not accepted from client
 *
 * Imports allowed: db, schema, other domain files
 * Imports forbidden: handlers/, HTTP context, raw fetch()
 */

import { db } from "../db.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TodoStatus = "open" | "complete" | "dropped";

export interface CreateTodoInput {
  title:      string;
  ownerId:    string;
  meetingId?: string;
  dueDate?:   string;   // 'YYYY-MM-DD'
}

// ---------------------------------------------------------------------------
// Domain functions (stubbed — implement in Step 05)
// ---------------------------------------------------------------------------

export async function listTodos(_filters: Record<string, unknown>) {
  // TODO: query db.todos with filters
  // Supports: meetingId, ownerId, status, overdue (past dueDate + still open)
  void db;
  return { items: [], total: 0 };
}

export async function getTodoById(_id: string) {
  // TODO: query db.todos
  return null;
}

export async function createTodo(_input: CreateTodoInput) {
  // TODO: insert into todos with status = 'open'
  return null;
}

export async function updateTodo(_id: string, _patch: Record<string, unknown>) {
  // TODO: update title, dueDate, ownerId — never status directly
  return null;
}

export async function completeTodo(_id: string) {
  // TODO:
  // 1. Load todo, verify status === 'open'
  // 2. Set status = 'complete', completedAt = now()
  return null;
}

export async function dropTodo(_id: string) {
  // TODO: Set status = 'dropped'
  return null;
}

export async function deleteTodo(_id: string) {
  // TODO: admin only
  return null;
}

export async function listOverdueTodos() {
  // TODO: query todos where status = 'open' AND dueDate < today
  // Used by nudges.domain.ts to generate accountability nudges
  return [];
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
