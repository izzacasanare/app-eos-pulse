/**
 * EOS Pulse — Database Singleton
 *
 * Single Drizzle + postgres.js client instance.
 * Import from domain/ files only — never from handlers/ or server.ts.
 *
 * Connection uses direct config (not a URL string).
 * Credentials fall back to env vars; hard defaults are the known dev values.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

const APP_ID = "m4mom3q0m8bw2p9w93urcjeb9x2y4dna";

const client = postgres({
  host:     Deno.env.get("DB_HOST")     ?? "20.241.40.252",
  port:     parseInt(Deno.env.get("DB_PORT") ?? "15432"),
  database: Deno.env.get("DB_NAME")     ?? "mb_app_agentint",
  username: Deno.env.get("DB_USER")     ?? `user_${APP_ID}`,
  password: Deno.env.get("DB_PASSWORD") ?? `pass_${APP_ID}`,
  ssl:      false,
  max:      10,
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
