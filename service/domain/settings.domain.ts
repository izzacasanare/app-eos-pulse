/**
 * EOS Pulse — Settings Domain
 *
 * Key-value configuration store backed by the settings table.
 * Used by: clickup-sync.domain.ts, nudges.domain.ts
 *
 * Imports allowed: db, schema
 * Imports forbidden: handlers/, HTTP context, raw fetch()
 */

import { eq } from "drizzle-orm";
import { db } from "../db.ts";
import { settings } from "../schema.ts";
import type { Setting } from "../schema.ts";

// ---------------------------------------------------------------------------
// Known setting keys (single source of truth)
// ---------------------------------------------------------------------------

export const SETTING_KEYS = {
  CLICKUP_API_KEY:       "CLICKUP_API_KEY",
  CLICKUP_IDS_LIST_ID:   "CLICKUP_IDS_LIST_ID",
  CLICKUP_ROCKS_LIST_ID: "CLICKUP_ROCKS_LIST_ID",
  CLICKUP_TODOS_LIST_ID: "CLICKUP_TODOS_LIST_ID",
  IDS_SYNC_ENABLED:      "IDS_SYNC_ENABLED",
  ROCKS_SYNC_ENABLED:    "ROCKS_SYNC_ENABLED",
  TODOS_SYNC_ENABLED:    "TODOS_SYNC_ENABLED",
  TEAMS_WEBHOOK_URL:     "TEAMS_WEBHOOK_URL",
} as const;

export type SettingKey = typeof SETTING_KEYS[keyof typeof SETTING_KEYS];

// ---------------------------------------------------------------------------
// Domain functions
// ---------------------------------------------------------------------------

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key));
  return row?.value ?? null;
}

export async function getAllSettings(): Promise<Record<string, string | null>> {
  const rows = await db.select().from(settings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value ?? null]));
}

export async function setSetting(
  key: string,
  value: string | null,
): Promise<Setting> {
  const [row] = await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() },
    })
    .returning();
  return row;
}

export async function setSettings(
  kv: Record<string, string | null>,
): Promise<void> {
  for (const [key, value] of Object.entries(kv)) {
    await setSetting(key, value);
  }
}

/** Returns true if a boolean setting key is stored as "true". */
export async function isEnabled(key: string): Promise<boolean> {
  const val = await getSetting(key);
  return val === "true";
}
