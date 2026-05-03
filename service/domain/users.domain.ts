/**
 * EOS Pulse — Users Domain
 *
 * Business logic for MSPBots staff management.
 * Users are provisioned by Super Admins — no self-registration.
 *
 * Imports allowed: db, schema
 * Imports forbidden: handlers/, HTTP context, raw fetch()
 */

import { asc, eq } from "drizzle-orm";
import { db } from "../db.ts";
import { users } from "../schema.ts";
import type { User } from "../schema.ts";

export type UserRole =
  | "super_admin"
  | "leadership"
  | "team_lead"
  | "host"
  | "member";

export interface CreateUserInput {
  name:    string;
  email:   string;
  role:    UserRole;
  teamId?: string;
}

export interface UpdateUserInput {
  name?:   string;
  role?:   UserRole;
  teamId?: string | null;
}

// ---------------------------------------------------------------------------
// Domain functions
// ---------------------------------------------------------------------------

export async function getAllUsers(): Promise<User[]> {
  return db.select().from(users).orderBy(asc(users.name));
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id));
  return rows[0] ?? null;
}

export async function getUsersByTeam(teamId: string): Promise<User[]> {
  return db
    .select()
    .from(users)
    .where(eq(users.teamId, teamId))
    .orderBy(asc(users.name));
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.email, email));
  return rows[0] ?? null;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const existing = await getUserByEmail(input.email);
  if (existing) throw new UserEmailConflictError(input.email);

  const rows = await db
    .insert(users)
    .values({
      name:   input.name,
      email:  input.email,
      role:   input.role,
      teamId: input.teamId ?? null,
    })
    .returning();
  return rows[0];
}

export async function updateUser(
  id: string,
  patch: UpdateUserInput,
): Promise<User> {
  const existing = await getUserById(id);
  if (!existing) throw new UserNotFoundError(id);

  const rows = await db
    .update(users)
    .set({
      ...(patch.name   !== undefined && { name:   patch.name }),
      ...(patch.role   !== undefined && { role:   patch.role }),
      ...(patch.teamId !== undefined && { teamId: patch.teamId }),
    })
    .where(eq(users.id, id))
    .returning();
  return rows[0];
}

/** Returns the typed role enum for a user. */
export function getUserRole(user: User): UserRole {
  return user.role as UserRole;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class UserNotFoundError extends Error {
  constructor(id: string) {
    super(`User '${id}' not found.`);
    this.name = "UserNotFoundError";
  }
}

export class UserEmailConflictError extends Error {
  constructor(email: string) {
    super(`A user with email '${email}' already exists.`);
    this.name = "UserEmailConflictError";
  }
}
