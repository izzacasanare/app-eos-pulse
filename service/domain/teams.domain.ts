/**
 * EOS Pulse — Teams Domain
 *
 * Business logic for MSPBots internal team management.
 * The 6 canonical teams are seeded via GET /api/seed.
 *
 * Imports allowed: db, schema
 * Imports forbidden: handlers/, HTTP context, raw fetch()
 */

import { asc, eq } from "drizzle-orm";
import { db } from "../db.ts";
import { teams } from "../schema.ts";
import type { Team } from "../schema.ts";

export type TeamType = "l10" | "quarterly" | "both";

export interface CreateTeamInput {
  name: string;
  type: TeamType;
}

// ---------------------------------------------------------------------------
// Domain functions
// ---------------------------------------------------------------------------

export async function getAllTeams(): Promise<Team[]> {
  return db.select().from(teams).orderBy(asc(teams.name));
}

export async function getTeamById(id: string): Promise<Team | null> {
  const rows = await db.select().from(teams).where(eq(teams.id, id));
  return rows[0] ?? null;
}

export async function createTeam(input: CreateTeamInput): Promise<Team> {
  const rows = await db
    .insert(teams)
    .values({ name: input.name, type: input.type })
    .returning();
  return rows[0];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class TeamNotFoundError extends Error {
  constructor(id: string) {
    super(`Team '${id}' not found.`);
    this.name = "TeamNotFoundError";
  }
}
