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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@mspbots/ui";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flag,
  UserCheck,
  Zap,
} from "lucide-react";

export const meta = {
  label: "Issue detail",
  icon:  "Zap",
  order: 7,
  menu:  false,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IssueStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "pending_closure"
  | "closed";

type IssuePriority = "low" | "medium" | "high" | "critical";

interface Issue {
  id:                   string;
  title:                string;
  description:          string | null;
  submitterId:          string;
  sourceTeamId:         string;
  targetDeptId:         string;
  priority:             IssuePriority;
  status:               IssueStatus;
  assignedToId:         string | null;
  meetingId:            string | null;
  escalateToLeadership: boolean;
  resolutionNotes:      string | null;
  sopLink:              string | null;
  isFathomSource:       boolean;
  createdAt:            string;
  updatedAt:            string;
}

interface User {
  id:     string;
  name:   string;
  email:  string;
  role:   string;
  teamId: string | null;
}

interface Team { id: string; name: string; type: string }

const RESOLUTION_NOTES_MIN_LENGTH = 50;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<IssueStatus, string> = {
  open:            "Open",
  assigned:        "Assigned",
  in_progress:     "In Progress",
  pending_closure: "Pending Closure",
  closed:          "Closed",
};

const STATUS_CLASS: Record<IssueStatus, string> = {
  open:            "bg-red-500/15 text-red-600 border border-red-500/30",
  assigned:        "bg-amber-500/15 text-amber-600 border border-amber-500/30",
  in_progress:     "bg-sky-500/15 text-sky-600 border border-sky-500/30",
  pending_closure: "bg-orange-500/15 text-orange-600 border border-orange-500/30",
  closed:          "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30",
};

const STATUS_ORDER: IssueStatus[] = [
  "open",
  "assigned",
  "in_progress",
  "pending_closure",
  "closed",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readQuery() {
  const p = new URLSearchParams(window.location.search);
  return {
    issueId: p.get("issueId") ?? "",
    userId:  p.get("userId")  ?? "",
  };
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month:  "short",
    day:    "numeric",
    year:   "numeric",
    hour:   "numeric",
    minute: "2-digit",
  });
}

function isDeptLeadOf(user: User | null, deptId: string): boolean {
  if (!user) return false;
  return user.role === "team_lead" && user.teamId === deptId;
}

function canApproveClose(user: User | null, deptId: string): boolean {
  if (!user) return false;
  return (
    isDeptLeadOf(user, deptId) ||
    user.role === "leadership" ||
    user.role === "super_admin"
  );
}

function canEscalate(user: User | null): boolean {
  if (!user) return false;
  return user.role === "leadership" || user.role === "super_admin";
}

// ---------------------------------------------------------------------------
// Status timeline
// ---------------------------------------------------------------------------

function StatusTimeline({ status }: { status: IssueStatus }) {
  const currentIdx = STATUS_ORDER.indexOf(status);
  return (
    <div className="flex items-center gap-1.5">
      {STATUS_ORDER.map((s, i) => {
        const reached = i <= currentIdx;
        const active  = i === currentIdx;
        return (
          <div key={s} className="flex items-center gap-1.5">
            <div
              className={
                "h-2 w-2 rounded-full " +
                (active
                  ? "bg-primary ring-2 ring-primary/30"
                  : reached
                  ? "bg-primary"
                  : "bg-border")
              }
            />
            <span
              className={
                "text-xs " +
                (active ? "font-semibold" : reached ? "text-foreground" : "text-muted-foreground")
              }
            >
              {STATUS_LABEL[s]}
            </span>
            {i < STATUS_ORDER.length - 1 && (
              <span className="text-muted-foreground">·</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assign panel
// ---------------------------------------------------------------------------

interface AssignPanelProps {
  issue:    Issue;
  members:  User[];
  userId:   string;
  user:     User | null;
  onSaved:  () => void;
}

function AssignPanel({ issue, members, userId, user, onSaved }: AssignPanelProps) {
  const [assignedToId, setAssignedToId] = useState(issue.assignedToId ?? "");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const canAssign = isDeptLeadOf(user, issue.targetDeptId)
    || user?.role === "leadership"
    || user?.role === "super_admin";

  // Members of the target dept first; then the rest of the org for cross-dept work.
  const sortedMembers = useMemo(() => {
    const inDept = members.filter((m) => m.teamId === issue.targetDeptId);
    const others = members.filter((m) => m.teamId !== issue.targetDeptId);
    return [...inDept, ...others];
  }, [members, issue.targetDeptId]);

  if (!canAssign) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Assign resolver
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Only the Dept Lead of the target department (or Leadership) can assign a resolver.
          </p>
        </CardContent>
      </Card>
    );
  }

  async function save() {
    if (!assignedToId) { setError("Pick a resolver first."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await $fetch<{ issue?: Issue; error?: string; message?: string }>(
        `/api/issues/${issue.id}/assign`,
        {
          method: "PUT",
          body:   JSON.stringify({ assignedToId, assignedById: userId }),
        },
      );
      if (res?.error) { setError(res.message ?? res.error); return; }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to assign");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <UserCheck className="h-4 w-4" />
          Assign resolver
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Select value={assignedToId} onValueChange={setAssignedToId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a resolver" />
          </SelectTrigger>
          <SelectContent>
            {sortedMembers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}{m.teamId === issue.targetDeptId ? "" : " · external"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button size="sm" onClick={save} disabled={saving} className="w-full">
          {saving ? "Assigning…" : (issue.assignedToId ? "Re-assign" : "Assign")}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Close panel
// ---------------------------------------------------------------------------

interface ClosePanelProps {
  issue:   Issue;
  user:    User | null;
  userId:  string;
  onSaved: () => void;
}

function ClosePanel({ issue, user, userId, onSaved }: ClosePanelProps) {
  const [notes,   setNotes]   = useState(issue.resolutionNotes ?? "");
  const [sopLink, setSopLink] = useState(issue.sopLink ?? "");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const isResolver = !!issue.assignedToId && issue.assignedToId === userId;
  const canApprove = canApproveClose(user, issue.targetDeptId);

  // Resolver may submit notes (moves to pending_closure); only Dept Lead approval finalizes.
  if (!isResolver && !canApprove) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Close issue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Only the assigned resolver or the Dept Lead of the target department can close this issue.
          </p>
        </CardContent>
      </Card>
    );
  }

  const trimmedLength = notes.trim().length;
  const charsRemaining = Math.max(0, RESOLUTION_NOTES_MIN_LENGTH - trimmedLength);

  async function close() {
    if (trimmedLength < RESOLUTION_NOTES_MIN_LENGTH) {
      setError(
        `Resolution notes must be at least ${RESOLUTION_NOTES_MIN_LENGTH} characters ` +
        `(${trimmedLength} so far).`,
      );
      return;
    }
    if (!canApprove) {
      setError(
        "Closing requires Dept Lead approval. Save resolution notes and ask your Dept Lead to finalize.",
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await $fetch<{ issue?: Issue; error?: string; message?: string; currentLength?: number; requiredLength?: number }>(
        `/api/issues/${issue.id}/close`,
        {
          method: "PUT",
          body:   JSON.stringify({
            resolutionNotes: notes,
            sopLink:         sopLink.trim() || null,
            closedById:      userId,
          }),
        },
      );
      if (res?.error) {
        if (res.error === "RESOLUTION_NOTES_TOO_SHORT") {
          setError(
            `Server rejected: notes need ${res.requiredLength ?? RESOLUTION_NOTES_MIN_LENGTH} chars; got ${res.currentLength}.`,
          );
        } else {
          setError(res.message ?? res.error);
        }
        return;
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to close");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Close issue
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <div className="space-y-1.5">
          <Label htmlFor="close-notes" className="text-xs">
            Resolution notes
            <span className="ml-1 text-muted-foreground">
              ({trimmedLength}/{RESOLUTION_NOTES_MIN_LENGTH} min)
            </span>
          </Label>
          <Textarea
            id="close-notes"
            rows={5}
            value={notes}
            placeholder="What was the root cause? What was done to resolve it?"
            onChange={(e) => setNotes(e.target.value)}
          />
          {charsRemaining > 0 && (
            <p className="text-xs text-amber-600">
              {charsRemaining} more character{charsRemaining === 1 ? "" : "s"} required.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="close-sop" className="text-xs">SOP link (optional)</Label>
          <Input
            id="close-sop"
            placeholder="https://…"
            value={sopLink}
            onChange={(e) => setSopLink(e.target.value)}
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {!canApprove && (
          <p className="text-xs text-muted-foreground">
            You can save notes, but only the Dept Lead can finalize closure.
          </p>
        )}
        <Button
          size="sm"
          onClick={close}
          disabled={saving || charsRemaining > 0 || !canApprove}
          className="w-full"
        >
          {saving ? "Closing…" : "Close as resolved"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Escalate toggle
// ---------------------------------------------------------------------------

interface EscalatePanelProps {
  issue:   Issue;
  user:    User | null;
  onSaved: () => void;
}

function EscalatePanel({ issue, user, onSaved }: EscalatePanelProps) {
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  if (!canEscalate(user)) return null;

  async function toggle() {
    if (issue.escalateToLeadership) return; // one-way flag
    setSaving(true);
    setError(null);
    try {
      const res = await $fetch<{ issue?: Issue; error?: string; message?: string }>(
        `/api/issues/${issue.id}/escalate`,
        { method: "PUT" },
      );
      if (res?.error) { setError(res.message ?? res.error); return; }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to escalate");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Flag className="h-4 w-4" />
          Quarterly Leadership queue
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {issue.escalateToLeadership ? (
          <p className="text-xs text-foreground flex items-center gap-1.5">
            <Flag className="h-3.5 w-3.5 text-purple-600" />
            Already on the Leadership Quarterly queue.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Flagging adds this issue to the next Quarterly Leadership Meeting.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={toggle}
              disabled={saving}
              className="w-full"
            >
              {saving ? "Flagging…" : "Escalate to Leadership"}
            </Button>
          </>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function IssueDetailPage() {
  const { issueId, userId } = readQuery();

  const [issue,   setIssue]   = useState<Issue | null>(null);
  const [teams,   setTeams]   = useState<Team[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [me,      setMe]      = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!issueId) { setLoading(false); return; }
    try {
      const [issueRes, tRes, uRes] = await Promise.all([
        $fetch<{ issue?: Issue; error?: string; message?: string }>(`/api/issues/${issueId}`),
        $fetch<{ teams: Team[] }>("/api/teams"),
        $fetch<{ users: User[] }>("/api/users"),
      ]);
      if (issueRes?.error) {
        setError(issueRes.message ?? issueRes.error);
        setIssue(null);
      } else if (issueRes?.issue) {
        setIssue(issueRes.issue);
        setError(null);
      }
      setTeams(tRes.teams ?? []);
      setMembers(uRes.users ?? []);
      setMe((uRes.users ?? []).find((u) => u.id === userId) ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load issue");
    } finally {
      setLoading(false);
    }
  }, [issueId, userId]);

  useEffect(() => { load(); }, [load]);

  const teamById = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t])),
    [teams],
  );
  const memberById = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members],
  );

  function back() {
    const params = new URLSearchParams(window.location.search);
    params.delete("issueId");
    window.location.href = `/issue-list?${params.toString()}`;
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading issue…</p>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-3">
        <Button variant="ghost" size="sm" onClick={back}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to list
        </Button>
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-6 text-sm text-destructive">
            {error ?? "Issue not found."}
          </CardContent>
        </Card>
      </div>
    );
  }

  const submitter = memberById[issue.submitterId];
  const assignee  = issue.assignedToId ? memberById[issue.assignedToId] : null;
  const dept      = teamById[issue.targetDeptId];
  const source    = teamById[issue.sourceTeamId];

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={back}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to list
        </Button>
        <div className="flex items-center gap-1.5">
          {issue.escalateToLeadership && (
            <Badge className="text-[10px] bg-purple-500/15 text-purple-600 border border-purple-500/30">
              <Flag className="h-3 w-3 mr-0.5" /> Leadership
            </Badge>
          )}
          {issue.isFathomSource && (
            <Badge variant="outline" className="text-[10px]">Fathom source</Badge>
          )}
          {issue.meetingId && (
            <Badge variant="outline" className="text-[10px]">
              <Clock className="h-3 w-3 mr-0.5" />
              Meeting
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="py-4 space-y-3">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-semibold">{issue.title}</h1>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${STATUS_CLASS[issue.status]}`}>
                      {STATUS_LABEL[issue.status]}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {issue.priority}
                    </Badge>
                  </div>
                </div>
              </div>

              {issue.description && (
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">
                    Description
                  </h3>
                  <p className="text-sm whitespace-pre-wrap">{issue.description}</p>
                </div>
              )}

              <div className="pt-2 border-t border-border">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
                  Status timeline
                </h3>
                <StatusTimeline status={issue.status} />
              </div>
            </CardContent>
          </Card>

          {issue.resolutionNotes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Resolution notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm whitespace-pre-wrap">{issue.resolutionNotes}</p>
                {issue.sopLink && (
                  <a
                    href={issue.sopLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    SOP / runbook
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {issue.status !== "closed" && (
            <ClosePanel issue={issue} user={me} userId={userId} onSaved={load} />
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <DetailRow label="Submitter"     value={submitter?.name ?? issue.submitterId} />
              <DetailRow label="Source team"   value={source?.name ?? "—"} />
              <DetailRow label="Target dept"   value={dept?.name ?? "—"} />
              <DetailRow
                label="Assignee"
                value={assignee?.name ?? <em className="text-muted-foreground">Unassigned</em>}
              />
              <DetailRow label="Created"  value={fmtDateTime(issue.createdAt)} />
              <DetailRow label="Updated"  value={fmtDateTime(issue.updatedAt)} />
            </CardContent>
          </Card>

          {issue.status !== "closed" && (
            <AssignPanel
              issue={issue}
              members={members}
              userId={userId}
              user={me}
              onSaved={load}
            />
          )}

          {issue.status !== "closed" && (
            <EscalatePanel issue={issue} user={me} onSaved={load} />
          )}

          {!me && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="py-3 flex items-center gap-2 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                Open this page with <code className="text-[10px] bg-muted px-1 rounded mx-1">?userId=…</code>
                to enable role-gated actions.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}
