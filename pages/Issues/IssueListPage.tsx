import { useCallback, useEffect, useMemo, useState } from "react";
import { $fetch } from "@mspbots/fetch";
import {
  Badge,
  Button,
  Card,
  CardContent,
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
  Filter,
  Flag,
  Plus,
  RefreshCw,
  Search,
  Zap,
} from "lucide-react";

export const meta = {
  label: "Issues",
  icon:  "Zap",
  order: 6,
  menu:  true,
};

// ---------------------------------------------------------------------------
// Types (mirror service/schema.ts and domain types)
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

interface Team {
  id:   string;
  name: string;
  type: string;
}

interface User {
  id:     string;
  name:   string;
  email:  string;
  role:   string;
  teamId: string | null;
}

interface Filters {
  dept:                  string;
  status:                IssueStatus | "";
  priority:              IssuePriority | "";
  dateFrom:              string;
  dateTo:                string;
  submitter:             string;
  assignedTo:            string;
  meetingId:             string;
  escalatedToLeadership: boolean;
  search:                string;
}

const EMPTY_FILTERS: Filters = {
  dept:                  "",
  status:                "",
  priority:              "",
  dateFrom:              "",
  dateTo:                "",
  submitter:             "",
  assignedTo:            "",
  meetingId:             "",
  escalatedToLeadership: false,
  search:                "",
};

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

/**
 * Status badge colors per the IDS spec:
 *   Open (red), Assigned (yellow), In Progress (blue),
 *   Pending Closure (orange), Closed (green).
 *
 * @mspbots/ui Badge variants don't include "warning"/"info"/"success" out of
 * the box, so we use className overrides for the precise palette.
 */
const STATUS_CLASS: Record<IssueStatus, string> = {
  open:            "bg-red-500/15 text-red-600 border border-red-500/30",
  assigned:        "bg-amber-500/15 text-amber-600 border border-amber-500/30",
  in_progress:     "bg-sky-500/15 text-sky-600 border border-sky-500/30",
  pending_closure: "bg-orange-500/15 text-orange-600 border border-orange-500/30",
  closed:          "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30",
};

const PRIORITY_CLASS: Record<IssuePriority, string> = {
  low:      "bg-muted text-muted-foreground border border-border",
  medium:   "bg-sky-500/10 text-sky-600 border border-sky-500/20",
  high:     "bg-orange-500/15 text-orange-600 border border-orange-500/30",
  critical: "bg-red-500/15 text-red-600 border border-red-500/30",
};

const STATUS_OPTIONS: IssueStatus[] = [
  "open",
  "assigned",
  "in_progress",
  "pending_closure",
  "closed",
];

const PRIORITY_OPTIONS: IssuePriority[] = ["low", "medium", "high", "critical"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });
}

function readQuery() {
  const p = new URLSearchParams(window.location.search);
  return { userId: p.get("userId") ?? "" };
}

function buildQueryString(f: Filters): string {
  const params: Record<string, string> = {};
  if (f.dept)                  params.dept       = f.dept;
  if (f.status)                params.status     = f.status;
  if (f.priority)              params.priority   = f.priority;
  if (f.dateFrom)              params.dateFrom   = f.dateFrom;
  if (f.dateTo)                params.dateTo     = f.dateTo;
  if (f.submitter)             params.submitter  = f.submitter;
  if (f.assignedTo)            params.assignedTo = f.assignedTo;
  if (f.meetingId)             params.meetingId  = f.meetingId;
  if (f.escalatedToLeadership) params.escalatedToLeadership = "true";
  const qs = new URLSearchParams(params).toString();
  return qs ? `?${qs}` : "";
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

interface FilterBarProps {
  teams:   Team[];
  members: User[];
  filters: Filters;
  onChange: (next: Filters) => void;
  onClear:  () => void;
}

function FilterBar({ teams, members, filters, onChange, onClear }: FilterBarProps) {
  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            Filters
          </h3>
          <Button size="sm" variant="ghost" onClick={onClear}>
            Clear all
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="f-dept" className="text-xs">Department</Label>
            <Select value={filters.dept || "any"} onValueChange={(v) => set("dept", v === "any" ? "" : v)}>
              <SelectTrigger id="f-dept">
                <SelectValue placeholder="Any department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any department</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-status" className="text-xs">Status</Label>
            <Select value={filters.status || "any"} onValueChange={(v) => set("status", (v === "any" ? "" : v) as IssueStatus | "")}>
              <SelectTrigger id="f-status">
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any status</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-priority" className="text-xs">Priority</Label>
            <Select value={filters.priority || "any"} onValueChange={(v) => set("priority", (v === "any" ? "" : v) as IssuePriority | "")}>
              <SelectTrigger id="f-priority">
                <SelectValue placeholder="Any priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any priority</SelectItem>
                {PRIORITY_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-submitter" className="text-xs">Submitter</Label>
            <Select value={filters.submitter || "any"} onValueChange={(v) => set("submitter", v === "any" ? "" : v)}>
              <SelectTrigger id="f-submitter">
                <SelectValue placeholder="Any submitter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any submitter</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-assigned" className="text-xs">Assigned to</Label>
            <Select value={filters.assignedTo || "any"} onValueChange={(v) => set("assignedTo", v === "any" ? "" : v)}>
              <SelectTrigger id="f-assigned">
                <SelectValue placeholder="Anyone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Anyone</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-from" className="text-xs">Date from</Label>
            <Input
              id="f-from"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => set("dateFrom", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-to" className="text-xs">Date to</Label>
            <Input
              id="f-to"
              type="date"
              value={filters.dateTo}
              onChange={(e) => set("dateTo", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-search" className="text-xs">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id="f-search"
                value={filters.search}
                placeholder="Title or description"
                onChange={(e) => set("search", e.target.value)}
                className="pl-7"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant={filters.escalatedToLeadership ? "default" : "outline"}
            onClick={() => set("escalatedToLeadership", !filters.escalatedToLeadership)}
          >
            <Flag className="h-3.5 w-3.5 mr-1.5" />
            {filters.escalatedToLeadership ? "Showing escalated" : "Escalated to Leadership"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// New Issue Modal
// ---------------------------------------------------------------------------

interface NewIssueModalProps {
  teams:   Team[];
  userId:  string;
  user:    User | null;
  onSaved: () => void;
  onClose: () => void;
}

function NewIssueModal({ teams, userId, user, onSaved, onClose }: NewIssueModalProps) {
  const [title,        setTitle]        = useState("");
  const [description,  setDescription]  = useState("");
  const [targetDeptId, setTargetDeptId] = useState(user?.teamId ?? teams[0]?.id ?? "");
  const [priority,     setPriority]     = useState<IssuePriority>("medium");
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  async function save() {
    if (!title.trim())     { setError("Title is required."); return; }
    if (!targetDeptId)     { setError("Select a target department."); return; }
    if (!userId)           { setError("Submitter could not be identified."); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await $fetch<{ issue?: Issue; error?: string; message?: string }>(
        "/api/issues",
        {
          method: "POST",
          body:   JSON.stringify({
            title:        title.trim(),
            description:  description.trim() || undefined,
            submitterId:  userId,
            targetDeptId,
            priority,
          }),
        },
      );
      if (res?.error) { setError(res.message ?? res.error); return; }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save issue");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-card border border-border rounded-lg shadow-lg p-6 space-y-3">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          New Issue
        </h3>

        <div className="space-y-1.5">
          <Label htmlFor="ni-title">Title</Label>
          <Input
            id="ni-title"
            value={title}
            placeholder="What needs to be solved?"
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ni-desc">Description</Label>
          <Textarea
            id="ni-desc"
            rows={3}
            value={description}
            placeholder="Symptom, impact, what you've tried…"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ni-dept">Target department</Label>
            <Select value={targetDeptId} onValueChange={setTargetDeptId}>
              <SelectTrigger id="ni-dept">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ni-priority">Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as IssuePriority)}>
              <SelectTrigger id="ni-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Create issue"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Issue table row
// ---------------------------------------------------------------------------

interface IssueRowProps {
  issue:        Issue;
  teamById:     Record<string, Team>;
  memberById:   Record<string, User>;
  onClick:      () => void;
}

function IssueRow({ issue, teamById, memberById, onClick }: IssueRowProps) {
  const submitter = memberById[issue.submitterId];
  const assignee  = issue.assignedToId ? memberById[issue.assignedToId] : null;
  const dept      = teamById[issue.targetDeptId];

  return (
    <tr
      className="border-b border-border hover:bg-muted/40 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <td className="px-3 py-2.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{issue.title}</p>
            {issue.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">{issue.description}</p>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              {issue.escalateToLeadership && (
                <Badge className="text-[10px] bg-purple-500/15 text-purple-600 border border-purple-500/30">
                  <Flag className="h-3 w-3 mr-0.5" /> Leadership
                </Badge>
              )}
              {issue.isFathomSource && (
                <Badge variant="outline" className="text-[10px]">Fathom</Badge>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-sm">{dept?.name ?? "—"}</td>
      <td className="px-3 py-2.5">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${STATUS_CLASS[issue.status]}`}>
          {STATUS_LABEL[issue.status]}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${PRIORITY_CLASS[issue.priority]}`}>
          {issue.priority}
        </span>
      </td>
      <td className="px-3 py-2.5 text-sm text-muted-foreground">
        {submitter?.name ?? "—"}
      </td>
      <td className="px-3 py-2.5 text-sm text-muted-foreground">
        {assignee?.name ?? <span className="italic">Unassigned</span>}
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">
        {fmtDate(issue.createdAt)}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function IssueListPage() {
  const { userId } = readQuery();

  const [issues,    setIssues]    = useState<Issue[]>([]);
  const [teams,     setTeams]     = useState<Team[]>([]);
  const [members,   setMembers]   = useState<User[]>([]);
  const [me,        setMe]        = useState<User | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [filters,   setFilters]   = useState<Filters>(EMPTY_FILTERS);
  const [showNew,   setShowNew]   = useState(false);

  const teamById = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t])),
    [teams],
  );
  const memberById = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members],
  );

  const loadIssues = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await $fetch<{ items: Issue[]; total: number }>(
        `/api/issues${buildQueryString(filters)}`,
      );
      setIssues(res.items ?? []);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load issues");
    } finally {
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [tRes, uRes] = await Promise.all([
          $fetch<{ teams: Team[] }>("/api/teams"),
          $fetch<{ users: User[] }>("/api/users"),
        ]);
        if (cancelled) return;
        setTeams(tRes.teams ?? []);
        setMembers(uRes.users ?? []);
        setMe((uRes.users ?? []).find((u) => u.id === userId) ?? null);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load reference data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => { loadIssues(); }, [loadIssues]);

  const visible = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    if (!q) return issues;
    return issues.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q),
    );
  }, [issues, filters.search]);

  function openDetail(id: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("issueId", id);
    window.location.href = `/issue-detail?${params.toString()}`;
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading issues…</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Company Issue List (IDS)
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Every open issue across MSPBots — visible to all employees.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadIssues} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Issue
          </Button>
        </div>
      </div>

      <FilterBar
        teams={teams}
        members={members}
        filters={filters}
        onChange={setFilters}
        onClear={() => setFilters(EMPTY_FILTERS)}
      />

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-3 flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Issue</th>
                  <th className="px-3 py-2 font-medium">Department</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Priority</th>
                  <th className="px-3 py-2 font-medium">Submitter</th>
                  <th className="px-3 py-2 font-medium">Assigned to</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-12 text-center text-sm text-muted-foreground">
                      No issues match the current filters.
                    </td>
                  </tr>
                ) : (
                  visible.map((i) => (
                    <IssueRow
                      key={i.id}
                      issue={i}
                      teamById={teamById}
                      memberById={memberById}
                      onClick={() => openDetail(i.id)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Showing {visible.length} of {issues.length} issues.
      </p>

      {showNew && (
        <NewIssueModal
          teams={teams}
          userId={userId}
          user={me}
          onSaved={() => { setShowNew(false); loadIssues(); }}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}
