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
import { Users, Plus, Pencil, ChevronRight, RefreshCw } from "lucide-react";

export const meta = {
  label: "Teams",
  icon:  "Users",
  order: 3,
  menu:  ["super_admin"],
  route: (roles: string[]) => roles.includes("super_admin"),
};

// ---------------------------------------------------------------------------
// Types (mirrors service/schema.ts)
// ---------------------------------------------------------------------------

interface Team {
  id:        string;
  name:      string;
  type:      "l10" | "quarterly" | "both";
  createdAt: string;
}

interface User {
  id:        string;
  name:      string;
  email:     string;
  role:      "super_admin" | "leadership" | "team_lead" | "host" | "member";
  teamId:    string | null;
  createdAt: string;
}

const ROLES: User["role"][] = [
  "super_admin",
  "leadership",
  "team_lead",
  "host",
  "member",
];

const TYPE_LABEL: Record<Team["type"], string> = {
  l10:       "L10",
  quarterly: "Quarterly",
  both:      "Both",
};

const ROLE_VARIANT: Record<
  User["role"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  super_admin: "destructive",
  leadership:  "default",
  team_lead:   "default",
  host:        "secondary",
  member:      "outline",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roleLabel(role: User["role"]) {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MemberRow({
  user,
  teams,
  onEdit,
}: {
  user: User;
  teams: Team[];
  onEdit: (user: User) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 group">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary shrink-0">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{user.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <Badge variant={ROLE_VARIANT[user.role]}>{roleLabel(user.role)}</Badge>
        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
          onClick={() => onEdit(user)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit / Add User Modal
// ---------------------------------------------------------------------------

interface UserModalProps {
  user:   User | null; // null = add mode
  teams:  Team[];
  onSave: (data: Partial<User> & { name: string; email: string; role: User["role"] }) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

function UserModal({ user, teams, onSave, onClose, saving }: UserModalProps) {
  const [name,   setName]   = useState(user?.name   ?? "");
  const [email,  setEmail]  = useState(user?.email  ?? "");
  const [role,   setRole]   = useState<User["role"]>(user?.role ?? "member");
  const [teamId, setTeamId] = useState<string>(user?.teamId ?? "");
  const [error,  setError]  = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSave({ name, email, role, teamId: teamId || null } as any);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-lg shadow-lg p-6">
        <h2 className="text-lg font-semibold mb-4">
          {user ? "Edit Member" : "Add Member"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@mspbots.ai"
              required
              disabled={!!user} // email is immutable after creation
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as User["role"])}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="team">Primary Team</Label>
            <select
              id="team"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">— No team —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : user ? "Save changes" : "Add member"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TeamsPage() {
  const [teams,          setTeams]          = useState<Team[]>([]);
  const [selectedTeam,   setSelectedTeam]   = useState<Team | null>(null);
  const [members,        setMembers]        = useState<User[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [seeding,        setSeeding]        = useState(false);
  const [showModal,      setShowModal]      = useState(false);
  const [editingUser,    setEditingUser]    = useState<User | null>(null);
  const [saving,         setSaving]         = useState(false);
  const [seedResult,     setSeedResult]     = useState<string | null>(null);

  // Load teams on mount
  useEffect(() => {
    loadTeams();
  }, []);

  async function loadTeams() {
    setLoading(true);
    try {
      const res = await $fetch<{ teams: Team[] }>("/api/teams");
      setTeams(res.teams ?? []);
    } finally {
      setLoading(false);
    }
  }

  const loadMembers = useCallback(async (teamId: string) => {
    setMembersLoading(true);
    try {
      const res = await $fetch<{ team: Team; members: User[] }>(
        `/api/teams/${teamId}/members`,
      );
      setMembers(res.members ?? []);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  async function handleSelectTeam(team: Team) {
    setSelectedTeam(team);
    await loadMembers(team.id);
  }

  async function handleSeed() {
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await $fetch<{ ok: boolean; created: string[]; skipped: string[] }>(
        "/api/seed",
      );
      const msg =
        res.created.length > 0
          ? `Created: ${res.created.join(", ")}`
          : "All teams already exist — nothing to seed.";
      setSeedResult(msg);
      await loadTeams();
    } finally {
      setSeeding(false);
    }
  }

  async function handleSaveUser(
    data: Partial<User> & { name: string; email: string; role: User["role"] },
  ) {
    setSaving(true);
    try {
      if (editingUser) {
        await $fetch(`/api/users/${editingUser.id}`, {
          method: "PUT",
          body:   JSON.stringify({ name: data.name, role: data.role, teamId: data.teamId }),
        });
      } else {
        await $fetch("/api/users", {
          method: "POST",
          body:   JSON.stringify(data),
        });
      }
      setShowModal(false);
      setEditingUser(null);
      if (selectedTeam) await loadMembers(selectedTeam.id);
    } finally {
      setSaving(false);
    }
  }

  function openAdd() {
    setEditingUser(null);
    setShowModal(true);
  }

  function openEdit(user: User) {
    setEditingUser(user);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingUser(null);
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Teams & Members</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage the 6 MSPBots teams and staff assignments.
          </p>
        </div>
        <div className="flex gap-2">
          {teams.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeed}
              disabled={seeding}
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${seeding ? "animate-spin" : ""}`} />
              Seed teams
            </Button>
          )}
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add member
          </Button>
        </div>
      </div>

      {seedResult && (
        <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
          {seedResult}
        </p>
      )}

      {/* Body: teams list + members panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Teams list */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Teams
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Loading…
                </div>
              ) : teams.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No teams yet.{" "}
                  <button
                    onClick={handleSeed}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Seed teams
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {teams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => handleSelectTeam(team)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors ${
                        selectedTeam?.id === team.id
                          ? "bg-muted font-medium"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{team.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <Badge variant="outline" className="text-xs">
                          {TYPE_LABEL[team.type]}
                        </Badge>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Members panel */}
        <div className="md:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  {selectedTeam ? `${selectedTeam.name} members` : "Members"}
                </CardTitle>
                {selectedTeam && (
                  <Badge variant="outline">{TYPE_LABEL[selectedTeam.type]}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!selectedTeam ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Select a team to view its members.
                  </p>
                </div>
              ) : membersLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Loading members…
                </div>
              ) : members.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">
                    No members in this team yet.
                  </p>
                  <Button size="sm" variant="outline" onClick={openAdd}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add first member
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[420px] pr-2">
                  <div className="space-y-0.5">
                    {members.map((member) => (
                      <MemberRow
                        key={member.id}
                        user={member}
                        teams={teams}
                        onEdit={openEdit}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <UserModal
          user={editingUser}
          teams={teams}
          onSave={handleSaveUser}
          onClose={closeModal}
          saving={saving}
        />
      )}
    </div>
  );
}
