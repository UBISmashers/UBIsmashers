import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { TournamentBracket } from "@/components/tournament/TournamentBracket";
import { TournamentOverview } from "@/components/tournament/TournamentOverview";
import { TournamentPointsTable } from "@/components/tournament/TournamentPointsTable";
import { buildTournamentGroupView } from "@/lib/tournamentGroups";
import { buildScheduleRows, formatScheduleDateTime } from "@/lib/tournamentSchedule";
import type { Tournament, TournamentMatchType } from "@/types/tournament";

const statusOptions = [
  { label: "Upcoming", value: "upcoming" },
  { label: "Ongoing", value: "ongoing" },
  { label: "Completed", value: "completed" },
] as const;

const formatOptions = [
  { label: "Knockout", value: "knockout" },
  { label: "Round Robin", value: "round_robin" },
  { label: "Group + Knockout", value: "group_knockout" },
] as const;

const customMatchTypeOptions: Array<{ label: string; value: TournamentMatchType }> = [
  { label: "League Match", value: "league" },
  { label: "Semi Final", value: "semifinal" },
  { label: "Final", value: "final" },
  { label: "Friendly", value: "friendly" },
  { label: "Practice", value: "practice" },
];

export default function Tournaments() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
  const [form, setForm] = useState({
    name: "",
    date: "",
    time: "",
    location: "",
    type: "doubles" as "singles" | "doubles",
    format: "knockout" as "knockout" | "round_robin" | "group_knockout",
    entryFee: "",
    status: "upcoming" as "upcoming" | "ongoing" | "completed",
    isVisibleToMembers: true,
    allowTeamRegistration: false,
    registrationDeadline: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    date: "",
    time: "",
    location: "",
    type: "doubles" as "singles" | "doubles",
    format: "knockout" as "knockout" | "round_robin" | "group_knockout",
    entryFee: "",
    status: "upcoming" as "upcoming" | "ongoing" | "completed",
    isVisibleToMembers: true,
    allowTeamRegistration: false,
    registrationDeadline: "",
  });
  const [teamName, setTeamName] = useState("");
  const [adminContactMobileNumber, setAdminContactMobileNumber] = useState("");
  const [entryFeePaid, setEntryFeePaid] = useState("");
  const [playoffEditByMatch, setPlayoffEditByMatch] = useState<Record<string, { teamAId: string; teamBId: string }>>({});
  const [customMatchForm, setCustomMatchForm] = useState({
    matchType: "friendly" as TournamentMatchType,
    teamAId: "",
    teamBId: "",
    date: "",
    time: "",
    court: "",
  });
  const [editingMatchId, setEditingMatchId] = useState("");
  const [scheduleDraftByMatch, setScheduleDraftByMatch] = useState<
    Record<string, { teamAId: string; teamBId: string; date: string; time: string; court: string }>
  >({});
  const [scheduleConfig, setScheduleConfig] = useState({
    courtCount: 2,
    startTime: "18:00",
    matchDurationMinutes: 10,
  });

  const { data: tournaments = [] } = useQuery<Tournament[]>({
    queryKey: ["tournaments"],
    queryFn: () => api.getTournaments(),
  });

  const { data: config } = useQuery({
    queryKey: ["tournamentConfig"],
    queryFn: () => api.getTournamentConfig(),
  });

  const selectedTournament = useMemo(
    () => tournaments.find((item) => item._id === selectedTournamentId) || tournaments[0],
    [selectedTournamentId, tournaments]
  );

  useEffect(() => {
    if (!selectedTournament) return;
    setEditForm({
      name: selectedTournament.name,
      date: selectedTournament.date ? selectedTournament.date.slice(0, 10) : "",
      time: selectedTournament.time || "",
      location: selectedTournament.location,
      type: selectedTournament.type,
      format: selectedTournament.format || "knockout",
      entryFee: selectedTournament.entryFee?.toString() || "0",
      status: selectedTournament.status,
      isVisibleToMembers: selectedTournament.isVisibleToMembers,
      allowTeamRegistration: selectedTournament.allowTeamRegistration ?? false,
      registrationDeadline: selectedTournament.registrationDeadline ? selectedTournament.registrationDeadline.slice(0, 10) : "",
    });
  }, [selectedTournament]);

  useEffect(() => {
    if (!selectedTournament) return;
    const toDatePart = (value: Date) => {
      const y = value.getUTCFullYear();
      const m = String(value.getUTCMonth() + 1).padStart(2, "0");
      const d = String(value.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };
    const toTimePart = (value: Date) => {
      const h = String(value.getUTCHours()).padStart(2, "0");
      const m = String(value.getUTCMinutes()).padStart(2, "0");
      return `${h}:${m}`;
    };
    const next: Record<string, { teamAId: string; teamBId: string; date: string; time: string; court: string }> = {};
    selectedTournament.matches.forEach((match) => {
      const scheduled = match.scheduledAt ? new Date(match.scheduledAt) : null;
      next[match.matchId] = {
        teamAId: match.teamAId || "",
        teamBId: match.teamBId || "",
        date: scheduled ? toDatePart(scheduled) : "",
        time: scheduled ? toTimePart(scheduled) : "",
        court: match.court || "",
      };
    });
    setScheduleDraftByMatch(next);
    setEditingMatchId("");
  }, [selectedTournament]);

  useEffect(() => {
    if (!selectedTournament) return;
    const editablePlayoffs = selectedTournament.matches.filter(
      (match) => (match.matchType === "semifinal" || match.matchType === "final") && !match.isCompleted
    );
    const next: Record<string, { teamAId: string; teamBId: string }> = {};
    editablePlayoffs.forEach((match) => {
      next[match.matchId] = {
        teamAId: match.teamAId || "",
        teamBId: match.teamBId || "",
      };
    });
    setPlayoffEditByMatch(next);
  }, [selectedTournament]);

  useEffect(() => {
    if (!selectedTournament) return;
    setScheduleConfig((prev) => ({
      ...prev,
      startTime: selectedTournament.time || prev.startTime,
    }));
  }, [selectedTournament]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tournaments"] }),
      queryClient.invalidateQueries({ queryKey: ["publicTournaments"] }),
      queryClient.invalidateQueries({ queryKey: ["publicTournamentConfig"] }),
      queryClient.invalidateQueries({ queryKey: ["tournamentConfig"] }),
    ]);
  };

  const createTournamentMutation = useMutation({
    mutationFn: () =>
      api.createTournament({
        name: form.name,
        date: form.date,
        time: form.time,
        location: form.location,
        type: form.type,
        format: form.format,
        entryFee: form.entryFee ? Number(form.entryFee) : 0,
        status: form.status,
        isVisibleToMembers: form.isVisibleToMembers,
        allowTeamRegistration: form.allowTeamRegistration,
        registrationDeadline: form.registrationDeadline || null,
      }),
    onSuccess: async (created) => {
      setSelectedTournamentId(created._id);
      setForm({
        name: "",
        date: "",
        time: "",
        location: "",
        type: "doubles",
        format: "knockout",
        entryFee: "",
        status: "upcoming",
        isVisibleToMembers: true,
        allowTeamRegistration: false,
        registrationDeadline: "",
      });
      await refresh();
      toast({ title: "Tournament created" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const updateConfigMutation = useMutation({
    mutationFn: (enabled: boolean) => api.updateTournamentConfig(enabled),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Tournament visibility updated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const updateTournamentMutation = useMutation({
    mutationFn: (payload: Partial<{
      name: string;
      date: string;
      time: string;
      location: string;
      type: "singles" | "doubles";
      format: "knockout" | "round_robin" | "group_knockout";
      entryFee: number;
      status: "upcoming" | "ongoing" | "completed";
      isVisibleToMembers: boolean;
      allowTeamRegistration: boolean;
      registrationDeadline: string | null;
    }>) => api.updateTournament(selectedTournament!._id, payload),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Tournament updated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const deleteTournamentMutation = useMutation({
    mutationFn: (id: string) => api.deleteTournament(id),
    onSuccess: async () => {
      setSelectedTournamentId("");
      await refresh();
      toast({ title: "Tournament deleted" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const addTeamMutation = useMutation({
    mutationFn: () =>
      api.addTournamentTeam(selectedTournament!._id, {
        name: teamName.trim(),
        contactMobileNumber: adminContactMobileNumber.trim() || undefined,
        entryFeePaid: entryFeePaid ? Number(entryFeePaid) : 0,
      }),
    onSuccess: async () => {
      setTeamName("");
      setAdminContactMobileNumber("");
      setEntryFeePaid("");
      await refresh();
      toast({ title: "Team added" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const removeTeamMutation = useMutation({
    mutationFn: (teamId: string) => api.removeTournamentTeam(selectedTournament!._id, teamId),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Team removed" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const generateBracketMutation = useMutation({
    mutationFn: () => api.generateTournamentBracket(selectedTournament!._id),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Bracket generated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const generateScheduleMutation = useMutation({
    mutationFn: () =>
      api.generateTournamentSchedule(selectedTournament!._id, {
        courtCount: scheduleConfig.courtCount,
        startTime: scheduleConfig.startTime,
        matchDurationMinutes: scheduleConfig.matchDurationMinutes,
      }),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Match schedule generated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const updateScoreMutation = useMutation({
    mutationFn: ({ matchId, scoreA, scoreB }: { matchId: string; scoreA: number; scoreB: number }) =>
      api.updateTournamentMatchScore(selectedTournament!._id, matchId, { scoreA, scoreB }),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Score updated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const updatePlayoffTeamsMutation = useMutation({
    mutationFn: ({ matchId, teamAId, teamBId }: { matchId: string; teamAId: string; teamBId: string }) =>
      api.updateTournamentPlayoffTeams(selectedTournament!._id, matchId, {
        teamAId: teamAId || null,
        teamBId: teamBId || null,
      }),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Playoff teams updated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const updateMatchDetailsMutation = useMutation({
    mutationFn: ({
      matchId,
      teamAId,
      teamBId,
      date,
      time,
      court,
    }: {
      matchId: string;
      teamAId: string;
      teamBId: string;
      date: string;
      time: string;
      court: string;
    }) =>
      api.updateTournamentMatchDetails(selectedTournament!._id, matchId, {
        teamAId: teamAId || null,
        teamBId: teamBId || null,
        scheduledAt: date && time ? `${date}T${time}:00.000Z` : null,
        court: court.trim() || null,
      }),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Match updated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const createCustomMatchMutation = useMutation({
    mutationFn: () =>
      api.createTournamentCustomMatch(selectedTournament!._id, {
        matchType: customMatchForm.matchType,
        teamAId: customMatchForm.teamAId || null,
        teamBId: customMatchForm.teamBId || null,
        scheduledAt:
          customMatchForm.date && customMatchForm.time
            ? `${customMatchForm.date}T${customMatchForm.time}:00.000Z`
            : null,
        court: customMatchForm.court.trim() || null,
      }),
    onSuccess: async () => {
      setCustomMatchForm({
        matchType: "friendly",
        teamAId: "",
        teamBId: "",
        date: "",
        time: "",
        court: "",
      });
      await refresh();
      toast({ title: "Custom match added" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const declareWinnerMutation = useMutation({
    mutationFn: (teamId: string) => api.declareTournamentWinner(selectedTournament!._id, teamId),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Winner declared" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const reviewRegistrationMutation = useMutation({
    mutationFn: ({ registrationId, status }: { registrationId: string; status: "accepted" | "rejected" }) =>
      api.reviewTournamentRegistration(selectedTournament!._id, registrationId, { status }),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Registration updated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const updateRegistryEntryMutation = useMutation({
    mutationFn: ({ registryId, entryFeePaid }: { registryId: string; entryFeePaid: number }) =>
      api.updateTournamentTeamRegistry(selectedTournament!._id, registryId, { entryFeePaid }),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Team registry updated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const canAddTeams = Boolean(selectedTournament && selectedTournament.matches.length === 0);
  const canSubmitTeam = canAddTeams && Boolean(teamName.trim());
  const playoffMatches = (selectedTournament?.matches || []).filter(
    (match) => match.matchType === "semifinal" || match.matchType === "final"
  );
  const scheduleMatches = [...(selectedTournament?.matches || [])].sort((a, b) => {
    const aTs = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bTs = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (aTs !== bTs) return aTs - bTs;
    if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
    return a.matchNumber - b.matchNumber;
  });
  const scheduleRows = useMemo(() => buildScheduleRows(scheduleMatches), [scheduleMatches]);
  const scheduleGroups = useMemo(() => {
    const grouped = new Map<string, { slotLabel: string; rows: typeof scheduleRows }>();
    scheduleRows.forEach((row) => {
      const existing = grouped.get(row.slotKey);
      if (existing) {
        existing.rows.push(row);
        return;
      }
      grouped.set(row.slotKey, { slotLabel: row.slotLabel, rows: [row] });
    });
    return [...grouped.entries()].map(([key, value]) => ({
      slotKey: key,
      slotLabel: value.slotLabel,
      rows: value.rows,
    }));
  }, [scheduleRows]);
  const groupView = useMemo(() => buildTournamentGroupView(selectedTournament), [selectedTournament]);
  const registryByTeamName = useMemo(
    () =>
      new Map(
        (selectedTournament?.teamRegistry || []).map((entry) => [entry.teamName.trim().toLowerCase(), entry])
      ),
    [selectedTournament?.teamRegistry]
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tournaments</h1>
            <p className="text-sm text-muted-foreground">Manage tournament setup, bracket progress, and winner tracking.</p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2">
            <span className="text-sm font-medium">Show tournament to members</span>
            <Switch
              checked={Boolean(config?.enabled)}
              onCheckedChange={(checked) => updateConfigMutation.mutate(checked)}
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Create Tournament</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Time</Label>
                <Input type="time" value={form.time} onChange={(e) => setForm((prev) => ({ ...prev, time: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Location / Court</Label>
                <Input value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(value: "singles" | "doubles") => setForm((prev) => ({ ...prev, type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="singles">Singles</SelectItem>
                      <SelectItem value="doubles">Doubles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Format</Label>
                  <Select
                    value={form.format}
                    onValueChange={(value: "knockout" | "round_robin" | "group_knockout") =>
                      setForm((prev) => ({ ...prev, format: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {formatOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Entry Fee</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.entryFee}
                    onChange={(e) => setForm((prev) => ({ ...prev, entryFee: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Team Registration Deadline</Label>
                <Input
                  type="date"
                  value={form.registrationDeadline}
                  onChange={(e) => setForm((prev) => ({ ...prev, registrationDeadline: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value: "upcoming" | "ongoing" | "completed") => setForm((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border p-2">
                <span className="text-sm">Visible in member tournament page</span>
                <Switch
                  checked={form.isVisibleToMembers}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isVisibleToMembers: checked }))}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-2">
                <span className="text-sm">Allow team registration</span>
                <Switch
                  checked={form.allowTeamRegistration}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, allowTeamRegistration: checked }))}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => createTournamentMutation.mutate()}
                disabled={!form.name || !form.date || !form.time || !form.location || !form.registrationDeadline}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Tournament
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="space-y-3">
              <CardTitle>Manage Tournament</CardTitle>
              <Select value={selectedTournament?._id || ""} onValueChange={setSelectedTournamentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tournament" />
                </SelectTrigger>
                <SelectContent>
                  {tournaments.map((item) => (
                    <SelectItem key={item._id} value={item._id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {!selectedTournament ? (
                <p className="text-sm text-muted-foreground">Create a tournament to begin.</p>
              ) : (
                <div className="space-y-5">
                  <TournamentOverview tournament={selectedTournament} />
                  <TournamentPointsTable tournament={selectedTournament} />
                  {groupView.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Group Allocation</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-3 md:grid-cols-2">
                          {groupView.map((group) => (
                            <div key={group.label} className="rounded-md border">
                              <div className="border-b bg-secondary/30 px-3 py-2 text-sm font-semibold">
                                {group.label}
                              </div>
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                  <thead>
                                    <tr className="border-b text-left">
                                      <th className="px-3 py-2">Team</th>
                                      <th className="px-3 py-2">Players</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.teams.map((team) => (
                                      <tr key={`${group.label}-${team._id}`} className="border-b last:border-0">
                                        <td className="px-3 py-2 font-medium">{team.name}</td>
                                        <td className="px-3 py-2 text-muted-foreground">{team.players.join(" / ")}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        updateTournamentMutation.mutate({ isVisibleToMembers: !selectedTournament.isVisibleToMembers })
                      }
                    >
                      {selectedTournament.isVisibleToMembers ? "Hide from Members" : "Show to Members"}
                    </Button>
                    <Button variant="outline" onClick={() => generateBracketMutation.mutate()}>
                      Generate Bracket
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!selectedTournament.championTeam}
                      onClick={() =>
                        selectedTournament.championTeam &&
                        declareWinnerMutation.mutate(selectedTournament.championTeam._id)
                      }
                    >
                      Declare Winner
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => deleteTournamentMutation.mutate(selectedTournament._id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Edit Tournament</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <Label>Name</Label>
                        <Input value={editForm.name} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Date</Label>
                          <Input type="date" value={editForm.date} onChange={(e) => setEditForm((prev) => ({ ...prev, date: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label>Time</Label>
                          <Input type="time" value={editForm.time} onChange={(e) => setEditForm((prev) => ({ ...prev, time: e.target.value }))} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>Location / Court</Label>
                        <Input value={editForm.location} onChange={(e) => setEditForm((prev) => ({ ...prev, location: e.target.value }))} />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label>Type</Label>
                          <Select
                            value={editForm.type}
                            onValueChange={(value: "singles" | "doubles") => setEditForm((prev) => ({ ...prev, type: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="singles">Singles</SelectItem>
                              <SelectItem value="doubles">Doubles</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Format</Label>
                          <Select
                            value={editForm.format}
                            onValueChange={(value: "knockout" | "round_robin" | "group_knockout") =>
                              setEditForm((prev) => ({ ...prev, format: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {formatOptions.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Entry Fee</Label>
                          <Input
                            type="number"
                            min={0}
                            value={editForm.entryFee}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, entryFee: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>Team Registration Deadline</Label>
                        <Input
                          type="date"
                          value={editForm.registrationDeadline}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, registrationDeadline: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Status</Label>
                        <Select
                          value={editForm.status}
                          onValueChange={(value: "upcoming" | "ongoing" | "completed") =>
                            setEditForm((prev) => ({ ...prev, status: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between rounded-md border p-2">
                        <span className="text-sm">Visible in member tournament page</span>
                        <Switch
                          checked={editForm.isVisibleToMembers}
                          onCheckedChange={(checked) => setEditForm((prev) => ({ ...prev, isVisibleToMembers: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-md border p-2">
                        <span className="text-sm">Allow team registration</span>
                        <Switch
                          checked={editForm.allowTeamRegistration}
                          onCheckedChange={(checked) => setEditForm((prev) => ({ ...prev, allowTeamRegistration: checked }))}
                        />
                      </div>
                      <Button
                        onClick={() =>
                          updateTournamentMutation.mutate({
                            name: editForm.name,
                            date: editForm.date,
                            time: editForm.time,
                            location: editForm.location,
                            type: editForm.type,
                            format: editForm.format,
                            entryFee: editForm.entryFee ? Number(editForm.entryFee) : 0,
                            status: editForm.status,
                            isVisibleToMembers: editForm.isVisibleToMembers,
                            allowTeamRegistration: editForm.allowTeamRegistration,
                            registrationDeadline: editForm.registrationDeadline || null,
                          })
                        }
                        disabled={!editForm.name || !editForm.date || !editForm.time || !editForm.location || !editForm.registrationDeadline}
                      >
                        Save Tournament Changes
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Teams</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          placeholder={selectedTournament.type === "doubles" ? "Player1+Player2 / Player1/Player2" : "Player1"}
                          value={teamName}
                          onChange={(event) => setTeamName(event.target.value)}
                          disabled={!canAddTeams}
                        />
                        <Input
                          placeholder="Phone number (optional)"
                          value={adminContactMobileNumber}
                          onChange={(event) => setAdminContactMobileNumber(event.target.value)}
                          disabled={!canAddTeams}
                        />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          type="number"
                          min={0}
                          placeholder="Entry fee paid"
                          value={entryFeePaid}
                          onChange={(event) => setEntryFeePaid(event.target.value)}
                          disabled={!canAddTeams}
                        />
                        <Button onClick={() => addTeamMutation.mutate()} disabled={!canSubmitTeam}>
                          Add Team
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Team name format:{" "}
                        <span className="font-medium">
                          {selectedTournament.type === "doubles" ? "Player1+Player2 / Player1/Player2" : "Player1"}
                        </span>
                      </p>
                      {!canAddTeams && (
                        <p className="text-xs text-muted-foreground">
                          Team edits are disabled after bracket generation.
                        </p>
                      )}
                      <div className="space-y-2">
                        {selectedTournament.teams.map((team) => (
                          <div key={team._id} className="flex items-center justify-between rounded-md border bg-secondary/30 px-3 py-2">
                            <div>
                              <p className="font-medium">{team.name}</p>
                              <p className="text-xs text-muted-foreground">{team.players.join(" / ")}</p>
                            </div>
                            {canAddTeams && (
                              <Button size="sm" variant="ghost" onClick={() => removeTeamMutation.mutate(team._id)}>
                                Remove
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Team Registrations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedTournament.registrations.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No registrations yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {selectedTournament.registrations.map((registration) => {
                            const matchedEntry = registryByTeamName.get(registration.teamName.trim().toLowerCase());
                            const isFeePaid = Boolean(matchedEntry && Number(matchedEntry.entryFeePaid || 0) > 0);

                            return (
                              <div key={registration._id} className="rounded-md border p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <p className="font-medium">{registration.teamName}</p>
                                    <p className="text-xs text-muted-foreground">Team lead: {registration.teamLeadName}</p>
                                    {registration.contactMobileNumber && (
                                      <p className="text-xs text-muted-foreground">Contact: {registration.contactMobileNumber}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      className={
                                        registration.status === "accepted"
                                          ? "bg-emerald-600 text-white"
                                          : registration.status === "rejected"
                                          ? "bg-red-600 text-white"
                                          : "bg-amber-500 text-black"
                                      }
                                    >
                                      {registration.status}
                                    </Badge>
                                    <Badge variant={isFeePaid ? "default" : "secondary"}>{isFeePaid ? "Paid" : "Unpaid"}</Badge>
                                  </div>
                                </div>
                                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                  <p>Players: {registration.members.map((member) => member.name).join(" / ")}</p>
                                </div>
                                {matchedEntry && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <Button
                                      size="sm"
                                      variant={isFeePaid ? "outline" : "default"}
                                      onClick={() =>
                                        updateRegistryEntryMutation.mutate({
                                          registryId: matchedEntry._id,
                                          entryFeePaid: selectedTournament.entryFee || 1,
                                        })
                                      }
                                    >
                                      Mark Paid
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant={!isFeePaid ? "outline" : "secondary"}
                                      onClick={() =>
                                        updateRegistryEntryMutation.mutate({
                                          registryId: matchedEntry._id,
                                          entryFeePaid: 0,
                                        })
                                      }
                                    >
                                      Mark Unpaid
                                    </Button>
                                  </div>
                                )}
                                {registration.status === "pending" && (
                                  <div className="mt-3 flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        reviewRegistrationMutation.mutate({
                                          registrationId: registration._id,
                                          status: "accepted",
                                        })
                                      }
                                    >
                                      Accept
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() =>
                                        reviewRegistrationMutation.mutate({
                                          registrationId: registration._id,
                                          status: "rejected",
                                        })
                                      }
                                    >
                                      Reject
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Team Registry</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(selectedTournament.teamRegistry || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No team registry entries yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {selectedTournament.teamRegistry.map((entry) => (
                            <div key={entry._id} className="rounded-md border p-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <p className="font-medium">{entry.teamName}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={Number(entry.entryFeePaid || 0) > 0 ? "default" : "secondary"}>
                                    {Number(entry.entryFeePaid || 0) > 0 ? "Paid" : "Unpaid"}
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant={Number(entry.entryFeePaid || 0) > 0 ? "outline" : "default"}
                                    onClick={() =>
                                      updateRegistryEntryMutation.mutate({
                                        registryId: entry._id,
                                        entryFeePaid: selectedTournament.entryFee || 1,
                                      })
                                    }
                                    disabled={Number(entry.entryFeePaid || 0) > 0}
                                  >
                                    Mark Paid
                                  </Button>
                                  {Number(entry.entryFeePaid || 0) > 0 && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        updateRegistryEntryMutation.mutate({
                                          registryId: entry._id,
                                          entryFeePaid: 0,
                                        })
                                      }
                                    >
                                      Edit: Mark Unpaid
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                {entry.members.map((member, index) => (
                                  <p key={`${entry._id}-member-${index}`}>
                                    {member.name}
                                    {member.mobileNumber ? ` • ${member.mobileNumber}` : ""}
                                  </p>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {playoffMatches.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Playoff Team Overrides (Admin)</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {playoffMatches.map((match) => {
                          const draft = playoffEditByMatch[match.matchId] || { teamAId: "", teamBId: "" };
                          return (
                            <div key={match.matchId} className="rounded-md border p-3">
                              <p className="text-sm font-medium">{match.roundLabel}</p>
                              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                <Select
                                  value={draft.teamAId || "__none__"}
                                  onValueChange={(value) =>
                                    setPlayoffEditByMatch((prev) => ({
                                      ...prev,
                                      [match.matchId]: { ...draft, teamAId: value === "__none__" ? "" : value },
                                    }))
                                  }
                                  disabled={match.isCompleted}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Team A" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">TBD</SelectItem>
                                    {selectedTournament.teams.map((team) => (
                                      <SelectItem key={`a-${match.matchId}-${team._id}`} value={team._id}>
                                        {team.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select
                                  value={draft.teamBId || "__none__"}
                                  onValueChange={(value) =>
                                    setPlayoffEditByMatch((prev) => ({
                                      ...prev,
                                      [match.matchId]: { ...draft, teamBId: value === "__none__" ? "" : value },
                                    }))
                                  }
                                  disabled={match.isCompleted}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Team B" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">TBD</SelectItem>
                                    {selectedTournament.teams.map((team) => (
                                      <SelectItem key={`b-${match.matchId}-${team._id}`} value={team._id}>
                                        {team.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    updatePlayoffTeamsMutation.mutate({
                                      matchId: match.matchId,
                                      teamAId: draft.teamAId,
                                      teamBId: draft.teamBId,
                                    })
                                  }
                                  disabled={match.isCompleted}
                                >
                                  Save
                                </Button>
                              </div>
                              {match.isCompleted && (
                                <p className="mt-2 text-xs text-muted-foreground">Completed matches cannot be edited.</p>
                              )}
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Add Custom Match (Admin)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1">
                          <Label>Match Type</Label>
                          <Select
                            value={customMatchForm.matchType}
                            onValueChange={(value: TournamentMatchType) =>
                              setCustomMatchForm((prev) => ({ ...prev, matchType: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {customMatchTypeOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Team A</Label>
                          <Select
                            value={customMatchForm.teamAId || "__none__"}
                            onValueChange={(value) =>
                              setCustomMatchForm((prev) => ({ ...prev, teamAId: value === "__none__" ? "" : value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Team A" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">TBD</SelectItem>
                              {selectedTournament.teams.map((team) => (
                                <SelectItem key={`custom-a-${team._id}`} value={team._id}>
                                  {team.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Team B</Label>
                          <Select
                            value={customMatchForm.teamBId || "__none__"}
                            onValueChange={(value) =>
                              setCustomMatchForm((prev) => ({ ...prev, teamBId: value === "__none__" ? "" : value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Team B" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">TBD</SelectItem>
                              {selectedTournament.teams.map((team) => (
                                <SelectItem key={`custom-b-${team._id}`} value={team._id}>
                                  {team.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label>Date</Label>
                          <Input
                            type="date"
                            value={customMatchForm.date}
                            onChange={(event) =>
                              setCustomMatchForm((prev) => ({ ...prev, date: event.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Time</Label>
                          <Input
                            type="time"
                            value={customMatchForm.time}
                            onChange={(event) =>
                              setCustomMatchForm((prev) => ({ ...prev, time: event.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Court (Optional)</Label>
                          <Input
                            value={customMatchForm.court}
                            onChange={(event) =>
                              setCustomMatchForm((prev) => ({ ...prev, court: event.target.value }))
                            }
                          />
                        </div>
                      </div>

                      <Button onClick={() => createCustomMatchMutation.mutate()}>Add Match</Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Tournament Schedule</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-2 md:grid-cols-4">
                        <div className="space-y-1">
                          <Label>Courts Available</Label>
                          <Input
                            type="number"
                            min={1}
                            max={12}
                            value={scheduleConfig.courtCount}
                            onChange={(event) =>
                              setScheduleConfig((prev) => ({
                                ...prev,
                                courtCount: Number(event.target.value || 1),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Start Time</Label>
                          <Input
                            type="time"
                            value={scheduleConfig.startTime}
                            onChange={(event) =>
                              setScheduleConfig((prev) => ({ ...prev, startTime: event.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Match Duration (min)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={240}
                            value={scheduleConfig.matchDurationMinutes}
                            onChange={(event) =>
                              setScheduleConfig((prev) => ({
                                ...prev,
                                matchDurationMinutes: Number(event.target.value || 1),
                              }))
                            }
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            className="w-full"
                            onClick={() => generateScheduleMutation.mutate()}
                            disabled={!selectedTournament || selectedTournament.matches.length === 0}
                          >
                            Generate Match Schedule
                          </Button>
                        </div>
                      </div>

                      {scheduleGroups.length > 0 && (
                        <div className="space-y-2 rounded-md border p-3">
                          <p className="text-sm font-medium">Time Slot View</p>
                          {scheduleGroups.map((group) => (
                            <div key={group.slotKey} className="rounded-md border">
                              <div className="border-b bg-secondary/30 px-3 py-2 text-sm font-semibold">
                                {group.slotLabel}
                              </div>
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                  <thead>
                                    <tr className="border-b text-left">
                                      <th className="px-3 py-2">Time</th>
                                      <th className="px-3 py-2">Court</th>
                                      <th className="px-3 py-2">Team A</th>
                                      <th className="px-3 py-2">Team B</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.rows.map((row) => (
                                      <tr key={`${group.slotKey}-${row.matchId}`} className="border-b last:border-0">
                                        <td className="px-3 py-2">{group.slotLabel}</td>
                                        <td className="px-3 py-2">{row.court}</td>
                                        <td className="px-3 py-2">{row.teamAName}</td>
                                        <td className="px-3 py-2">{row.teamBName}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {scheduleMatches.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No matches scheduled yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {scheduleMatches.map((match) => (
                            <div key={`schedule-${match.matchId}`} className="rounded-md border px-3 py-2 text-sm">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-medium">{match.roundLabel}</p>
                                <div className="flex items-center gap-2">
                                  {match.isManual && <Badge variant="outline">Manual</Badge>}
                                  <Badge variant="secondary">{match.matchType}</Badge>
                                  {!match.isCompleted && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setEditingMatchId((prev) => (prev === match.matchId ? "" : match.matchId))
                                      }
                                    >
                                      {editingMatchId === match.matchId ? "Close Edit" : "Edit"}
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <p className="text-muted-foreground">
                                {match.teamA?.name || "TBD"} vs {match.teamB?.name || "TBD"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatScheduleDateTime(match.scheduledAt)}
                                {match.court ? ` • Court: ${match.court}` : ""}
                              </p>

                              {editingMatchId === match.matchId && (
                                <div className="mt-3 space-y-2 rounded-md border p-2">
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <div className="space-y-1">
                                      <Label>Team A</Label>
                                      <Select
                                        value={scheduleDraftByMatch[match.matchId]?.teamAId || "__none__"}
                                        onValueChange={(value) =>
                                          setScheduleDraftByMatch((prev) => ({
                                            ...prev,
                                            [match.matchId]: {
                                              ...(prev[match.matchId] || {
                                                teamAId: "",
                                                teamBId: "",
                                                date: "",
                                                time: "",
                                                court: "",
                                              }),
                                              teamAId: value === "__none__" ? "" : value,
                                            },
                                          }))
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Team A" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__none__">TBD</SelectItem>
                                          {selectedTournament.teams.map((team) => (
                                            <SelectItem key={`sched-a-${match.matchId}-${team._id}`} value={team._id}>
                                              {team.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label>Team B</Label>
                                      <Select
                                        value={scheduleDraftByMatch[match.matchId]?.teamBId || "__none__"}
                                        onValueChange={(value) =>
                                          setScheduleDraftByMatch((prev) => ({
                                            ...prev,
                                            [match.matchId]: {
                                              ...(prev[match.matchId] || {
                                                teamAId: "",
                                                teamBId: "",
                                                date: "",
                                                time: "",
                                                court: "",
                                              }),
                                              teamBId: value === "__none__" ? "" : value,
                                            },
                                          }))
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Team B" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__none__">TBD</SelectItem>
                                          {selectedTournament.teams.map((team) => (
                                            <SelectItem key={`sched-b-${match.matchId}-${team._id}`} value={team._id}>
                                              {team.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <div className="grid gap-2 sm:grid-cols-3">
                                    <div className="space-y-1">
                                      <Label>Date</Label>
                                      <Input
                                        type="date"
                                        value={scheduleDraftByMatch[match.matchId]?.date || ""}
                                        onChange={(event) =>
                                          setScheduleDraftByMatch((prev) => ({
                                            ...prev,
                                            [match.matchId]: {
                                              ...(prev[match.matchId] || {
                                                teamAId: "",
                                                teamBId: "",
                                                date: "",
                                                time: "",
                                                court: "",
                                              }),
                                              date: event.target.value,
                                            },
                                          }))
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label>Time</Label>
                                      <Input
                                        type="time"
                                        value={scheduleDraftByMatch[match.matchId]?.time || ""}
                                        onChange={(event) =>
                                          setScheduleDraftByMatch((prev) => ({
                                            ...prev,
                                            [match.matchId]: {
                                              ...(prev[match.matchId] || {
                                                teamAId: "",
                                                teamBId: "",
                                                date: "",
                                                time: "",
                                                court: "",
                                              }),
                                              time: event.target.value,
                                            },
                                          }))
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label>Court</Label>
                                      <Input
                                        value={scheduleDraftByMatch[match.matchId]?.court || ""}
                                        onChange={(event) =>
                                          setScheduleDraftByMatch((prev) => ({
                                            ...prev,
                                            [match.matchId]: {
                                              ...(prev[match.matchId] || {
                                                teamAId: "",
                                                teamBId: "",
                                                date: "",
                                                time: "",
                                                court: "",
                                              }),
                                              court: event.target.value,
                                            },
                                          }))
                                        }
                                      />
                                    </div>
                                  </div>
                                  <Button
                                    onClick={() =>
                                      updateMatchDetailsMutation.mutate({
                                        matchId: match.matchId,
                                        teamAId: scheduleDraftByMatch[match.matchId]?.teamAId || "",
                                        teamBId: scheduleDraftByMatch[match.matchId]?.teamBId || "",
                                        date: scheduleDraftByMatch[match.matchId]?.date || "",
                                        time: scheduleDraftByMatch[match.matchId]?.time || "",
                                        court: scheduleDraftByMatch[match.matchId]?.court || "",
                                      })
                                    }
                                  >
                                    Save Match Details
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {selectedTournament.matches.length > 0 && (
                    <TournamentBracket
                      tournament={selectedTournament}
                      editable
                      onSubmitScore={(matchId, scoreA, scoreB) => {
                        updateScoreMutation.mutate({ matchId, scoreA, scoreB });
                      }}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}


