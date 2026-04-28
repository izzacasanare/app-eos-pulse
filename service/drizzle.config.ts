/**
 * EOS Pulse — Drizzle Kit Config
 *
 * Used by: mspbots generate / mspbots dev (migration generation + sync)
 * Schema:  service/schema.ts
 * Output:  service/drizzle/  (SQL migrations + journal)
 *
 * All tables live in pgSchema(APP_ID) — never public.
 */

import { defineConfig } from "drizzle-kit";

const APP_ID = "m4mom3q0m8bw2p9w93urcjeb9x2y4dna";

export default defineConfig({
  schema:  "./schema.ts",
  out:     "./drizzle",
  dialect: "postgresql",

  dbCredentials: {
    host:     "20.241.40.252",
    port:     15432,
    database: "mb_app_agentint",
    user:     `user_${APP_ID}`,
    password: `pass_${APP_ID}`,
    ssl:      false,
  },

  // Scope migrations to our app's schema only — never touch public
  schemaFilter: [APP_ID],
});
