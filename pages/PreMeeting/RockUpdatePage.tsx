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
import { Calendar, Mountain, AlertTriangle } from "lucide-react";

export const meta = {
  label: "Pre-Meeting Rock Update",
  icon:  "Mountain",
  order: 12,
  menu:  false,
};

type RockStatus =
  | "on_track"
  | "off_track"
  | "at_risk"
  | "blocked"
  | "on_hold"
  | "completed";

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

interface Meeting {
  id:          string;
  scheduledAt: string;
  type:        "l10" | "quarterly";
}

const STATUS_OPTIONS: { value: RockStatus; label: string }[] = [
  { value: "on_track",  label: "On track" },
  { value: "at_risk",   label: "At risk" },
  { value: "off_track", label: "Off track" },
  { value: "blocked",   label: "Blocked" },
  { value: "on_hold",   label: "On hold" },
  { value: "completed", label: "Completed" },
];

const STATUS_LABEL: Record<RockStatus, string> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s.label]),
) as Record<RockStatus, string>;

const COMMENT_REQUIRED: RockStatus[] = ["off_track", "blocked"];

const STATUS_VARIANT: Record<
  RockStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  on_track:  "default",
  at_risk:   "secondary",
  off_track: "destructive",
  blocked:   "destructive",
  on_hold:   "outline",
  completed: "secondary",
};

function readQuery() {
  const params = new URLSearchParams(window.location.search);
  return {
    meetingId: params.get("meetingId") ?? "",
    userId:    params.get("userId")    ?? "",
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

interface RockRowProps {
  row:       MeetingRockStatus;
  meetingId: string;
  userId:    string;
  onSaved:   () => void;
}

function RockRow({ row, meetingId, userId, onSaved }: RockRowProps) {
  const [status,  setStatus]  = useState<RockStatus>(row.latestEntry?.status ?? row.rock.status);
  const [comment, setComment] = useState<string>(row.latestEntry?.comment ?? "");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const commentRequired = COMMENT_REQUIRED.includes(status);

  async function save() {
    setError(null);
    if (commentRequired && !comment.trim()) {
      setError("A comment is required for Off Track or Blocked status.");
      return;
    }
    setSaving(true);
    try {
      const res = await $fetch<{ error?: string; message?: string }>(
        `/api/rocks/${row.rock.id}/status`,
        {
          method: "POST",
          body:   JSON.stringify({
            status,
            comment: comment.trim() || undefined,
            meetingId,
            userId,
          }),
        },
      );
      if (res?.error) {
        setError(res.message ?? res.error);
        return;
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold leading-snug">
              {row.rock.title}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Q{row.rock.quarter}-{row.rock.year} · current: {STATUS_LABEL[row.rock.status]}
            </p>
          </div>
          {row.preSubmitted && (
            <Badge variant="secondary" className="text-xs shrink-0">
              Pre-submitted
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`status-${row.rock.id}`}>Status for this meeting</Label>
          <select
            id={`status-${row.rock.id}`}
            value={status}
            onChange={(e) => setStatus(e.target.value as RockStatus)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <div>
            <Badge variant={STATUS_VARIANT[status]} className="text-xs">
              {STATUS_LABEL[status]}
            </Badge>
          </div>
        </div>

        {commentRequired && (
          <div className="space-y-1.5">
            <Label htmlFor={`comment-${row.rock.id}`} className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Comment (required)
            </Label>
            <Textarea
              id={`comment-${row.rock.id}`}
              rows={2}
              placeholder="What's blocking? What's the recovery plan?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        )}

        {!commentRequired && (
          <div className="space-y-1.5">
            <Label htmlFor={`comment-${row.rock.id}`}>Comment (optional)</Label>
            <Textarea
              id={`comment-${row.rock.id}`}
              rows={2}
              placeholder="Anything the team should know?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : row.preSubmitted ? "Update" : "Submit update"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RockUpdatePage() {
  const { meetingId, userId } = readQuery();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [rows,    setRows]    = useState<MeetingRockStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!meetingId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [mRes, rRes] = await Promise.all([
        $fetch<{ meeting: Meeting }>(`/api/meetings/${meetingId}`),
        $fetch<{ items: MeetingRockStatus[] }>(`/api/meetings/${meetingId}/rocks`),
      ]);
      setMeeting(mRes.meeting ?? null);
      const all = rRes.items ?? [];
      const mine = userId ? all.filter((r) => r.rock.ownerId === userId) : all;
      setRows(mine);
    } finally {
      setLoading(false);
    }
  }, [meetingId, userId]);

  useEffect(() => { load(); }, [load]);

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
    <div className="p-6 space-y-5 max-w-2xl mx-auto">

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Mountain className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold">Pre-Meeting Rock Update</h1>
        </div>
        {meeting && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{fmtDateTime(meeting.scheduledAt)}</span>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No rocks assigned to you for this team this quarter.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <RockRow
              key={r.rock.id}
              row={r}
              meetingId={meetingId}
              userId={userId}
              onSaved={load}
            />
          ))}
        </div>
      )}

    </div>
  );
}
