/**
 * EOS Pulse — Settings Handler
 *
 * HTTP routes for app configuration (ClickUp sync, Teams webhook).
 * Also exposes ClickUp connection test via clickup-sync.domain.ts.
 *
 * Rules:
 *  - Import only from domain/settings.domain.ts and domain/clickup-sync.domain.ts
 *  - No db or schema imports
 *  - No business logic — delegate everything to domain
 *  - No imports from other handlers
 */

import type { HandlerParams } from "@mspbots/type";
import {
  getAllSettings,
  setSettings,
  SETTING_KEYS,
} from "../domain/settings.domain.ts";
import {
  testClickUpConnection,
  ClickUpNotConfiguredError,
} from "../domain/clickup-sync.domain.ts";

// Settings whose values must be masked in GET responses
const SECRET_KEYS = new Set<string>([SETTING_KEYS.CLICKUP_API_KEY]);

export const settingsHandler = {

  /**
   * Returns all settings. Secret values (API keys) are masked.
   * Auth: Admin only — enforced at platform auth layer.
   */
  async "GET /api/settings"(_params: HandlerParams) {
    const raw = await getAllSettings();
    const masked: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(raw)) {
      masked[k] = SECRET_KEYS.has(k) && v ? "••••••••" : v;
    }
    // Always surface known keys even if not yet set
    for (const key of Object.values(SETTING_KEYS)) {
      if (!(key in masked)) masked[key] = null;
    }
    return { settings: masked };
  },

  /**
   * Bulk-update settings. Accepts a flat key-value object.
   * Auth: Admin only.
   */
  async "PUT /api/settings"(params: HandlerParams) {
    const body = params.body as Record<string, string | null>;
    if (!body || typeof body !== "object") {
      return { error: "VALIDATION_ERROR", message: "Body must be a JSON object" };
    }
    await setSettings(body);
    return { ok: true };
  },

  /** Test whether the stored ClickUp API key is valid. */
  async "POST /api/settings/test-clickup"(_params: HandlerParams) {
    try {
      const result = await testClickUpConnection();
      return result;
    } catch (err) {
      if (err instanceof ClickUpNotConfiguredError) {
        return { ok: false, error: err.message };
      }
      throw err;
    }
  },

};
