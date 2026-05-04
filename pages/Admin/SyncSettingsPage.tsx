import { useState, useEffect } from "react";
import { $fetch } from "@mspbots/fetch";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@mspbots/ui";
import { RefreshCw, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export const meta = {
  label: "Sync Settings",
  icon:  "Settings",
  order: 5,
  menu:  ["super_admin"],
  route: (roles: string[]) => roles.includes("super_admin"),
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Settings {
  CLICKUP_API_KEY:       string | null;
  CLICKUP_IDS_LIST_ID:   string | null;
  CLICKUP_ROCKS_LIST_ID: string | null;
  CLICKUP_TODOS_LIST_ID: string | null;
  IDS_SYNC_ENABLED:      string | null;
  ROCKS_SYNC_ENABLED:    string | null;
  TODOS_SYNC_ENABLED:    string | null;
  TEAMS_WEBHOOK_URL:     string | null;
  [key: string]:         string | null;
}

type ConnStatus = "idle" | "testing" | "ok" | "fail";

// ---------------------------------------------------------------------------
// Toggle row
// ---------------------------------------------------------------------------

function SyncToggle({
  label,
  description,
  enabled,
  onChange,
}: {
  label:       string;
  description: string;
  enabled:     boolean;
  onChange:    (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          enabled ? "bg-primary" : "bg-input"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SyncSettingsPage() {
  const [settings,   setSettings]   = useState<Settings | null>(null);
  const [draft,      setDraft]      = useState<Settings | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [connStatus, setConnStatus] = useState<ConnStatus>("idle");
  const [saved,      setSaved]      = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await $fetch<{ settings: Settings }>("/api/settings");
        setSettings(res.settings);
        setDraft(res.settings);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function set(key: keyof Settings, value: string | null) {
    setDraft((d) => d ? { ...d, [key]: value } : d);
  }

  function toggleSync(key: "IDS_SYNC_ENABLED" | "ROCKS_SYNC_ENABLED" | "TODOS_SYNC_ENABLED") {
    const current = draft?.[key] === "true";
    set(key, current ? "false" : "true");
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setSaved(false);
    try {
      await $fetch("/api/settings", {
        method: "PUT",
        body:   JSON.stringify(draft),
      });
      setSettings(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setConnStatus("testing");
    try {
      const res = await $fetch<{ ok: boolean; error?: string }>(
        "/api/settings/test-clickup",
        { method: "POST" },
      );
      setConnStatus(res.ok ? "ok" : "fail");
    } catch {
      setConnStatus("fail");
    }
  }

  if (loading || !draft) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading settings…</div>
    );
  }

  const hasApiKey = Boolean(settings?.CLICKUP_API_KEY);

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Sync Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure ClickUp migration sync and Teams notifications.
        </p>
      </div>

      {/* Migration phase banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-4 py-3">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Migration phase active
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            EOS Pulse is replacing ClickUp as the operating layer. Sync pushes
            changes to ClickUp during the transition. Once migration is complete,
            disable all sync toggles and archive the ClickUp lists.
          </p>
        </div>
      </div>

      {/* ClickUp connection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ClickUp Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="api-key">API Key</Label>
            <div className="flex gap-2">
              <Input
                id="api-key"
                type="password"
                placeholder={hasApiKey ? "pk_•••••••• (stored)" : "pk_..."}
                value={
                  draft.CLICKUP_API_KEY && draft.CLICKUP_API_KEY !== "••••••••"
                    ? draft.CLICKUP_API_KEY
                    : ""
                }
                onChange={(e) =>
                  set("CLICKUP_API_KEY", e.target.value || null)
                }
                className="font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={connStatus === "testing" || !hasApiKey}
              >
                {connStatus === "testing" ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : connStatus === "ok" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : connStatus === "fail" ? (
                  <XCircle className="h-4 w-4 text-destructive" />
                ) : (
                  "Test"
                )}
              </Button>
            </div>
            {connStatus === "ok" && (
              <p className="text-xs text-green-600 dark:text-green-400">
                Connected successfully.
              </p>
            )}
            {connStatus === "fail" && (
              <p className="text-xs text-destructive">
                Connection failed — check the API key.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(
              [
                ["CLICKUP_IDS_LIST_ID",   "IDS List ID"],
                ["CLICKUP_ROCKS_LIST_ID", "Rocks List ID"],
                ["CLICKUP_TODOS_LIST_ID", "To-dos List ID"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  value={draft[key] ?? ""}
                  onChange={(e) => set(key, e.target.value || null)}
                  placeholder="901..."
                  className="font-mono text-sm"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sync toggles */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Module Sync</CardTitle>
            <Badge variant="outline">Migration mode</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <SyncToggle
            label="IDS / Issues"
            description="Sync EOS Pulse issues to the ClickUp IDS list."
            enabled={draft.IDS_SYNC_ENABLED === "true"}
            onChange={() => toggleSync("IDS_SYNC_ENABLED")}
          />
          <SyncToggle
            label="Rocks"
            description="Sync quarterly rocks to the ClickUp Rocks list."
            enabled={draft.ROCKS_SYNC_ENABLED === "true"}
            onChange={() => toggleSync("ROCKS_SYNC_ENABLED")}
          />
          <SyncToggle
            label="To-Dos"
            description="Sync meeting to-dos to the ClickUp To-dos list."
            enabled={draft.TODOS_SYNC_ENABLED === "true"}
            onChange={() => toggleSync("TODOS_SYNC_ENABLED")}
          />
        </CardContent>
      </Card>

      {/* Teams webhook */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Teams Webhook</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <Label htmlFor="webhook">Incoming Webhook URL</Label>
          <Input
            id="webhook"
            value={draft.TEAMS_WEBHOOK_URL ?? ""}
            onChange={(e) => set("TEAMS_WEBHOOK_URL", e.target.value || null)}
            placeholder="https://prod-xx.westus.logic.azure.com/..."
          />
          <p className="text-xs text-muted-foreground">
            Used by the nudge scheduler to post accountability reminders.
          </p>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" />
            Saved
          </span>
        )}
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
