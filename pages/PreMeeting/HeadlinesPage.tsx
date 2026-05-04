import { useCallback, useEffect, useState } from "react";
import { $fetch } from "@mspbots/fetch";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Textarea,
} from "@mspbots/ui";
import { Calendar, Megaphone, Plus, Trash2 } from "lucide-react";

export const meta = {
  label: "Pre-Meeting Headlines",
  icon:  "Megaphone",
  order: 11,
  menu:  false,
};

interface Meeting {
  id:          string;
  type:        "l10" | "quarterly";
  scheduledAt: string;
}

interface Headline {
  id:             string;
  submitterId:    string;
  meetingId:      string;
  category:       string;
  content:        string;
  escalatedToIds: boolean;
  submittedAt:    string;
}

const CATEGORY_OPTIONS = [
  { value: "absence",      label: "Absence" },
  { value: "headcount",    label: "Headcount change" },
  { value: "closed_won",   label: "Closed-won deal" },
  { value: "cancellation", label: "Cancellation" },
  { value: "general",      label: "General news" },
] as const;

const CATEGORY_LABEL = Object.fromEntries(
  CATEGORY_OPTIONS.map((c) => [c.value, c.label]),
) as Record<string, string>;

interface Draft { category: string; content: string }

function readQuery() {
  const params = new URLSearchParams(window.location.search);
  return {
    meetingId:   params.get("meetingId")   ?? "",
    submitterId: params.get("submitterId") ?? "",
  };
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month:   "short",
    day:     "numeric",
    hour:    "numeric",
    minute:  "2-digit",
  });
}

export default function HeadlinesPage() {
  const { meetingId, submitterId } = readQuery();

  const [meeting,   setMeeting]   = useState<Meeting | null>(null);
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [drafts,    setDrafts]    = useState<Draft[]>([{ category: "general", content: "" }]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!meetingId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [mRes, hRes] = await Promise.all([
        $fetch<{ meeting: Meeting }>(`/api/meetings/${meetingId}`),
        $fetch<{ items: Headline[] }>(`/api/meetings/${meetingId}/headlines`),
      ]);
      setMeeting(mRes.meeting ?? null);
      setHeadlines(hRes.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => { load(); }, [load]);

  function updateDraft(index: number, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d, i) => i === index ? { ...d, ...patch } : d));
  }

  function addDraft() {
    setDrafts((prev) => [...prev, { category: "general", content: "" }]);
  }

  function removeDraft(index: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  async function submitAll() {
    if (!meetingId || !submitterId) {
      setError("Missing meetingId or submitterId in URL.");
      return;
    }
    const valid = drafts.filter((d) => d.content.trim().length > 0);
    if (valid.length === 0) {
      setError("Add at least one headline.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      for (const d of valid) {
        await $fetch(`/api/meetings/${meetingId}/headlines`, {
          method: "POST",
          body:   JSON.stringify({
            submitterId,
            category: d.category,
            content:  d.content.trim(),
          }),
        });
      }
      setDrafts([{ category: "general", content: "" }]);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!meetingId) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <p className="text-sm text-destructive">
          No meeting selected. Open this page from your meeting invite link.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Pre-Meeting Headlines</h1>
        {meeting && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{fmtDateTime(meeting.scheduledAt)}</span>
          </div>
        )}
      </div>

      {/* Existing headlines */}
      {headlines.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Submitted ({headlines.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {headlines.map((h) => (
              <div key={h.id} className="flex items-start gap-2 border-l-2 border-primary/40 pl-3 py-1">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant="outline" className="text-xs">
                      {CATEGORY_LABEL[h.category] ?? h.category}
                    </Badge>
                    {h.escalatedToIds && (
                      <Badge variant="secondary" className="text-xs">
                        Escalated to IDS
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm">{h.content}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* New draft headlines */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold">Add headlines</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {drafts.map((d, i) => (
            <div key={i} className="border border-border rounded-md p-3 space-y-2">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor={`hl-cat-${i}`}>Category</Label>
                  <select
                    id={`hl-cat-${i}`}
                    value={d.category}
                    onChange={(e) => updateDraft(i, { category: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                {drafts.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => removeDraft(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`hl-content-${i}`}>Headline</Label>
                <Textarea
                  id={`hl-content-${i}`}
                  rows={2}
                  placeholder="What should the team know?"
                  value={d.content}
                  onChange={(e) => updateDraft(i, { content: e.target.value })}
                />
              </div>
            </div>
          ))}

          <Button type="button" size="sm" variant="outline" onClick={addDraft}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add another headline
          </Button>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end pt-1">
            <Button onClick={submitAll} disabled={saving}>
              {saving ? "Submitting…" : "Submit headlines"}
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
