import { useCallback, useEffect, useMemo, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@mspbots/ui";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  ExternalLink,
  Flag,
  Megaphone,
  Mountain,
  Plus,
  Star,
  Target,
  Timer,
  Users,
  Zap,
} from "lucide-react";

export const meta = {
  label: "Live Session",
  icon:  "Zap",
  order: 5,
  menu:  false,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SegmentName =
  | "check_in"
  | "rock_review"
  | "scorecard_review"
  | "headlines"
  | "todo_review"
  | "ids"
  | "wrap_up";

type RockStatus =
  | "on_track"
  | "off_track"
  | "at_risk"
  | "blocked"
  | "on_hold"
  | "completed";

type TodoStatus = "open" | "done" | "blocked" | "carried";
type IssueStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "pending_closure"
  | "closed";
type ScorecardView = "corp_weekly" | "corp_monthly" | "product_weekly";

interface Meeting {
  id:          string;
  teamId:      string;
  type:        "l10" | "quarterly";
  scheduledAt: string;
  startedAt:   string | null;
  hostId:      string | null;
  status:      "upcoming" | "live" | "pending_close" | "closed";
  fathomUrl:   string | null;
}

interface MeetingDetail {
  meeting: Meeting;
  todos:   Todo[];
  issues:  Issue[];
}

interface MeetingSegment {
  id:          string;
  meetingId:   string;
  segmentName: SegmentName;
  startedAt:   string;
  endedAt:     string | null;
}

interface Team { id: string; name: string }
interface User { id: string; name: string; email: string; role: string }

interface Checkin {
  id:                   string;
  memberId:             string;
  meetingId:            string;
  personalGoodNews:     string | null;
  professionalGoodNews: string | null;
  submittedAt:          string;
}

interface CheckinsResult {
  meetingId:      string;
  submitted:      Checkin[];
  missingMembers: { id: string; name: string; email: string }[];
  totalExpected:  number;
  submittedCount: number;
}

interface Rock {
  id:       string;
  title:    string;
  ownerId:  string;
  teamId:   string;
  status:   RockStatus;
  quarter:  number;
  year:     number;
}

interface RockHistoryEntry {
  id:        string;
  rockId:    string;
  status:    RockStatus;
  comment:   string | null;
  changedAt: string;
}

interface MeetingRockStatus {
  rock:         Rock;
  preSubmitted: boolean;
  latestEntry:  RockHistoryEntry | null;
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

interface Todo {
  id:               string;
  title:            string;
  assignedToId:     string;
  teamId:           string;
  meetingId:        string | null;
  dueDate:          string | null;
  status:           TodoStatus;
  carryOverReason:  string | null;
  acknowledgedAt:   string | null;
  updatedAt:        string;
  createdAt:        string;
}

interface MeetingTodoRow { todo: Todo; notUpdated: boolean }

interface Issue {
  id:                    string;
  title:                 string;
  description:           string | null;
  status:                IssueStatus;
  priority:              "low" | "medium" | "high" | "critical";
  meetingId:             string | null;
  submitterId:           string;
  sourceTeamId:          string;
  targetDeptId:          string;
  assignedToId:          string | null;
  escalateToLeadership:  boolean;
  resolutionNotes:       string | null;
  sopLink:               string | null;
  isFathomSource:        boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

interface SegmentDef {
  key:     SegmentName;
  label:   string;
  durationSec: number;
  icon:    React.ComponentType<{ className?: string }>;
}

const SEGMENTS: SegmentDef[] = [
  { key: "check_in",         label: "Check-In",                durationSec:  5 * 60, icon: Heart },
  { key: "rock_review",      label: "Rock Review",             durationSec:  5 * 60, icon: Mountain },
  { key: "scorecard_review", label: "Scorecard Review",        durationSec:  5 * 60, icon: Target },
  { key: "headlines",        label: "Headlines",               durationSec:  5 * 60, icon: Megaphone },
  { key: "todo_review",      label: "To-Do Review",            durationSec:  5 * 60, icon: CheckCircle2 },
  { key: "ids",              label: "IDS — Identify · Discuss · Solve", durationSec: 60 * 60, icon: Zap },
  { key: "wrap_up",          label: "Wrap-Up & Ratings",       durationSec:  5 * 60, icon: Star },
];

function Heart({ className }: { className?: string }) {
  // Local fallback to avoid an extra lucide import name collision.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

const ROCK_STATUS_LABEL: Record<RockStatus, string> = {
  on_track:  "On track",
  off_track: "Off track",
  at_risk:   "At risk",
  blocked:   "Blocked",
  on_hold:   "On hold",
  completed: "Completed",
};

const ROCK_STATUS_VARIANT: Record<
  RockStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  on_track:  "default",
  off_track: "destructive",
  at_risk:   "secondary",
  blocked:   "destructive",
  on_hold:   "outline",
  completed: "secondary",
};

const TODO_STATUS_LABEL: Record<TodoStatus, string> = {
  open: "Open", done: "Done", blocked: "Blocked", carried: "Carried",
};

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

function fmtClock(totalSec: number): string {
  const sign = totalSec < 0 ? "-" : "";
  const t = Math.abs(Math.floor(totalSec));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${sign}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function useTicker() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function findCurrentSegment(segments: MeetingSegment[]): MeetingSegment | null {
  const open = [...segments].reverse().find((s) => s.endedAt === null);
  return open ?? segments[segments.length - 1] ?? null;
}

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

interface TopBarProps {
  meeting:        Meeting;
  team:           Team | null;
  current:        SegmentDef | null;
  segmentStarted: number | null;
  meetingStarted: number | null;
  now:            number;
}

function TopBar({ meeting, team, current, segmentStarted, meetingStarted, now }: TopBarProps) {
  const segElapsed = segmentStarted ? Math.floor((now - segmentStarted) / 1000) : 0;
  const segRemain  = current ? current.durationSec - segElapsed : 0;
  const segOver    = segRemain < 0;
  const totalElapsed = meetingStarted ? Math.floor((now - meetingStarted) / 1000) : 0;

  return (
    <div className="border-b border-border bg-card">
      <div className="px-6 py-3 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>{team?.name ?? meeting.teamId}</span>
            <span className="text-border">·</span>
            <Badge variant="outline" className="uppercase text-[10px] py-0 px-1.5">
              {meeting.type}
            </Badge>
            <Badge variant="default" className="uppercase text-[10px] py-0 px-1.5">
              Live
            </Badge>
          </div>
          <h1 className="text-lg font-semibold mt-0.5 truncate">
            {team?.name ?? "Team"} · L10 Session
          </h1>
        </div>

        <div className="flex items-center gap-6 shrink-0">
          {current && (
            <div className="flex flex-col items-end">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {current.label}
              </div>
              <div className={
                "text-2xl font-mono font-semibold tabular-nums " +
                (segOver ? "text-destructive" : "")
              }>
                {fmtClock(segRemain)}
              </div>
            </div>
          )}
          <div className="flex flex-col items-end">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Timer className="h-3 w-3" /> Elapsed
            </div>
            <div className="text-2xl font-mono font-semibold tabular-nums text-muted-foreground">
              {fmtClock(totalElapsed)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar — agenda
// ---------------------------------------------------------------------------

interface AgendaSidebarProps {
  segments: MeetingSegment[];
  current:  SegmentName | null;
  isHost:   boolean;
  onAdvance: (segment: SegmentName) => void;
  advancing: boolean;
}

function AgendaSidebar({ segments, current, isHost, onAdvance, advancing }: AgendaSidebarProps) {
  const completedKeys = new Set(
    segments.filter((s) => s.endedAt !== null).map((s) => s.segmentName),
  );
  const currentIndex = SEGMENTS.findIndex((s) => s.key === current);
  const nextSegment  = currentIndex >= 0 && currentIndex < SEGMENTS.length - 1
    ? SEGMENTS[currentIndex + 1]
    : null;

  return (
    <aside className="w-72 border-r border-border bg-muted/20 flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Session Agenda
        </h2>
      </div>
      <ScrollArea className="flex-1">
        <ol className="p-2 space-y-1">
          {SEGMENTS.map((seg, i) => {
            const completed = completedKeys.has(seg.key);
            const active    = current === seg.key;
            const Icon = seg.icon;
            const minutes = Math.round(seg.durationSec / 60);
            return (
              <li
                key={seg.key}
                className={
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm " +
                  (active
                    ? "bg-primary/10 text-foreground border border-primary/40"
                    : completed
                    ? "text-muted-foreground"
                    : "text-foreground")
                }
              >
                <span className="shrink-0">
                  {completed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : active ? (
                    <Circle className="h-4 w-4 text-primary fill-primary/40" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40" />
                  )}
                </span>
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 min-w-0 truncate">
                  <span className="text-[10px] text-muted-foreground mr-1.5">
                    {i + 1}.
                  </span>
                  {seg.label}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  {minutes}m
                </span>
              </li>
            );
          })}
        </ol>
      </ScrollArea>
      {isHost && nextSegment && (
        <div className="p-3 border-t border-border">
          <Button
            className="w-full"
            size="sm"
            onClick={() => onAdvance(nextSegment.key)}
            disabled={advancing}
          >
            {advancing ? "Advancing…" : (
              <>
                Next: {nextSegment.label}
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Park to IDS — quick add (always visible)
// ---------------------------------------------------------------------------

interface ParkToIdsProps {
  meeting: Meeting;
  userId:  string;
  onAdded: () => void;
}

function ParkToIdsButton({ meeting, userId, onAdded }: ParkToIdsProps) {
  const [open,    setOpen]    = useState(false);
  const [title,   setTitle]   = useState("");
  const [desc,    setDesc]    = useState("");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function park() {
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await $fetch<{ issue?: Issue; error?: string; message?: string }>(
        "/api/issues",
        {
          method: "POST",
          body:   JSON.stringify({
            teamId:      meeting.teamId,
            title:       title.trim(),
            description: desc.trim() || undefined,
            priority:    "medium",
            meetingId:   meeting.id,
            ownerId:     userId,
          }),
        },
      );
      if (res?.error) { setError(res.message ?? res.error); return; }
      setTitle(""); setDesc(""); setOpen(false);
      onAdded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to park issue");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="default"
        className="fixed bottom-6 right-6 z-30 shadow-lg"
        onClick={() => setOpen(true)}
      >
        <Flag className="h-4 w-4 mr-1.5" />
        Park to IDS
      </Button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm"
               onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-lg shadow-lg p-6">
            <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Flag className="h-4 w-4 text-primary" />
              Park issue to IDS
            </h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="park-title">Issue title</Label>
                <Input
                  id="park-title"
                  placeholder="What needs to be solved?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="park-desc">Context (optional)</Label>
                <Textarea
                  id="park-desc"
                  rows={3}
                  placeholder="A few words on the symptom or impact"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={park} disabled={saving}>
                  {saving ? "Parking…" : "Park to IDS"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Segment: Check-In
// ---------------------------------------------------------------------------

interface CheckInPanelProps {
  meetingId: string;
  members:   User[];
}

function CheckInPanel({ meetingId, members }: CheckInPanelProps) {
  const [data,    setData]    = useState<CheckinsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [index,   setIndex]   = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await $fetch<CheckinsResult>(`/api/meetings/${meetingId}/checkins`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading check-ins…</p>;
  if (!data)   return <p className="text-sm text-destructive">Failed to load check-ins.</p>;

  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));
  const ordered = data.submitted.slice().sort((a, b) => {
    const an = memberById[a.memberId]?.name ?? "";
    const bn = memberById[b.memberId]?.name ?? "";
    return an.localeCompare(bn);
  });

  const current = ordered[index] ?? null;
  const member  = current ? memberById[current.memberId] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Check-In ({data.submittedCount}/{data.totalExpected})
        </h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={ordered.length === 0 || index >= ordered.length - 1}
            onClick={() => setIndex((i) => Math.min(i + 1, ordered.length - 1))}
          >
            Next person
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      </div>

      {data.missingMembers.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Missing check-ins ({data.missingMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {data.missingMembers.map((m) => (
              <Badge key={m.id} variant="destructive" className="text-xs">
                {m.name}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {current && member ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                {member.name}
              </CardTitle>
              <span className="text-xs text-muted-foreground tabular-nums">
                {index + 1} / {ordered.length}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-rose-500 font-medium mb-1">
                Personal good news
              </div>
              <p className="text-sm">{current.personalGoodNews ?? <em className="text-muted-foreground">No personal good news</em>}</p>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-sky-500 font-medium mb-1">
                Professional good news
              </div>
              <p className="text-sm">{current.professionalGoodNews ?? <em className="text-muted-foreground">No professional good news</em>}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No check-ins submitted yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segment: Rock Review
// ---------------------------------------------------------------------------

interface RockReviewPanelProps {
  meetingId: string;
  userId:    string;
  members:   User[];
  onParked:  () => void;
}

function RockReviewPanel({ meetingId, userId, members, onParked }: RockReviewPanelProps) {
  const [rows,    setRows]    = useState<MeetingRockStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await $fetch<{ items: MeetingRockStatus[] }>(`/api/meetings/${meetingId}/rocks`);
      setRows(res.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(rockId: string, status: RockStatus, comment?: string) {
    setSavingId(rockId);
    try {
      await $fetch(`/api/rocks/${rockId}/status`, {
        method: "POST",
        body:   JSON.stringify({ status, comment, meetingId, userId }),
      });
      if (status === "off_track") {
        const rock = rows.find((r) => r.rock.id === rockId)?.rock;
        if (rock) {
          await $fetch("/api/issues", {
            method: "POST",
            body:   JSON.stringify({
              teamId:      rock.teamId,
              title:       `Off-track rock: ${rock.title}`,
              description: comment ?? "Rock auto-queued from live session — owner reported off track.",
              priority:    "high",
              meetingId,
              ownerId:     userId,
            }),
          });
          onParked();
        }
      }
      await load();
    } finally {
      setSavingId(null);
    }
  }

  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));
  const offTrack = rows.filter((r) => r.rock.status === "off_track" || r.latestEntry?.status === "off_track");

  if (loading) return <p className="text-sm text-muted-foreground">Loading rocks…</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Mountain className="h-5 w-5 text-primary" />
        Rock Review
      </h2>

      {offTrack.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-3 flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span>
              <strong>{offTrack.length}</strong> off-track rock{offTrack.length === 1 ? "" : "s"}
              {" "}auto-queued to IDS.
            </span>
          </CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No rocks for this team this quarter.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => (
            <RockReviewRow
              key={r.rock.id}
              row={r}
              ownerName={memberById[r.rock.ownerId]?.name ?? "Unknown"}
              saving={savingId === r.rock.id}
              onChange={(status, comment) => updateStatus(r.rock.id, status, comment)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface RockReviewRowProps {
  row:       MeetingRockStatus;
  ownerName: string;
  saving:    boolean;
  onChange:  (status: RockStatus, comment?: string) => void;
}

function RockReviewRow({ row, ownerName, saving, onChange }: RockReviewRowProps) {
  const live = row.latestEntry?.status ?? row.rock.status;
  const [status, setStatus] = useState<RockStatus>(live);
  const [comment, setComment] = useState(row.latestEntry?.comment ?? "");
  const needsComment = status === "off_track" || status === "blocked";

  function save() {
    if (needsComment && !comment.trim()) return;
    onChange(status, comment.trim() || undefined);
  }

  return (
    <Card>
      <CardContent className="py-3 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{row.rock.title}</p>
            <p className="text-xs text-muted-foreground">
              {ownerName} · Q{row.rock.quarter}-{row.rock.year}
              {row.preSubmitted && " · pre-submitted"}
            </p>
          </div>
          <Badge variant={ROCK_STATUS_VARIANT[live]}>
            {ROCK_STATUS_LABEL[live]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as RockStatus)}>
            <SelectTrigger size="sm" className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["on_track","at_risk","off_track","blocked","on_hold","completed"] as RockStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{ROCK_STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={save} disabled={saving}>
            {saving ? "…" : "Update"}
          </Button>
        </div>
        {needsComment && (
          <Textarea
            rows={2}
            placeholder="Required: what's blocking? recovery plan?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Segment: Scorecard Review
// ---------------------------------------------------------------------------

interface ScorecardPanelProps {
  meeting: Meeting;
  userId:  string;
  onParked: () => void;
}

function ScorecardPanel({ meeting, userId, onParked }: ScorecardPanelProps) {
  const [view, setView] = useState<ScorecardView>("corp_weekly");
  const [urls, setUrls] = useState<Record<ScorecardView, string | null>>({
    corp_weekly:    null,
    corp_monthly:   null,
    product_weekly: null,
  });
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await $fetch<{ settings: Record<string, string | null> }>("/api/settings");
      const s = res.settings ?? {};
      setUrls({
        corp_weekly:    s["SCORECARD_CORP_WEEKLY_URL"]    ?? null,
        corp_monthly:   s["SCORECARD_CORP_MONTHLY_URL"]   ?? null,
        product_weekly: s["SCORECARD_PRODUCT_WEEKLY_URL"] ?? null,
      });
    })();
  }, []);

  const url = urls[view];

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Scorecard Review
        </h2>
        <div className="flex items-center gap-1.5 bg-muted rounded-md p-0.5">
          {([
            ["corp_weekly",    "Corporate Weekly"],
            ["corp_monthly",   "Corporate Monthly"],
            ["product_weekly", "Product Weekly"],
          ] as [ScorecardView, string][]).map(([v, label]) => (
            <Button
              key={v}
              size="sm"
              variant={view === v ? "default" : "ghost"}
              onClick={() => setView(v)}
              className="h-7 text-xs"
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="relative flex-1 min-h-[480px] rounded-lg border border-border overflow-hidden bg-muted/20">
        {url ? (
          <iframe
            src={url}
            title={`Scorecard — ${view}`}
            className="absolute inset-0 w-full h-full"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground p-6 text-center">
            <ExternalLink className="h-6 w-6" />
            <p>No scorecard URL configured for {view.replace("_", " ")}.</p>
            <p className="text-xs">
              Set <code className="text-xs bg-muted px-1 rounded">SCORECARD_{view.toUpperCase()}_URL</code> in Settings.
            </p>
          </div>
        )}

        <Button
          size="sm"
          className="absolute bottom-3 right-3 shadow"
          onClick={() => setShowAdd(true)}
        >
          <Flag className="h-3.5 w-3.5 mr-1.5" />
          Add to IDS
        </Button>
      </div>

      {showAdd && (
        <ScorecardAddIdsModal
          meeting={meeting}
          userId={userId}
          view={view}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); onParked(); }}
        />
      )}
    </div>
  );
}

interface ScorecardAddIdsModalProps {
  meeting: Meeting;
  userId:  string;
  view:    ScorecardView;
  onClose: () => void;
  onAdded: () => void;
}

function ScorecardAddIdsModal({ meeting, userId, view, onClose, onAdded }: ScorecardAddIdsModalProps) {
  const [title, setTitle] = useState("");
  const [desc,  setDesc]  = useState("");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  async function save() {
    if (!title.trim()) { setError("Title required."); return; }
    setSaving(true);
    try {
      const res = await $fetch<{ error?: string; message?: string }>("/api/issues", {
        method: "POST",
        body:   JSON.stringify({
          teamId:      meeting.teamId,
          title:       title.trim(),
          description: `Scorecard view: ${view}\n${desc.trim()}`,
          priority:    "medium",
          meetingId:   meeting.id,
          ownerId:     userId,
        }),
      });
      if (res?.error) { setError(res.message ?? res.error); return; }
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-lg shadow-lg p-6 space-y-3">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Flag className="h-4 w-4 text-primary" /> Add scorecard issue to IDS
        </h3>
        <div className="space-y-1.5">
          <Label htmlFor="sc-title">Issue title</Label>
          <Input id="sc-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sc-desc">Context</Label>
          <Textarea id="sc-desc" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "…" : "Add to IDS"}</Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segment: Headlines
// ---------------------------------------------------------------------------

interface HeadlinesPanelProps {
  meeting: Meeting;
  userId:  string;
  onParked: () => void;
}

function HeadlinesPanel({ meeting, userId, onParked }: HeadlinesPanelProps) {
  const [items, setItems] = useState<Headline[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await $fetch<{ items: Headline[] }>(`/api/meetings/${meeting.id}/headlines`);
      setItems(res.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [meeting.id]);

  useEffect(() => { load(); }, [load]);

  async function escalate(h: Headline) {
    setBusyId(h.id);
    try {
      await $fetch(`/api/headlines/${h.id}/escalate`, {
        method: "POST",
        body:   JSON.stringify({ meetingId: meeting.id }),
      });
      onParked();
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function toToDo(h: Headline) {
    setBusyId(h.id);
    try {
      await $fetch("/api/todos", {
        method: "POST",
        body:   JSON.stringify({
          title:     `Follow-up: ${h.content.slice(0, 80)}`,
          ownerId:   userId,
          meetingId: meeting.id,
        }),
      });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading headlines…</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-primary" />
        Headlines ({items.length})
      </h2>
      {items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No headlines submitted.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((h) => (
            <Card key={h.id}>
              <CardContent className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">
                      {h.category}
                    </Badge>
                    {h.escalatedToIds && (
                      <Badge variant="secondary" className="text-[10px]">
                        Escalated
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm">{h.content}</p>
                </div>
                {!h.escalatedToIds && (
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="ghost" disabled={busyId === h.id}>
                      Noted
                    </Button>
                    <Button size="sm" variant="outline" disabled={busyId === h.id} onClick={() => toToDo(h)}>
                      → To-Do
                    </Button>
                    <Button size="sm" variant="outline" disabled={busyId === h.id} onClick={() => escalate(h)}>
                      → IDS
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segment: To-Do Review
// ---------------------------------------------------------------------------

interface TodoReviewPanelProps {
  meeting: Meeting;
  userId:  string;
  members: User[];
  onParked: () => void;
}

function TodoReviewPanel({ meeting, userId, members, onParked }: TodoReviewPanelProps) {
  const [rows,    setRows]    = useState<MeetingTodoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId,  setBusyId]  = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await $fetch<{ items: MeetingTodoRow[] }>(`/api/meetings/${meeting.id}/todos`);
      setRows(res.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [meeting.id]);

  useEffect(() => { load(); }, [load]);

  async function complete(t: Todo) {
    setBusyId(t.id);
    try {
      await $fetch(`/api/todos/${t.id}/status`, {
        method: "POST",
        body:   JSON.stringify({ status: "done", userId }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function reassignDate(t: Todo, newDate: string) {
    setBusyId(t.id);
    try {
      await $fetch(`/api/todos/${t.id}`, {
        method: "PATCH",
        body:   JSON.stringify({ dueDate: newDate }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function toIds(t: Todo) {
    setBusyId(t.id);
    try {
      await $fetch("/api/issues", {
        method: "POST",
        body:   JSON.stringify({
          teamId:      meeting.teamId,
          title:       `Stuck to-do: ${t.title}`,
          description: t.carryOverReason ?? "Not done — escalated to IDS during review.",
          priority:    "medium",
          meetingId:   meeting.id,
          ownerId:     userId,
        }),
      });
      onParked();
    } finally {
      setBusyId(null);
    }
  }

  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));
  const open = rows.filter((r) => r.todo.status === "open" || r.todo.status === "blocked");

  if (loading) return <p className="text-sm text-muted-foreground">Loading to-dos…</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-primary" />
        To-Do Review ({open.length})
      </h2>
      {open.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No open to-dos for this meeting.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {open.map((r) => (
            <TodoReviewRow
              key={r.todo.id}
              row={r}
              ownerName={memberById[r.todo.assignedToId]?.name ?? "Unknown"}
              busy={busyId === r.todo.id}
              onComplete={() => complete(r.todo)}
              onReassign={(d) => reassignDate(r.todo, d)}
              onIds={() => toIds(r.todo)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TodoReviewRowProps {
  row:        MeetingTodoRow;
  ownerName:  string;
  busy:       boolean;
  onComplete: () => void;
  onReassign: (date: string) => void;
  onIds:      () => void;
}

function TodoReviewRow({ row, ownerName, busy, onComplete, onReassign, onIds }: TodoReviewRowProps) {
  const [date, setDate] = useState(row.todo.dueDate ?? "");

  return (
    <Card className={row.notUpdated ? "border-destructive/40 bg-destructive/5" : ""}>
      <CardContent className="py-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{row.todo.title}</p>
            <p className="text-xs text-muted-foreground">
              {ownerName} · due {fmtDate(row.todo.dueDate)} · {TODO_STATUS_LABEL[row.todo.status]}
              {row.notUpdated && (
                <span className="ml-1.5 text-destructive font-medium">
                  · Not updated
                </span>
              )}
            </p>
          </div>
          <Button size="sm" variant="default" onClick={onComplete} disabled={busy}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Done
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 text-xs flex-1"
          />
          <Button size="sm" variant="outline" disabled={busy || !date} onClick={() => onReassign(date)}>
            Re-assign date
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={onIds}>
            → IDS
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Segment: IDS — Identify · Discuss · Solve
// ---------------------------------------------------------------------------

const IDS_PRIORITY_RANK: Record<Issue["priority"], number> = {
  critical: 0,
  high:     1,
  medium:   2,
  low:      3,
};

const ISSUE_PRIORITY_BADGE: Record<Issue["priority"], string> = {
  critical: "bg-red-500/15 text-red-600 border border-red-500/30",
  high:     "bg-orange-500/15 text-orange-600 border border-orange-500/30",
  medium:   "bg-sky-500/15 text-sky-600 border border-sky-500/20",
  low:      "bg-muted text-muted-foreground border border-border",
};

const ISSUE_RESOLUTION_MIN_LENGTH = 50;

type IdsResolutionMode = "none" | "close_no_action" | "create_todo" | "move_to_rock";

interface IdsPanelProps {
  meeting:  Meeting;
  detail:   MeetingDetail;
  members:  User[];
  userId:   string;
  isHost:   boolean;
  teamById: Record<string, Team>;
  onChange: () => void;
}

interface IdsActiveIssueProps {
  issue:    Issue;
  meeting:  Meeting;
  members:  User[];
  userId:   string;
  teamById: Record<string, Team>;
  onAdvance: () => void;
  onChange:  () => void;
}

function IdsPanel({ meeting, detail, members, userId, isHost, teamById, onChange }: IdsPanelProps) {
  const queue = useMemo(() => {
    return detail.issues
      .filter((i) => i.status !== "closed")
      .slice()
      .sort(
        (a, b) =>
          IDS_PRIORITY_RANK[a.priority] - IDS_PRIORITY_RANK[b.priority],
      );
  }, [detail.issues]);

  const [activeId, setActiveId] = useState<string | null>(queue[0]?.id ?? null);

  // Reset active when queue contents change (e.g. after close).
  useEffect(() => {
    if (!activeId || !queue.find((i) => i.id === activeId)) {
      setActiveId(queue[0]?.id ?? null);
    }
  }, [queue, activeId]);

  const active = activeId ? queue.find((i) => i.id === activeId) ?? null : null;

  function advance() {
    const idx = queue.findIndex((i) => i.id === activeId);
    const next = queue[idx + 1] ?? queue.find((i) => i.id !== activeId) ?? null;
    setActiveId(next?.id ?? null);
    onChange();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          IDS — Identify · Discuss · Solve ({queue.length})
        </h2>
        {!isHost && (
          <Badge variant="outline" className="text-[10px]">View-only · host drives</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-2">
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            Issue queue ({queue.length})
          </h3>
          {queue.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                Queue is clean.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1.5">
              {queue.map((i) => {
                const submitter = members.find((m) => m.id === i.submitterId);
                const dept      = teamById[i.targetDeptId];
                return (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => setActiveId(i.id)}
                    className={
                      "w-full text-left rounded-md border px-3 py-2 transition-colors " +
                      (activeId === i.id
                        ? "border-primary/50 bg-primary/5"
                        : "border-border hover:bg-muted/40")
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium line-clamp-2">{i.title}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${ISSUE_PRIORITY_BADGE[i.priority]}`}>
                        {i.priority}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                      <span className="truncate">{submitter?.name ?? "—"}</span>
                      {dept && (
                        <>
                          <span>→</span>
                          <span className="truncate">{dept.name}</span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="pt-2">
            <IdsQuickAdd meeting={meeting} userId={userId} onAdded={onChange} />
          </div>
        </div>

        <div className="lg:col-span-2">
          {active ? (
            <IdsActiveIssue
              issue={active}
              meeting={meeting}
              members={members}
              userId={userId}
              teamById={teamById}
              onAdvance={advance}
              onChange={onChange}
            />
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No active issue. Add one to the queue or advance to Wrap-Up.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

interface IdsQuickAddProps {
  meeting: Meeting;
  userId:  string;
  onAdded: () => void;
}

function IdsQuickAdd({ meeting, userId, onAdded }: IdsQuickAddProps) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function add() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await $fetch<{ issue?: Issue; error?: string; message?: string }>(
        "/api/issues",
        {
          method: "POST",
          body:   JSON.stringify({
            title:        title.trim(),
            submitterId:  userId,
            targetDeptId: meeting.teamId,
            sourceTeamId: meeting.teamId,
            priority:     "medium",
            meetingId:    meeting.id,
          }),
        },
      );
      if (res?.error) { setError(res.message ?? res.error); return; }
      setTitle("");
      onAdded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add issue");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-dashed">
      <CardContent className="py-3 space-y-2">
        <Label htmlFor="ids-quick" className="text-xs">Quick-add issue</Label>
        <div className="flex gap-1.5">
          <Input
            id="ids-quick"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's the issue?"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            className="h-8 text-sm"
          />
          <Button size="sm" onClick={add} disabled={saving || !title.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function IdsActiveIssue(
  { issue, meeting, members, userId, teamById, onAdvance, onChange }: IdsActiveIssueProps,
) {
  const [mode, setMode] = useState<IdsResolutionMode>("none");
  const [completed, setCompleted] = useState(false);

  // Whenever the active issue changes, reset the resolution panel.
  useEffect(() => { setMode("none"); setCompleted(false); }, [issue.id]);

  const submitter = members.find((m) => m.id === issue.submitterId);
  const dept      = teamById[issue.targetDeptId];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold">{issue.title}</CardTitle>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <span>{submitter?.name ?? "—"}</span>
              {dept && (<><span>→</span><span>{dept.name}</span></>)}
            </div>
          </div>
          <span className={`text-[11px] px-2 py-0.5 rounded shrink-0 ${ISSUE_PRIORITY_BADGE[issue.priority]}`}>
            {issue.priority}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {issue.description && (
          <div>
            <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">
              Description
            </h4>
            <p className="text-sm whitespace-pre-wrap">{issue.description}</p>
          </div>
        )}

        <div>
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">
            Discussion
          </h4>
          <Textarea
            rows={3}
            placeholder="Notes captured during discussion (not persisted — for in-room reference)"
          />
        </div>

        <div className="pt-2 border-t border-border space-y-3">
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            Resolution
          </h4>

          {!completed && mode === "none" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button
                variant="outline"
                onClick={() => setMode("close_no_action")}
              >
                Close: No Action
              </Button>
              <Button
                variant="outline"
                onClick={() => setMode("create_todo")}
              >
                Create To-Do
              </Button>
              <Button
                variant="outline"
                onClick={() => setMode("move_to_rock")}
              >
                Move to Rock
              </Button>
            </div>
          )}

          {!completed && mode === "close_no_action" && (
            <IdsCloseForm
              issue={issue}
              userId={userId}
              onCancel={() => setMode("none")}
              onDone={() => { setCompleted(true); onChange(); }}
            />
          )}

          {!completed && mode === "create_todo" && (
            <IdsCreateTodoForm
              issue={issue}
              meeting={meeting}
              members={members}
              userId={userId}
              onCancel={() => setMode("none")}
              onDone={() => { setCompleted(true); onChange(); }}
            />
          )}

          {!completed && mode === "move_to_rock" && (
            <IdsMoveToRockForm
              issue={issue}
              userId={userId}
              onCancel={() => setMode("none")}
              onDone={() => { setCompleted(true); onChange(); }}
            />
          )}

          <div className="flex items-center justify-between pt-1">
            <p className="text-[11px] text-muted-foreground">
              {completed
                ? "Resolution captured. Move to the next issue."
                : "Pick a resolution to unlock Next Issue."}
            </p>
            <Button
              size="sm"
              disabled={!completed}
              onClick={onAdvance}
            >
              Next Issue
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface IdsCloseFormProps {
  issue:   Issue;
  userId:  string;
  onCancel: () => void;
  onDone:   () => void;
}

function IdsCloseForm({ issue, userId, onCancel, onDone }: IdsCloseFormProps) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const trimmed = notes.trim().length;
  const remaining = Math.max(0, ISSUE_RESOLUTION_MIN_LENGTH - trimmed);

  async function close() {
    setSaving(true);
    setError(null);
    try {
      const res = await $fetch<{ issue?: Issue; error?: string; message?: string }>(
        `/api/issues/${issue.id}/close`,
        {
          method: "PUT",
          body:   JSON.stringify({
            resolutionNotes: notes,
            closedById:      userId,
          }),
        },
      );
      if (res?.error) { setError(res.message ?? res.error); return; }
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to close");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <Label htmlFor="ids-close-notes" className="text-xs">
        Resolution notes
        <span className="ml-1 text-muted-foreground">
          ({trimmed}/{ISSUE_RESOLUTION_MIN_LENGTH})
        </span>
      </Label>
      <Textarea
        id="ids-close-notes"
        rows={4}
        placeholder="What was decided, why no action is required, and what to watch."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      {remaining > 0 && (
        <p className="text-[11px] text-amber-600">
          {remaining} more character{remaining === 1 ? "" : "s"} required.
        </p>
      )}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={close} disabled={saving || remaining > 0}>
          {saving ? "Closing…" : "Close issue"}
        </Button>
      </div>
    </div>
  );
}

interface IdsCreateTodoFormProps {
  issue:    Issue;
  meeting:  Meeting;
  members:  User[];
  userId:   string;
  onCancel: () => void;
  onDone:   () => void;
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function IdsCreateTodoForm(
  { issue, meeting, members, userId, onCancel, onDone }: IdsCreateTodoFormProps,
) {
  const [title,      setTitle]      = useState(issue.title);
  const [assigneeId, setAssigneeId] = useState(issue.assignedToId ?? userId);
  const [dueDate,    setDueDate]    = useState(defaultDueDate());
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  async function create() {
    if (!title.trim())      { setError("Title is required."); return; }
    if (!assigneeId)        { setError("Pick an assignee.");  return; }
    if (!dueDate)           { setError("Pick a due date.");   return; }

    setSaving(true);
    setError(null);
    try {
      const todoRes = await $fetch<{ todo?: Todo; error?: string; message?: string }>(
        "/api/todos",
        {
          method: "POST",
          body:   JSON.stringify({
            title:     title.trim(),
            ownerId:   assigneeId,
            assignedToId: assigneeId,
            teamId:    meeting.teamId,
            meetingId: meeting.id,
            dueDate,
          }),
        },
      );
      if (todoRes?.error) { setError(todoRes.message ?? todoRes.error); return; }

      // Auto-close the issue with notes referencing the todo (≥50 chars).
      const assignee = members.find((m) => m.id === assigneeId);
      const notes =
        `Resolved during IDS by creating to-do for ${assignee?.name ?? "owner"} ` +
        `(due ${dueDate}): ${title.trim()}.`;

      const closeRes = await $fetch<{ issue?: Issue; error?: string; message?: string }>(
        `/api/issues/${issue.id}/close`,
        {
          method: "PUT",
          body:   JSON.stringify({ resolutionNotes: notes, closedById: userId }),
        },
      );
      if (closeRes?.error) { setError(closeRes.message ?? closeRes.error); return; }

      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create to-do");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="space-y-1.5">
        <Label htmlFor="ids-todo-title" className="text-xs">To-do title</Label>
        <Input
          id="ids-todo-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="ids-todo-assignee" className="text-xs">Assignee</Label>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger id="ids-todo-assignee">
              <SelectValue placeholder="Pick a person" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ids-todo-due" className="text-xs">Due date</Label>
          <Input
            id="ids-todo-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={create} disabled={saving}>
          {saving ? "Creating…" : "Create to-do"}
        </Button>
      </div>
    </div>
  );
}

interface IdsMoveToRockFormProps {
  issue:    Issue;
  userId:   string;
  onCancel: () => void;
  onDone:   () => void;
}

function IdsMoveToRockForm({ issue, userId, onCancel, onDone }: IdsMoveToRockFormProps) {
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  async function move() {
    setSaving(true);
    setError(null);
    try {
      // Mark as pending Rock creation: status → pending_closure and escalate
      // to Leadership so the next Quarterly picks it up for Day 3 conversion.
      const statusRes = await $fetch<{ issue?: Issue; error?: string; message?: string }>(
        `/api/issues/${issue.id}/status`,
        {
          method: "PUT",
          body:   JSON.stringify({ status: "pending_closure", userId }),
        },
      );
      if (statusRes?.error) { setError(statusRes.message ?? statusRes.error); return; }

      const escRes = await $fetch<{ issue?: Issue; error?: string; message?: string }>(
        `/api/issues/${issue.id}/escalate`,
        { method: "PUT" },
      );
      if (escRes?.error) { setError(escRes.message ?? escRes.error); return; }

      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to mark for Rock");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">
        This sends the issue to the Quarterly Leadership Meeting (Day 3) where
        it will be converted into a Rock. The issue stays open until then.
      </p>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={move} disabled={saving}>
          {saving ? "Marking…" : "Mark for Rock"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segment: Wrap-Up
// ---------------------------------------------------------------------------

interface WrapUpPanelProps {
  meeting:  Meeting;
  detail:   MeetingDetail;
  members:  User[];
  userId:   string;
  isHost:   boolean;
  onClosed: () => void;
}

interface GateState {
  openIds:        Issue[];
  todosMissing:   Todo[];
  todosUnhandled: Todo[];
}

function WrapUpPanel({ meeting, detail, members, userId, isHost, onClosed }: WrapUpPanelProps) {
  const [rating, setRating]  = useState<number>(8);
  const [reason, setReason]  = useState("");
  const [fathom, setFathom]  = useState(meeting.fathomUrl ?? "");
  const [nextHostId, setNextHostId] = useState<string>(meeting.hostId ?? "");
  const [closing, setClosing] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const gate = useMemo<GateState>(() => {
    return {
      openIds: detail.issues.filter((i) => i.status !== "closed"),
      todosMissing: detail.todos.filter((t) => !t.assignedToId || !t.dueDate),
      todosUnhandled: detail.todos.filter(
        (t) => t.acknowledgedAt === null && (!t.carryOverReason || !t.carryOverReason.trim()),
      ),
    };
  }, [detail]);

  const allPass = gate.openIds.length === 0 && gate.todosMissing.length === 0 && gate.todosUnhandled.length === 0;

  async function submitRating() {
    if (rating < 5 && !reason.trim()) {
      setError("A reason is required for ratings below 5.");
      return;
    }
    setError(null);
    await $fetch(`/api/meetings/${meeting.id}/rate`, {
      method: "POST",
      body:   JSON.stringify({ memberId: userId, rating, reason: reason.trim() || undefined }),
    });
  }

  async function saveMeta() {
    await $fetch(`/api/meetings/${meeting.id}`, {
      method: "PATCH",
      body:   JSON.stringify({
        fathomUrl: fathom.trim() || null,
        hostId:    nextHostId || null,
      }),
    });
  }

  async function close() {
    setClosing(true);
    setError(null);
    try {
      await saveMeta();
      const res = await $fetch<{ error?: string; message?: string }>(
        `/api/meetings/${meeting.id}/live/close`,
        { method: "POST" },
      );
      if (res?.error) { setError(res.message ?? res.error); return; }
      onClosed();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Close failed");
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Star className="h-5 w-5 text-primary" />
        Wrap-Up &amp; Ratings
      </h2>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Close conditions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <GateRow
            label={`Zero open IDS items (${gate.openIds.length} remaining)`}
            ok={gate.openIds.length === 0}
          />
          <GateRow
            label={`All to-dos have an assignee + due date (${gate.todosMissing.length} missing)`}
            ok={gate.todosMissing.length === 0}
          />
          <GateRow
            label={`All to-dos acknowledged or flagged (${gate.todosUnhandled.length} pending)`}
            ok={gate.todosUnhandled.length === 0}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Your rating</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="wrap-rating">Rating (1–10)</Label>
              <Input
                id="wrap-rating"
                type="number"
                min={1}
                max={10}
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
              />
            </div>
            {rating < 5 && (
              <div className="space-y-1.5">
                <Label htmlFor="wrap-reason" className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  Reason (required)
                </Label>
                <Textarea
                  id="wrap-reason"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            )}
            <Button size="sm" onClick={submitRating}>Submit rating</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Session metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="wrap-fathom">Fathom recording URL</Label>
              <Input
                id="wrap-fathom"
                placeholder="https://fathom.video/…"
                value={fathom}
                onChange={(e) => setFathom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wrap-nexthost">Next host</Label>
              <Select value={nextHostId} onValueChange={setNextHostId}>
                <SelectTrigger id="wrap-nexthost" className="w-full">
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {isHost && (
        <div className="flex justify-end">
          <Button
            size="lg"
            disabled={!allPass || closing}
            onClick={close}
          >
            {closing ? "Closing…" : "Close session"}
          </Button>
        </div>
      )}
    </div>
  );
}

function GateRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-destructive" />
      )}
      <span className={ok ? "" : "text-destructive"}>{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function LiveSessionPage() {
  const { meetingId, userId } = readQuery();
  const now = useTicker();

  const [detail,   setDetail]   = useState<MeetingDetail | null>(null);
  const [team,     setTeam]     = useState<Team | null>(null);
  const [teams,    setTeams]    = useState<Team[]>([]);
  const [members,  setMembers]  = useState<User[]>([]);
  const [segments, setSegments] = useState<MeetingSegment[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!meetingId) { setLoading(false); return; }
    try {
      const [d, segsRes] = await Promise.all([
        $fetch<MeetingDetail>(`/api/meetings/${meetingId}`),
        $fetch<{ segments: MeetingSegment[] }>(`/api/meetings/${meetingId}/segments`),
      ]);
      setDetail(d);
      setSegments(segsRes.segments ?? []);

      if (d?.meeting) {
        const [tRes, uRes] = await Promise.all([
          $fetch<{ teams: Team[] }>("/api/teams"),
          $fetch<{ users: User[] }>(`/api/teams/${d.meeting.teamId}/members`).catch(() => ({ users: [] as User[] })),
        ]);
        const teamList = tRes.teams ?? [];
        setTeams(teamList);
        setTeam(teamList.find((t) => t.id === d.meeting.teamId) ?? null);
        setMembers(uRes.users ?? []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load session");
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => { load(); }, [load]);

  const meeting = detail?.meeting ?? null;
  const isHost  = !!(meeting && userId && meeting.hostId === userId);

  const currentSeg  = findCurrentSegment(segments);
  const currentName = (currentSeg?.segmentName ?? null) as SegmentName | null;
  const currentDef  = SEGMENTS.find((s) => s.key === currentName) ?? null;

  const segmentStarted = currentSeg ? new Date(currentSeg.startedAt).getTime() : null;
  const meetingStarted = meeting?.startedAt ? new Date(meeting.startedAt).getTime() : null;

  // Auto-open the live session if it's still 'upcoming' and the host loaded the page.
  useEffect(() => {
    if (!meeting || !isHost) return;
    if (meeting.status === "upcoming") {
      $fetch(`/api/meetings/${meeting.id}/live/open`, { method: "POST" })
        .then(() => load())
        .catch(() => {});
    }
  }, [meeting, isHost, load]);

  async function advance(target: SegmentName) {
    if (!meeting) return;
    setAdvancing(true);
    setError(null);
    try {
      const res = await $fetch<{ error?: string; message?: string }>(
        `/api/meetings/${meeting.id}/live/advance`,
        { method: "POST", body: JSON.stringify({ segment: target }) },
      );
      if (res?.error) { setError(res.message ?? res.error); return; }
      await load();
    } finally {
      setAdvancing(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading live session…</p>
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

  if (meeting.status === "closed") {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-6 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
            <p className="text-sm">This session has been closed.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (meeting.status === "pending_close") {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-6 text-center space-y-2">
            <Clock className="h-8 w-8 text-primary mx-auto" />
            <p className="text-sm font-medium">Session pending close.</p>
            <p className="text-xs text-muted-foreground">
              Awaiting summary delivery before final closure.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <TopBar
        meeting={meeting}
        team={team}
        current={currentDef}
        segmentStarted={segmentStarted}
        meetingStarted={meetingStarted}
        now={now}
      />

      <div className="flex-1 flex min-h-0">
        <AgendaSidebar
          segments={segments}
          current={currentName}
          isHost={isHost}
          onAdvance={advance}
          advancing={advancing}
        />

        <main className="flex-1 min-w-0 overflow-auto">
          <div className="p-6 max-w-5xl mx-auto">
            {error && (
              <Card className="border-destructive/40 bg-destructive/5 mb-4">
                <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
              </Card>
            )}

            {currentName === "check_in" && (
              <CheckInPanel meetingId={meeting.id} members={members} />
            )}
            {currentName === "rock_review" && (
              <RockReviewPanel
                meetingId={meeting.id}
                userId={userId}
                members={members}
                onParked={load}
              />
            )}
            {currentName === "scorecard_review" && (
              <ScorecardPanel meeting={meeting} userId={userId} onParked={load} />
            )}
            {currentName === "headlines" && (
              <HeadlinesPanel meeting={meeting} userId={userId} onParked={load} />
            )}
            {currentName === "todo_review" && (
              <TodoReviewPanel meeting={meeting} userId={userId} members={members} onParked={load} />
            )}
            {currentName === "ids" && detail && (
              <IdsPanel
                meeting={meeting}
                detail={detail}
                members={members}
                userId={userId}
                isHost={isHost}
                teamById={Object.fromEntries(teams.map((t) => [t.id, t]))}
                onChange={load}
              />
            )}
            {currentName === "wrap_up" && detail && (
              <WrapUpPanel
                meeting={meeting}
                detail={detail}
                members={members}
                userId={userId}
                isHost={isHost}
                onClosed={load}
              />
            )}
            {!currentName && (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  Session has no active segment yet.
                  {isHost && (
                    <div className="mt-3">
                      <Button size="sm" onClick={() => advance("check_in")} disabled={advancing}>
                        Start with Check-In
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>

      <ParkToIdsButton meeting={meeting} userId={userId} onAdded={load} />
    </div>
  );
}
