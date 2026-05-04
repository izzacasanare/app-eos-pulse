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
import { AlertTriangle, Calendar, CheckSquare } from "lucide-react";

export const meta = {
  label: "Pre-Meeting To-do Update",
  icon:  "CheckSquare",
  order: 13,
  menu:  false,
};

type TodoStatus = "open" | "done" | "blocked" | "carried";

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

interface MeetingTodoRow {
  todo:       Todo;
  notUpdated: boolean;
}

interface Meeting {
  id:          string;
  scheduledAt: string;
  type:        "l10" | "quarterly";
}

const STATUS_OPTIONS: { value: TodoStatus; label: string }[] = [
  { value: "open",    label: "Open" },
  { value: "done",    label: "Done" },
  { value: "blocked", label: "Blocked" },
  { value: "carried", label: "Carry over" },
];

const STATUS_LABEL: Record<TodoStatus, string> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s.label]),
) as Record<TodoStatus, string>;

const STATUS_VARIANT: Record<
  TodoStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  open:    "outline",
  done:    "default",
  blocked: "destructive",
  carried: "secondary",
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

function fmtDate(iso: string | null) {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });
}

interface TodoRowProps {
  row:     MeetingTodoRow;
  userId:  string;
  onSaved: () => void;
}

function TodoRow({ row, userId, onSaved }: TodoRowProps) {
  const [status, setStatus] = useState<TodoStatus>(row.todo.status);
  const [reason, setReason] = useState<string>(row.todo.carryOverReason ?? "");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const res = await $fetch<{ error?: string; message?: string }>(
        `/api/todos/${row.todo.id}/status`,
        {
          method: "POST",
          body:   JSON.stringify({
            status,
            reason: reason.trim() || undefined,
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
    <Card className={row.notUpdated ? "border-amber-300" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold leading-snug">
              {row.todo.title}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Due {fmtDate(row.todo.dueDate)} · current: {STATUS_LABEL[row.todo.status]}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant={STATUS_VARIANT[row.todo.status]} className="text-xs">
              {STATUS_LABEL[row.todo.status]}
            </Badge>
            {row.notUpdated && (
              <Badge variant="outline" className="text-xs flex items-center gap-1 border-amber-300 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                Not updated
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`tstatus-${row.todo.id}`}>New status</Label>
          <select
            id={`tstatus-${row.todo.id}`}
            value={status}
            onChange={(e) => setStatus(e.target.value as TodoStatus)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {(status === "blocked" || status === "carried") && (
          <div className="space-y-1.5">
            <Label htmlFor={`treason-${row.todo.id}`}>Reason</Label>
            <Textarea
              id={`treason-${row.todo.id}`}
              rows={2}
              placeholder={status === "blocked" ? "What's blocking?" : "Why carry it over?"}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Update status"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TodoUpdatePage() {
  const { meetingId, userId } = readQuery();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [rows,    setRows]    = useState<MeetingTodoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!meetingId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [mRes, tRes] = await Promise.all([
        $fetch<{ meeting: Meeting }>(`/api/meetings/${meetingId}`),
        $fetch<{ items: MeetingTodoRow[] }>(`/api/meetings/${meetingId}/todos`),
      ]);
      setMeeting(mRes.meeting ?? null);
      const all = tRes.items ?? [];
      const mine = userId ? all.filter((r) => r.todo.assignedToId === userId) : all;
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

  const notUpdatedCount = rows.filter((r) => r.notUpdated).length;

  return (
    <div className="p-6 space-y-5 max-w-2xl mx-auto">

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold">Pre-Meeting To-do Update</h1>
        </div>
        {meeting && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{fmtDateTime(meeting.scheduledAt)}</span>
          </div>
        )}
      </div>

      {notUpdatedCount > 0 && (
        <Card className="border-amber-300 bg-amber-50/40 dark:bg-amber-950/20">
          <CardContent className="py-3 flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>
              <strong>{notUpdatedCount}</strong> to-do{notUpdatedCount === 1 ? "" : "s"}
              {" "}haven't been updated within 1 hour of the meeting.
            </span>
          </CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No open to-dos for this meeting.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <TodoRow
              key={r.todo.id}
              row={r}
              userId={userId}
              onSaved={load}
            />
          ))}
        </div>
      )}

    </div>
  );
}
