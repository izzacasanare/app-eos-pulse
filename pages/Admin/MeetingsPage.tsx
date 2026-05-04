import { useState, useEffect, useCallback } from "react";
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
  ScrollArea,
} from "@mspbots/ui";
import { Calendar, Plus, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

export const meta = {
  label: "Meetings",
  icon:  "Calendar",
  order: 4,
  menu:  ["super_admin", "leadership", "team_lead"],
  route: (roles: string[]) =>
    roles.some((r) => ["super_admin", "leadership", "team_lead"].includes(r)),
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Meeting {
  id:               string;
  teamId:           string;
  type:             "l10" | "quarterly";
  scheduledAt:      string;
  hostId:           string | null;
  status:           "upcoming" | "live" | "pending_close" | "closed";
  fathomUrl:        string | null;
  meetingRatingAvg: number | null;
  createdAt:        string;
}

interface Team {
  id:   string;
  name: string;
  type: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_VARIANT: Record<
  Meeting["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  upcoming:      "outline",
  live:          "default",
  pending_close: "secondary",
  closed:        "secondary",
};

const STATUS_LABEL: Record<Meeting["status"], string> = {
  upcoming:      "Upcoming",
  live:          "Live",
  pending_close: "Pending Close",
  closed:        "Closed",
};

const TYPE_LABEL: Record<Meeting["type"], string> = {
  l10:       "L10",
  quarterly: "Quarterly",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month:   "short",
    day:     "numeric",
    year:    "numeric",
    hour:    "numeric",
    minute:  "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Create Meeting Modal
// ---------------------------------------------------------------------------

interface CreateModalProps {
  teams:   Team[];
  onSave:  (data: { teamId: string; type: string; scheduledAt: string; hostId?: string }) => Promise<void>;
  onClose: () => void;
  saving:  boolean;
}

function CreateMeetingModal({ teams, onSave, onClose, saving }: CreateModalProps) {
  const [teamId,      setTeamId]      = useState(teams[0]?.id ?? "");
  const [type,        setType]        = useState<"l10" | "quarterly">("l10");
  const [scheduledAt, setScheduledAt] = useState("");
  const [error,       setError]       = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!scheduledAt) { setError("Scheduled date is required"); return; }
    try {
      await onSave({ teamId, type, scheduledAt: new Date(scheduledAt).toISOString() });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-lg shadow-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Schedule Meeting</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="m-team">Team</Label>
            <select
              id="m-team"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="m-type">Type</Label>
            <select
              id="m-type"
              value={type}
              onChange={(e) => setType(e.target.value as "l10" | "quarterly")}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="l10">L10</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="m-date">Date &amp; Time</Label>
            <Input
              id="m-date"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Schedule"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meeting row
// ---------------------------------------------------------------------------

interface MeetingRowProps {
  meeting:    Meeting;
  teamName:   string;
  onAutoNext: (teamId: string) => void;
}

function MeetingRow({ meeting, teamName, onAutoNext }: MeetingRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [prep,     setPrep]     = useState<{
    carryOverTodos: { id: string; title: string }[];
    openIssues:     { id: string; title: string }[];
  } | null>(null);
  const [loadingPrep, setLoadingPrep] = useState(false);

  async function loadPrep() {
    if (prep) { setExpanded((v) => !v); return; }
    setExpanded(true);
    setLoadingPrep(true);
    try {
      const res = await $fetch<typeof prep>(`/api/meetings/${meeting.id}/host-prep`);
      setPrep(res);
    } finally {
      setLoadingPrep(false);
    }
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={loadPrep}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{teamName}</p>
            <p className="text-xs text-muted-foreground">{fmtDate(meeting.scheduledAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <Badge variant="outline">{TYPE_LABEL[meeting.type]}</Badge>
          <Badge variant={STATUS_VARIANT[meeting.status]}>
            {STATUS_LABEL[meeting.status]}
          </Badge>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3 bg-muted/20 space-y-3">
          {loadingPrep ? (
            <p className="text-sm text-muted-foreground">Loading host prep…</p>
          ) : prep ? (
            <>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                  Carry-over to-dos ({prep.carryOverTodos.length})
                </p>
                {prep.carryOverTodos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None — clean slate!</p>
                ) : (
                  <ul className="space-y-1">
                    {prep.carryOverTodos.map((t) => (
                      <li key={t.id} className="text-sm flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                        {t.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                  Open issues ({prep.openIssues.length})
                </p>
                {prep.openIssues.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open issues.</p>
                ) : (
                  <ul className="space-y-1">
                    {prep.openIssues.map((i) => (
                      <li key={i.id} className="text-sm flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                        {i.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : null}

          {meeting.status === "upcoming" && (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); onAutoNext(meeting.teamId); }}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Auto-create next week
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MeetingsPage() {
  const [meetings,     setMeetings]     = useState<Meeting[]>([]);
  const [teams,        setTeams]        = useState<Team[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showCreate,   setShowCreate]   = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTeam,   setFilterTeam]   = useState("");

  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, tRes] = await Promise.all([
        $fetch<{ items: Meeting[] }>("/api/meetings"),
        $fetch<{ teams: Team[] }>("/api/teams"),
      ]);
      setMeetings(mRes.items ?? []);
      setTeams(tRes.teams ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(data: {
    teamId: string;
    type: string;
    scheduledAt: string;
  }) {
    setSaving(true);
    try {
      await $fetch("/api/meetings", {
        method: "POST",
        body:   JSON.stringify(data),
      });
      setShowCreate(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleAutoCreate(teamId: string) {
    await $fetch("/api/meetings/auto-create", {
      method: "POST",
      body:   JSON.stringify({ teamId }),
    });
    await load();
  }

  const filtered = meetings.filter((m) => {
    if (filterStatus && m.status !== filterStatus) return false;
    if (filterTeam && m.teamId !== filterTeam) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Meetings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            L10 and Quarterly sessions across all teams.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Schedule
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">All statuses</option>
          <option value="upcoming">Upcoming</option>
          <option value="live">Live</option>
          <option value="pending_close">Pending Close</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {filtered.length} meeting{filtered.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No meetings found.</p>
            </div>
          ) : (
            <ScrollArea className="h-[520px] pr-1">
              <div className="space-y-2">
                {filtered.map((m) => (
                  <MeetingRow
                    key={m.id}
                    meeting={m}
                    teamName={teamMap[m.teamId] ?? m.teamId}
                    onAutoNext={handleAutoCreate}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {showCreate && (
        <CreateMeetingModal
          teams={teams}
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
          saving={saving}
        />
      )}
    </div>
  );
}
