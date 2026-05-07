import { useCallback, useEffect, useState } from "react";
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
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Send,
  Sparkles,
  Star,
  UserCircle2,
  Video,
  XCircle,
} from "lucide-react";

export const meta = {
  label: "Post-Meeting",
  icon:  "ClipboardCheck",
  order: 6,
  menu:  false,
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
}

interface MeetingDetail {
  meeting: Meeting;
}

interface HostChecklist {
  all_ids_closed:           boolean;
  all_todos_have_owner:     boolean;
  all_todos_have_due_date:  boolean;
  off_track_rocks_flagged:  boolean;
  fathom_link_submitted:    boolean;
}

interface MeetingSummary {
  meetingId:    string;
  todosCreated: number;
  issuesLogged: number;
  rockChanges:  number;
  ratingAvg:    number | null;
  ratingsCount: number;
}

interface Team { id: string; name: string }
interface User { id: string; name: string; email: string; role: string }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readQuery() {
  const p = new URLSearchParams(window.location.search);
  return {
    meetingId: p.get("meetingId") ?? "",
    userId:    p.get("userId")    ?? "",
  };
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month:   "short",
    day:     "numeric",
    year:    "numeric",
    hour:    "numeric",
    minute:  "2-digit",
  });
}

const CHECKLIST_LABELS: Record<keyof HostChecklist, string> = {
  all_ids_closed:          "All IDS items closed",
  all_todos_have_owner:    "All to-dos have an owner",
  all_todos_have_due_date: "All to-dos have a due date",
  off_track_rocks_flagged: "Off-track rocks flagged to IDS",
  fathom_link_submitted:   "Fathom recording linked",
};

const CHECKLIST_ORDER: Array<keyof HostChecklist> = [
  "all_ids_closed",
  "all_todos_have_owner",
  "all_todos_have_due_date",
  "off_track_rocks_flagged",
  "fathom_link_submitted",
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ChecklistRowProps { label: string; ok: boolean }

function ChecklistRow({ label, ok }: ChecklistRowProps) {
  return (
    <div className="flex items-center gap-2.5 text-sm py-1.5">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive shrink-0" />
      )}
      <span className={ok ? "" : "text-destructive"}>{label}</span>
    </div>
  );
}

interface FathomCardProps {
  meeting:        Meeting;
  userId:         string;
  onSubmitted:    () => void;
}

function FathomCard({ meeting, userId, onSubmitted }: FathomCardProps) {
  const [url,    setUrl]    = useState(meeting.fathomUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [done,   setDone]   = useState(!!meeting.fathomUrl);

  async function submit() {
    if (!userId) {
      setError("Open this page with ?userId=… to submit the Fathom link.");
      return;
    }
    if (!url.trim()) {
      setError("URL is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await $fetch<{ error?: string; message?: string }>(
        `/api/meetings/${meeting.id}/fathom`,
        {
          method: "POST",
          body:   JSON.stringify({ url: url.trim(), submittedById: userId }),
        },
      );
      if (res?.error) { setError(res.message ?? res.error); return; }
      setDone(true);
      onSubmitted();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit Fathom link");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Video className="h-4 w-4 text-primary" />
          Fathom recording
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="post-fathom">Recording URL</Label>
          <Input
            id="post-fathom"
            type="url"
            placeholder="https://fathom.video/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            AI scan will trigger automatically.
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center justify-between">
          {done && (
            <span className="text-xs text-emerald-600 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
            </span>
          )}
          <div className="ml-auto">
            <Button size="sm" onClick={submit} disabled={saving}>
              {saving ? "Submitting…" : done ? "Update link" : "Submit link"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface SummaryCardProps { summary: MeetingSummary | null }

function SummaryCard({ summary }: SummaryCardProps) {
  if (!summary) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          Meeting summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryStat label="To-dos created"  value={summary.todosCreated} />
          <SummaryStat label="IDS items logged" value={summary.issuesLogged} />
          <SummaryStat label="Rock changes"     value={summary.rockChanges} />
          <SummaryStat
            label={`Rating (${summary.ratingsCount})`}
            value={summary.ratingAvg !== null ? summary.ratingAvg.toFixed(1) : "—"}
            icon={<Star className="h-3.5 w-3.5 text-amber-500" />}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryStat({
  label, value, icon,
}: { label: string; value: number | string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

interface NextHostCardProps {
  meeting:    Meeting;
  members:    User[];
  onConfirm:  () => Promise<void>;
  confirming: boolean;
  confirmed:  boolean;
}

function NextHostCard({ meeting, members, onConfirm, confirming, confirmed }: NextHostCardProps) {
  const nextHost = members.find((m) => m.id === meeting.hostId) ?? null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <UserCircle2 className="h-4 w-4 text-primary" />
          Next host
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {nextHost ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{nextHost.name}</p>
              <p className="text-xs text-muted-foreground">{nextHost.email}</p>
            </div>
            <Button
              size="sm"
              variant={confirmed ? "outline" : "default"}
              onClick={onConfirm}
              disabled={confirming || confirmed}
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {confirmed ? "Notified" : confirming ? "Notifying…" : "Confirm and notify"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No next host selected. Set one during Wrap-Up before closing.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PostMeetingPage() {
  const { meetingId, userId } = readQuery();

  const [meeting,   setMeeting]   = useState<Meeting | null>(null);
  const [team,      setTeam]      = useState<Team | null>(null);
  const [members,   setMembers]   = useState<User[]>([]);
  const [checklist, setChecklist] = useState<HostChecklist | null>(null);
  const [summary,   setSummary]   = useState<MeetingSummary | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [closing,   setClosing]   = useState(false);
  const [closed,    setClosed]    = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmed,  setConfirmed]  = useState(false);

  const load = useCallback(async () => {
    if (!meetingId) { setLoading(false); return; }
    try {
      const detail = await $fetch<MeetingDetail>(`/api/meetings/${meetingId}`);
      const m = detail?.meeting ?? null;
      setMeeting(m);
      if (!m) { setLoading(false); return; }

      const [c, s, t, u] = await Promise.all([
        $fetch<{ checklist: HostChecklist }>(`/api/meetings/${meetingId}/host-checklist`),
        $fetch<{ summary:   MeetingSummary }>(`/api/meetings/${meetingId}/summary`),
        $fetch<{ teams: Team[] }>("/api/teams"),
        $fetch<{ members: User[] }>(`/api/teams/${m.teamId}/members`)
          .catch(() => ({ members: [] as User[] })),
      ]);

      setChecklist(c.checklist ?? null);
      setSummary(s.summary ?? null);
      setTeam((t.teams ?? []).find((x) => x.id === m.teamId) ?? null);
      setMembers(u.members ?? []);
      setClosed(m.status === "closed");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load post-meeting");
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => { load(); }, [load]);

  const allPass = checklist
    ? CHECKLIST_ORDER.every((k) => checklist[k])
    : false;

  async function complete() {
    if (!meeting) return;
    setClosing(true);
    setError(null);
    try {
      const res = await $fetch<{ error?: string; message?: string; meeting?: Meeting }>(
        `/api/meetings/${meeting.id}/complete`,
        { method: "POST" },
      );
      if (res?.error) { setError(res.message ?? res.error); return; }
      setClosed(true);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to complete close");
    } finally {
      setClosing(false);
    }
  }

  async function confirmNextHost() {
    if (!meeting) return;
    setConfirming(true);
    setError(null);
    try {
      // Persist any host change and trigger the Teams nudge for the new host.
      await $fetch(`/api/meetings/${meeting.id}`, {
        method: "PATCH",
        body:   JSON.stringify({ hostId: meeting.hostId }),
      });
      await $fetch("/api/nudges/host-confirmed", {
        method: "POST",
        body:   JSON.stringify({ meetingId: meeting.id, hostId: meeting.hostId }),
      }).catch(() => { /* nudge service is best-effort */ });
      setConfirmed(true);
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-muted-foreground">Loading post-meeting…</p>
      </div>
    );
  }

  if (!meetingId || !meeting) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-6">
            <p className="text-sm text-destructive">
              {error ?? "No meeting selected. Open this page with a ?meetingId=… query param."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>{team?.name ?? meeting.teamId}</span>
          <Badge variant="outline" className="uppercase text-[10px] py-0 px-1.5">
            {meeting.type}
          </Badge>
          <Badge
            variant={closed ? "secondary" : "default"}
            className="uppercase text-[10px] py-0 px-1.5"
          >
            {closed ? "Closed" : meeting.status.replace("_", " ")}
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold">Post-Meeting</h1>
        <p className="text-sm text-muted-foreground">
          {fmtDateTime(meeting.scheduledAt)}
        </p>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-3 flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Host checklist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            Host checklist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {checklist ? (
            CHECKLIST_ORDER.map((k) => (
              <ChecklistRow key={k} label={CHECKLIST_LABELS[k]} ok={checklist[k]} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Loading checklist…</p>
          )}
        </CardContent>
      </Card>

      {/* Fathom + Summary side by side on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FathomCard
          meeting={meeting}
          userId={userId}
          onSubmitted={load}
        />
        <SummaryCard summary={summary} />
      </div>

      {/* Next host */}
      <NextHostCard
        meeting={meeting}
        members={members}
        onConfirm={confirmNextHost}
        confirming={confirming}
        confirmed={confirmed}
      />

      {/* Submit / archive */}
      <div className="flex items-center justify-end gap-3">
        {!allPass && (
          <span className="text-xs text-muted-foreground">
            Complete every checklist item to archive this session.
          </span>
        )}
        <Button
          size="lg"
          disabled={!allPass || closing || closed}
          onClick={complete}
        >
          {closed ? "Archived" : closing ? "Archiving…" : "Submit and archive"}
        </Button>
      </div>

    </div>
  );
}
