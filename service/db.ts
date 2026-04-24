/**
 * EOS Pulse — Database Singleton
 *
 * Exports a single Drizzle client instance.
 * Import only from domain/ files — never from handlers/ or server.ts.
 *
 * Requires: DATABASE_URL environment variable
 */

// TODO: Add drizzle-orm and postgres driver to deno.json imports
// import { drizzle } from "drizzle-orm/postgres-js";
// import postgres from "postgres";

const DATABASE_URL = Deno.env.get("DATABASE_URL");

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required. Add it to your .env file.\n" +
    "Example: DATABASE_URL=postgres://user:password@localhost:5432/eos_pulse"
  );
}

// TODO: Uncomment once drizzle-orm is added to deno.json
// const client = postgres(DATABASE_URL);
// export const db = drizzle(client);

// Placeholder export — replace with Drizzle instance
export const db = {
  _url: DATABASE_URL,
  _ready: false,
  _note: "Replace this placeholder with: drizzle(postgres(DATABASE_URL))",
} as const;

export type Database = typeof db;
