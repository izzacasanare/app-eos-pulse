import { useCallback, useEffect, useState } from "react";
import { $fetch } from "@mspbots/fetch";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@mspbots/ui";
import { Calendar, ExternalLink, Video } from "lucide-react";

export const meta = {
  label: "Fathom Recordings",
  icon:  "Video",
  order: 7,
  menu:  true,
};

interface Team { id: string; name: string }

interface FathomLink {
  meetingId:   string;
  scheduledAt: string;
  type:        string;
  fathomUrl:   string;
}

function readQuery() {
  const p = new URLSearchParams(window.location.search);
  return { teamId: p.get("teamId") ?? "" };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month:   "short",
    day:     "numeric",
    year:    "numeric",
  });
}

export default function FathomPage() {
  const { teamId: initial } = readQuery();

  const [teams,    setTeams]    = useState<Team[]>([]);
  const [teamId,   setTeamId]   = useState<string>(initial);
  const [links,    setLinks]    = useState<FathomLink[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  // Load teams once.
  useEffect(() => {
    (async () => {
      try {
        const res = await $fetch<{ teams: Team[] }>("/api/teams");
        const list = res.teams ?? [];
        setTeams(list);
        if (!initial && list.length > 0) {
          setTeamId(list[0].id);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load teams");
      }
    })();
  }, [initial]);

  const loadLinks = useCallback(async (id: string) => {
    if (!id) { setLinks([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await $fetch<{ links: FathomLink[] }>(
        `/api/teams/${id}/fathom-links`,
      );
      setLinks(res.links ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load Fathom links");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLinks(teamId); }, [teamId, loadLinks]);

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Fathom recordings
          </h1>
          <p className="text-sm text-muted-foreground">
            Every recorded session for the selected team, newest first.
          </p>
        </div>
        <div className="w-64">
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading recordings…</p>
      ) : links.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No Fathom recordings linked yet for this team.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <Card key={link.meetingId}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-semibold truncate">
                      <a
                        href={`/session?meetingId=${link.meetingId}`}
                        className="hover:underline"
                      >
                        Session · {fmtDate(link.scheduledAt)}
                      </a>
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{fmtDate(link.scheduledAt)}</span>
                      <Badge variant="outline" className="uppercase text-[10px] py-0 px-1.5">
                        {link.type}
                      </Badge>
                    </div>
                  </div>
                  <a
                    href={link.fathomUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
                  >
                    Open
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground truncate">
                {link.fathomUrl}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
