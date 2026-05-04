/**
 * EOS Pulse — ClickUp Sync Domain
 *
 * Integration boundary between EOS Pulse and the ClickUp API v2.
 * Responsible for creating and updating ClickUp tasks that mirror
 * EOS Pulse issues, rocks, and to-dos during the migration period.
 *
 * Architecture note: this file intentionally uses native fetch() for
 * outbound HTTP calls to the ClickUp API. This is the ONLY domain file
 * permitted to use fetch(). All other domain files must not call fetch().
 *
 * Sync is gated by per-module boolean flags in the settings table:
 *   IDS_SYNC_ENABLED, ROCKS_SYNC_ENABLED, TODOS_SYNC_ENABLED
 *
 * Imports allowed: db, schema, settings.domain.ts
 * Imports forbidden: handlers/, HTTP context
 */

import { eq } from "drizzle-orm";
import { db } from "../db.ts";
import { issues, rocks, todos } from "../schema.ts";
import type { Issue, Rock, Todo } from "../schema.ts";
import { getSetting, isEnabled, SETTING_KEYS } from "./settings.domain.ts";

// ---------------------------------------------------------------------------
// ClickUp API helpers
// ---------------------------------------------------------------------------

const CLICKUP_API = "https://api.clickup.com/api/v2";

interface ClickUpTask {
  id:     string;
  name:   string;
  status: { status: string };
}

async function clickupHeaders(): Promise<HeadersInit> {
  const key = await getSetting(SETTING_KEYS.CLICKUP_API_KEY);
  if (!key) throw new ClickUpNotConfiguredError();
  return { Authorization: key, "Content-Type": "application/json" };
}

async function createTask(
  listId: string,
  payload: Record<string, unknown>,
): Promise<ClickUpTask> {
  const res = await fetch(`${CLICKUP_API}/list/${listId}/task`, {
    method:  "POST",
    headers: await clickupHeaders(),
    body:    JSON.stringify(payload),
  });
  if (!res.ok) throw new ClickUpSyncError(await res.text());
  return res.json() as Promise<ClickUpTask>;
}

async function updateTask(
  taskId: string,
  payload: Record<string, unknown>,
): Promise<ClickUpTask> {
  const res = await fetch(`${CLICKUP_API}/task/${taskId}`, {
    method:  "PUT",
    headers: await clickupHeaders(),
    body:    JSON.stringify(payload),
  });
  if (!res.ok) throw new ClickUpSyncError(await res.text());
  return res.json() as Promise<ClickUpTask>;
}

async function getTask(taskId: string): Promise<ClickUpTask> {
  const res = await fetch(`${CLICKUP_API}/task/${taskId}`, {
    headers: await clickupHeaders(),
  });
  if (!res.ok) throw new ClickUpSyncError(await res.text());
  return res.json() as Promise<ClickUpTask>;
}

// ---------------------------------------------------------------------------
// Status mappings
// ---------------------------------------------------------------------------

function issueStatusToClickUp(status: string): string {
  const map: Record<string, string> = {
    open:            "to do",
    assigned:        "to do",
    in_progress:     "in progress",
    pending_closure: "in review",
    closed:          "complete",
  };
  return map[status] ?? "to do";
}

function rockStatusToClickUp(status: string): string {
  const map: Record<string, string> = {
    on_track:  "in progress",
    off_track: "in progress",
    at_risk:   "in review",
    blocked:   "blocked",
    on_hold:   "on hold",
    completed: "complete",
  };
  return map[status] ?? "to do";
}

function todoStatusToClickUp(status: string): string {
  const map: Record<string, string> = {
    open:    "to do",
    done:    "complete",
    blocked: "blocked",
    carried: "to do",
  };
  return map[status] ?? "to do";
}

// ---------------------------------------------------------------------------
// Public sync functions
// ---------------------------------------------------------------------------

/**
 * Creates or updates a ClickUp task for an issue.
 * Returns the ClickUp task ID, or null if sync is disabled.
 * Stores clickup_task_id back on the issue if newly created.
 */
export async function syncIssueToClickUp(
  issue: Issue,
): Promise<string | null> {
  if (!(await isEnabled(SETTING_KEYS.IDS_SYNC_ENABLED))) return null;

  const listId = await getSetting(SETTING_KEYS.CLICKUP_IDS_LIST_ID);
  if (!listId) throw new ClickUpNotConfiguredError("IDS list ID not configured");

  const payload = {
    name:        issue.title,
    description: issue.description ?? "",
    status:      issueStatusToClickUp(issue.status),
    priority:    priorityToClickUp(issue.priority),
  };

  if (issue.clickupTaskId) {
    await updateTask(issue.clickupTaskId, payload);
    return issue.clickupTaskId;
  }

  const task = await createTask(listId, payload);
  await db
    .update(issues)
    .set({ clickupTaskId: task.id, updatedAt: new Date() })
    .where(eq(issues.id, issue.id));
  return task.id;
}

/**
 * Creates or updates a ClickUp task for a rock.
 * Returns the ClickUp task ID, or null if sync is disabled.
 */
export async function syncRockToClickUp(rock: Rock): Promise<string | null> {
  if (!(await isEnabled(SETTING_KEYS.ROCKS_SYNC_ENABLED))) return null;

  const listId = await getSetting(SETTING_KEYS.CLICKUP_ROCKS_LIST_ID);
  if (!listId) throw new ClickUpNotConfiguredError("Rocks list ID not configured");

  const payload = {
    name:   rock.title,
    status: rockStatusToClickUp(rock.status),
  };

  if (rock.clickupTaskId) {
    await updateTask(rock.clickupTaskId, payload);
    return rock.clickupTaskId;
  }

  const task = await createTask(listId, payload);
  await db
    .update(rocks)
    .set({ clickupTaskId: task.id, updatedAt: new Date() })
    .where(eq(rocks.id, rock.id));
  return task.id;
}

/**
 * Creates or updates a ClickUp task for a to-do.
 * Returns the ClickUp task ID, or null if sync is disabled.
 */
export async function syncTodoToClickUp(todo: Todo): Promise<string | null> {
  if (!(await isEnabled(SETTING_KEYS.TODOS_SYNC_ENABLED))) return null;

  const listId = await getSetting(SETTING_KEYS.CLICKUP_TODOS_LIST_ID);
  if (!listId) throw new ClickUpNotConfiguredError("To-dos list ID not configured");

  const payload: Record<string, unknown> = {
    name:   todo.title,
    status: todoStatusToClickUp(todo.status),
  };
  if (todo.dueDate) payload.due_date = new Date(todo.dueDate).getTime();

  if (todo.clickupTaskId) {
    await updateTask(todo.clickupTaskId, payload);
    return todo.clickupTaskId;
  }

  const task = await createTask(listId, payload);
  await db
    .update(todos)
    .set({ clickupTaskId: task.id, updatedAt: new Date() })
    .where(eq(todos.id, todo.id));
  return task.id;
}

/**
 * Fetches the current status string from ClickUp for a given task ID.
 * Returns null if the API key is not configured.
 */
export async function pullClickUpStatus(
  clickupTaskId: string,
): Promise<string | null> {
  const key = await getSetting(SETTING_KEYS.CLICKUP_API_KEY);
  if (!key) return null;

  const task = await getTask(clickupTaskId);
  return task.status?.status ?? null;
}

/**
 * Tests whether the stored ClickUp API key is valid.
 * Calls GET /team — a lightweight authenticated endpoint.
 */
export async function testClickUpConnection(): Promise<{
  ok:      boolean;
  error?:  string;
}> {
  const key = await getSetting(SETTING_KEYS.CLICKUP_API_KEY);
  if (!key) return { ok: false, error: "API key not configured" };

  try {
    const res = await fetch(`${CLICKUP_API}/team`, {
      headers: { Authorization: key },
    });
    if (!res.ok) {
      return { ok: false, error: `ClickUp returned ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function priorityToClickUp(priority: string): number {
  const map: Record<string, number> = {
    low:      4,
    medium:   3,
    high:     2,
    critical: 1,
  };
  return map[priority] ?? 3;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ClickUpNotConfiguredError extends Error {
  constructor(detail = "ClickUp API key is not configured") {
    super(detail);
    this.name = "ClickUpNotConfiguredError";
  }
}

export class ClickUpSyncError extends Error {
  constructor(detail: string) {
    super(`ClickUp sync failed: ${detail}`);
    this.name = "ClickUpSyncError";
  }
}
