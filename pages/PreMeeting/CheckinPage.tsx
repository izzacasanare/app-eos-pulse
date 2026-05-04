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
import { Calendar, CheckCircle2, Heart, Briefcase } from "lucide-react";

export const meta = {
  label: "Pre-Meeting Check-in",
  icon:  "Heart",
  order: 10,
  menu:  false,
};

interface Meeting {
  id:          string;
  teamId:      string;
  type:        "l10" | "quarterly";
  scheduledAt: string;
  status:      string;
}

interface Checkin {
  id:                   string;
  memberId:             string;
  meetingId:            string;
  personalGoodNews:     string | null;
  professionalGoodNews: string | null;
  submittedAt:          string;
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

function readQuery() {
  const params = new URLSearchParams(window.location.search);
  return {
    meetingId: params.get("meetingId") ?? "",
    memberId:  params.get("memberId")  ?? "",
  };
}

export default function CheckinPage() {
  const { meetingId, memberId } = readQuery();

  const [meeting,  setMeeting]  = useState<Meeting | null>(null);
  const [checkin,  setCheckin]  = useState<Checkin | null>(null);
  const [personal, setPersonal] = useState("");
  const [professional, setProfessional] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!meetingId) { setLoading(false); return; }
    setLoading(true);
    try {
      const mRes = await $fetch<{ meeting: Meeting }>(`/api/meetings/${meetingId}`);
      setMeeting(mRes.meeting ?? null);

      const cRes = await $fetch<{ submitted: Checkin[] }>(
        `/api/meetings/${meetingId}/checkins`,
      );
      const own = (cRes.submitted ?? []).find((c) => c.memberId === memberId) ?? null;
      setCheckin(own);
      if (own) {
        setPersonal(own.personalGoodNews ?? "");
        setProfessional(own.professionalGoodNews ?? "");
      }
    } finally {
      setLoading(false);
    }
  }, [meetingId, memberId]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit() {
    if (!meetingId || !memberId) {
      setError("Missing meetingId or memberId in URL.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await $fetch<{ checkin: Checkin }>(
        `/api/meetings/${meetingId}/checkin`,
        {
          method: "POST",
          body:   JSON.stringify({
            memberId,
            personalGoodNews:     personal.trim()     || null,
            professionalGoodNews: professional.trim() || null,
          }),
        },
      );
      setCheckin(res.checkin);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSaving(false);
    }
  }

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
    <div className="p-6 space-y-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Pre-Meeting Check-in</h1>
        {meeting && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{fmtDateTime(meeting.scheduledAt)}</span>
            <Badge variant="outline" className="ml-1 uppercase">
              {meeting.type}
            </Badge>
          </div>
        )}
      </div>

      {/* Submitted state */}
      {checkin && (
        <Card className="border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <CardTitle className="text-sm font-semibold">
                Submitted {fmtDateTime(checkin.submittedAt)}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            You can update your check-in below until the meeting starts.
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Your good news</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="checkin-personal" className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-rose-500" />
              Personal good news
            </Label>
            <Textarea
              id="checkin-personal"
              rows={3}
              placeholder="Something good outside of work…"
              value={personal}
              onChange={(e) => setPersonal(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="checkin-professional" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-sky-500" />
              Professional good news
            </Label>
            <Textarea
              id="checkin-professional"
              rows={3}
              placeholder="A win, a milestone, a thank-you…"
              value={professional}
              onChange={(e) => setProfessional(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving…" : checkin ? "Update check-in" : "Submit check-in"}
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
