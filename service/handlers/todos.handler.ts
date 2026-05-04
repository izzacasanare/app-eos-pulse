/**
 * EOS Pulse — Todos Handler
 *
 * HTTP route definitions for the todos domain.
 * Translates HTTP requests → domain calls → HTTP responses.
 *
 * Rules:
 *  - Import only from domain/todos.domain.ts
 *  - No db or schema imports
 *  - No business logic — delegate everything to domain
 *  - No imports from other handlers
 */

import type { HandlerParams } from "@mspbots/type";
import {
  listTodos,
  getTodoById,
  createTodo,
  updateTodo,
  completeTodo,
  dropTodo,
  deleteTodo,
  updateTodoStatus,
  getMeetingTodos,
  InvalidTodoStatusError,
  MeetingNotFoundError,
  TodoAlreadyClosedError,
  TodoNotFoundError,
} from "../domain/todos.domain.ts";
import type { TodoStatus } from "../domain/todos.domain.ts";

export const todosHandler = {

  async "GET /api/todos"(params: HandlerParams) {
    const result = await listTodos(params.query ?? {});
    return result;
  },

  async "GET /api/todos/:id"(params: HandlerParams) {
    const todo = await getTodoById(params.params.id);
    if (!todo) return { error: "NOT_FOUND", message: "Todo not found" };
    return { todo };
  },

  async "POST /api/todos"(params: HandlerParams) {
    const body = params.body as {
      title: string;
      ownerId?: string;
      meetingId?: string;
      dueDate?: string;
    };
    const todo = await createTodo({
      title: body.title,
      ownerId: body.ownerId ?? params.user?.["id"] as string,
      meetingId: body.meetingId,
      dueDate: body.dueDate,
    });
    return { todo };
  },

  async "PATCH /api/todos/:id"(params: HandlerParams) {
    const patch = params.body as Record<string, unknown>;
    const todo = await updateTodo(params.params.id, patch);
    if (!todo) return { error: "NOT_FOUND", message: "Todo not found" };
    return { todo };
  },

  async "POST /api/todos/:id/status"(params: HandlerParams) {
    const body = params.body as {
      status:  string;
      reason?: string;
      userId?: string;
    };
    const userId = body.userId ?? (params.user?.["id"] as string | undefined);
    if (!userId) {
      return { status: 400, error: "VALIDATION_ERROR", message: "userId is required" };
    }
    if (!body.status) {
      return { status: 400, error: "VALIDATION_ERROR", message: "status is required" };
    }
    try {
      const todo = await updateTodoStatus(params.params.id, {
        status: body.status as TodoStatus,
        reason: body.reason,
        userId,
      });
      return { todo };
    } catch (err) {
      if (err instanceof InvalidTodoStatusError) {
        return { status: 400, error: "INVALID_STATUS", message: err.message };
      }
      if (err instanceof TodoNotFoundError) {
        return { status: 404, error: "NOT_FOUND", message: err.message };
      }
      throw err;
    }
  },

  async "GET /api/meetings/:id/todos"(params: HandlerParams) {
    try {
      const items = await getMeetingTodos(params.params.id);
      return { items, total: items.length };
    } catch (err) {
      if (err instanceof MeetingNotFoundError) {
        return { error: "NOT_FOUND", message: err.message };
      }
      throw err;
    }
  },

  async "POST /api/todos/:id/complete"(params: HandlerParams) {
    try {
      const todo = await completeTodo(params.params.id);
      return { todo };
    } catch (err) {
      if (err instanceof TodoAlreadyClosedError) {
        return { error: "ALREADY_CLOSED", message: err.message };
      }
      throw err;
    }
  },

  async "POST /api/todos/:id/drop"(params: HandlerParams) {
    try {
      const todo = await dropTodo(params.params.id);
      return { todo };
    } catch (err) {
      if (err instanceof TodoAlreadyClosedError) {
        return { error: "ALREADY_CLOSED", message: err.message };
      }
      throw err;
    }
  },

  async "DELETE /api/todos/:id"(params: HandlerParams) {
    // TODO: verify admin role from params.user
    await deleteTodo(params.params.id);
    return null;
  },

};
