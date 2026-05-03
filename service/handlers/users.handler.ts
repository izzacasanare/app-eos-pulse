/**
 * EOS Pulse — Users & Teams Handler
 *
 * HTTP route definitions for the users and teams domains.
 * Translates HTTP → domain calls → HTTP responses.
 *
 * Rules:
 *  - Import only from domain/users.domain.ts and domain/teams.domain.ts
 *  - No db or schema imports
 *  - No business logic — delegate everything to domain
 *  - No imports from other handlers
 */

import type { HandlerParams } from "@mspbots/type";
import {
  getAllUsers,
  getUserById,
  getUsersByTeam,
  createUser,
  updateUser,
  UserNotFoundError,
  UserEmailConflictError,
} from "../domain/users.domain.ts";
import {
  getAllTeams,
  getTeamById,
  createTeam,
} from "../domain/teams.domain.ts";

// ---------------------------------------------------------------------------
// Seed data — DEV ONLY. Remove before v1 publish.
// ---------------------------------------------------------------------------

const SEED_TEAMS = [
  { name: "Leadership", type: "both" as const },
  { name: "Revenue",    type: "l10"  as const },
  { name: "CSM",        type: "l10"  as const },
  { name: "Operations", type: "l10"  as const },
  { name: "Product",    type: "l10"  as const },
  { name: "Dev",        type: "l10"  as const },
];

export const usersHandler = {

  // -------------------------------------------------------------------------
  // Seed (dev only)
  // -------------------------------------------------------------------------

  async "GET /api/seed"(_params: HandlerParams) {
    const existing = await getAllTeams();
    const existingNames = new Set(existing.map((t) => t.name));
    const created: string[] = [];

    for (const team of SEED_TEAMS) {
      if (!existingNames.has(team.name)) {
        await createTeam(team);
        created.push(team.name);
      }
    }

    const skipped = SEED_TEAMS.map((t) => t.name).filter((n) =>
      existingNames.has(n)
    );

    return { ok: true, created, skipped };
  },

  // -------------------------------------------------------------------------
  // Teams
  // -------------------------------------------------------------------------

  async "GET /api/teams"(_params: HandlerParams) {
    const teams = await getAllTeams();
    return { teams };
  },

  async "GET /api/teams/:id/members"(params: HandlerParams) {
    const team = await getTeamById(params.params.id);
    if (!team) return { error: "NOT_FOUND", message: "Team not found" };

    const members = await getUsersByTeam(params.params.id);
    return { team, members };
  },

  // -------------------------------------------------------------------------
  // Users
  // -------------------------------------------------------------------------

  /** List all users. Super Admin only — role enforced at platform auth layer. */
  async "GET /api/users"(_params: HandlerParams) {
    const users = await getAllUsers();
    return { users };
  },

  async "GET /api/users/:id"(params: HandlerParams) {
    const user = await getUserById(params.params.id);
    if (!user) return { error: "NOT_FOUND", message: "User not found" };
    return { user };
  },

  /** Create user. Super Admin only. */
  async "POST /api/users"(params: HandlerParams) {
    const body = params.body as {
      name:    string;
      email:   string;
      role:    string;
      teamId?: string;
    };

    if (!body?.name || !body?.email || !body?.role) {
      return {
        error:   "VALIDATION_ERROR",
        message: "name, email, and role are required",
      };
    }

    try {
      const user = await createUser({
        name:   body.name,
        email:  body.email,
        role:   body.role as
          | "super_admin"
          | "leadership"
          | "team_lead"
          | "host"
          | "member",
        teamId: body.teamId,
      });
      return { user };
    } catch (err) {
      if (err instanceof UserEmailConflictError) {
        return { error: "CONFLICT", message: err.message };
      }
      throw err;
    }
  },

  /** Update user role or team assignment. */
  async "PUT /api/users/:id"(params: HandlerParams) {
    const body = params.body as {
      name?:   string;
      role?:   string;
      teamId?: string | null;
    };

    try {
      const user = await updateUser(params.params.id, {
        name:   body?.name,
        role:   body?.role as
          | "super_admin"
          | "leadership"
          | "team_lead"
          | "host"
          | "member"
          | undefined,
        teamId: body?.teamId,
      });
      return { user };
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return { error: "NOT_FOUND", message: err.message };
      }
      throw err;
    }
  },

};
