import { useState, useEffect } from "react";
import { $fetch } from "@mspbots/fetch";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@mspbots/ui";
import { Users, Calendar, Settings2, RefreshCw, ArrowRight } from "lucide-react";

export const meta = {
  label: "Dashboard",
  icon:  "Home",
  order: 1,
  menu:  true,
};

interface Team {
  id:   string;
  name: string;
  type: "l10" | "quarterly" | "both";
}

const TYPE_LABEL: Record<Team["type"], string> = {
  l10:       "L10",
  quarterly: "Quarterly",
  both:      "L10 + Quarterly",
};

const ADMIN_PAGES = [
  {
    label:       "Teams & Members",
    description: "Manage the 6 MSPBots teams and staff role assignments.",
    icon:        Users,
    href:        "/admin/teams-page",
  },
  {
    label:       "Meetings",
    description: "Schedule L10 and Quarterly sessions, view host-prep checklists.",
    icon:        Calendar,
    href:        "/admin/meetings-page",
  },
  {
    label:       "Sync Settings",
    description: "Configure ClickUp migration sync and Teams webhook.",
    icon:        Settings2,
    href:        "/admin/sync-settings-page",
  },
] as const;

export default function Home() {
  const [teams,   setTeams]   = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await $fetch<{ teams: Team[] }>("/api/teams");
      setTeams(res.teams ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    try {
      await $fetch("/api/seed");
      await load();
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="p-6 space-y-10 max-w-5xl mx-auto">

      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">EOS Pulse</h1>
        <p className="text-muted-foreground">
          MSPBots' internal EOS operating layer — L10 meetings, Rocks, IDS, and accountability.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Teams                                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Teams</h2>
          {!loading && teams.length === 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSeed}
              disabled={seeding}
            >
              <RefreshCw
                className={`h-4 w-4 mr-1.5 ${seeding ? "animate-spin" : ""}`}
              />
              Seed teams
            </Button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : teams.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 flex flex-col items-center gap-3">
              <Users className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No teams yet — click <strong>Seed teams</strong> to create the
                6 default MSPBots teams.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {teams.map((team) => (
              <Card
                key={team.id}
                className="hover:bg-muted/30 transition-colors"
              >
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-semibold leading-tight">
                      {team.name}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {TYPE_LABEL[team.type]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{TYPE_LABEL[team.type]} team</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Admin quick-nav                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Admin</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ADMIN_PAGES.map(({ label, description, icon: Icon, href }) => (
            <a key={href} href={href} className="block group">
              <Card className="h-full hover:bg-muted/30 transition-colors cursor-pointer">
                <CardHeader className="pb-1 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <CardTitle className="text-sm font-semibold">
                        {label}
                      </CardTitle>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {description}
                  </p>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      </section>

    </div>
  );
}
